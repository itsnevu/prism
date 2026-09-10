"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits, type Address } from "viem";
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { IndexVaultAbi } from "@/lib/contracts";
import type { IndexView } from "@/lib/hooks";
import { fmtNum, fmtUsd } from "@/lib/format";

type Mode = "mint" | "redeem";
/** Keep the field to digits and a single decimal point, so it can always be parsed. */
function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [head, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${head}.${rest.join("")}` : head;
}


export function MintRedeemForm({ ix, userBalance }: { ix: IndexView; userBalance: bigint | undefined }) {
  const { address } = useAccount();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("mint");
  const [raw, setRaw] = useState("1");
  const amount = useMemo(() => {
    try {
      const v = parseUnits(raw || "0", 18);
      return v > 0n ? v : 0n;
    } catch {
      return 0n;
    }
  }, [raw]);

  const vault = { address: ix.vault, abi: IndexVaultAbi } as const;

  // preview + allowances + wallet balances in one batch
  const who = address ?? ix.vault;
  const contracts = [
    { ...vault, functionName: mode === "mint" ? "previewMint" : "previewRedeem", args: [amount] },
    ...ix.components.flatMap((c) => [
      { address: c.asset, abi: erc20Abi, functionName: "allowance", args: [who, ix.vault] },
      { address: c.asset, abi: erc20Abi, functionName: "balanceOf", args: [who] },
    ]),
  ];
  const { data: rawData, refetch } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    allowFailure: true,
    query: { enabled: amount > 0n, refetchInterval: 6_000 },
  });
  const data = rawData as { status: "success" | "failure"; result?: unknown }[] | undefined;

  const preview = data?.[0]?.status === "success" ? (data[0].result as readonly [readonly Address[], readonly bigint[]]) : undefined;
  const legs = ix.components.map((c, i) => {
    const need = preview?.[1][i] ?? 0n;
    const allowance = (data?.[1 + i * 2]?.result as bigint | undefined) ?? 0n;
    const wallet = (data?.[2 + i * 2]?.result as bigint | undefined) ?? 0n;
    return { ...c, need, allowance, wallet, approved: allowance >= need, enough: wallet >= need };
  });

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const {
    isLoading: confirming,
    isSuccess,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });
  // A transaction that lands but reverts still "succeeds" as a receipt fetch. Without this the
  // button would sit on "Confirming…" forever and the user would never learn it failed.
  const reverted = receipt?.status === "reverted";

  useEffect(() => {
    if (!isSuccess && !receiptError) return;
    void refetch();
    void qc.invalidateQueries();
    reset();
  }, [isSuccess, receiptError, refetch, qc, reset]);

  const approve = (asset: Address) =>
    writeContract({ address: asset, abi: erc20Abi, functionName: "approve", args: [ix.vault, 2n ** 256n - 1n] });
  const mint = () => address && writeContract({ ...vault, functionName: "mint", args: [amount, address] });
  const redeem = () => address && writeContract({ ...vault, functionName: "redeem", args: [amount, address] });

  const busy = isPending || confirming;
  const allApproved = legs.every((l) => l.approved);
  const allEnough = legs.every((l) => l.enough);
  const fee = (amount * BigInt(ix.mintFeeBps)) / 10_000n;
  const canRedeem = (userBalance ?? 0n) >= amount && amount > 0n;

  return (
    <div className="rounded-[28px] border border-line bg-white p-5">
      <div className="flex gap-1.5">
        {(["mint", "redeem"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize transition-colors ${
              mode === m ? "bg-ink text-white" : "border border-line bg-field text-ink hover:bg-white"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {mode === "mint" ? "Index tokens to mint" : "Index tokens to redeem"}
        </span>
        <div className="mt-1.5 flex items-center justify-between rounded-2xl border border-line bg-field px-4 py-3">
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(sanitizeAmount(e.target.value))}
            className="tnum w-full bg-transparent font-mono text-[20px] font-semibold text-ink outline-none"
            aria-label="amount"
          />
          <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-ink">{ix.symbol}</span>
        </div>
      </label>
      <div className="mt-2 flex justify-between text-[12px] text-ink-soft">
        <span>{ix.nav !== undefined ? `≈ ${fmtUsd((amount * ix.nav) / 10n ** 18n)} at NAV` : "NAV unavailable"}</span>
        <span className="tnum font-mono">
          fee {fmtNum(fee, 18, 4)} {ix.symbol}
        </span>
      </div>

      <div className="mb-1 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {mode === "mint" ? "You deliver" : "You receive"}
      </div>
      <div className="divide-y divide-line">
        {legs.map((l) => (
          <div key={l.asset} className="flex items-center justify-between py-2">
            <div>
              <div className="text-[13px] font-semibold text-ink">{l.symbol}</div>
              {mode === "mint" && address && (
                <div className="tnum font-mono text-[10.5px] text-ink-faint">
                  wallet {fmtNum(l.wallet, l.decimals, 2)}
                  {!l.enough && l.need > 0n && <span className="text-[#b5533a]"> · insufficient</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="tnum font-mono text-[13px] text-ink">{fmtNum(l.need, l.decimals, 6)}</span>
              {mode === "mint" && address && (
                l.approved ? (
                  <span
                    data-testid={`approved-${l.symbol}`}
                    className="rounded-full bg-field px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft"
                  >
                    approved
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`approve-${l.symbol}`}
                    disabled={busy}
                    onClick={() => approve(l.asset)}
                    className="rounded-full bg-ink px-2.5 py-0.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-bezel disabled:opacity-50"
                  >
                    approve
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={
          !address || busy || amount === 0n || ix.halted || (mode === "mint" ? !allApproved || !allEnough : !canRedeem)
        }
        onClick={mode === "mint" ? mint : redeem}
        className="mt-4 w-full rounded-full bg-green py-3 text-[15px] font-semibold text-bezel transition-colors hover:bg-green-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {!address
          ? "Connect a wallet"
          : ix.halted
            ? "Paused — stale leg"
            : busy
              ? confirming
                ? "Confirming…"
                : "Sign in wallet…"
              : mode === "mint"
                ? allApproved
                  ? `Mint ${fmtNum(amount - fee, 18, 4)} ${ix.symbol}`
                  : "Approve all components first"
                : canRedeem
                  ? `Redeem ${fmtNum(amount, 18, 4)} ${ix.symbol}`
                  : "Insufficient balance"}
      </button>
      <p aria-live="polite" className="sr-only">
        {busy ? (confirming ? "Confirming transaction" : "Waiting for wallet signature") : ""}
      </p>
      {reverted && (
        <p className="mt-2 text-[11.5px] text-[#b5533a]">
          Transaction reverted on chain. Nothing moved — check the amounts and try again.
        </p>
      )}
      {receiptError && (
        <p className="mt-2 break-words text-[11.5px] text-[#b5533a]">
          Could not confirm the transaction: {receiptError.message.split("\n")[0].slice(0, 140)}
        </p>
      )}
      {error && (
        <p className="mt-2 break-words text-[11.5px] text-[#b5533a]">{error.message.split("\n")[0].slice(0, 160)}</p>
      )}
      {address && userBalance !== undefined && (
        <p className="tnum mt-3 text-center font-mono text-[11.5px] text-ink-faint">
          you hold {formatUnits(userBalance, 18).slice(0, 12)} {ix.symbol}
        </p>
      )}
    </div>
  );
}
