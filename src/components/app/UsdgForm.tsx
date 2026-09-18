"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { IndexVaultAbi, deployment } from "@/lib/contracts";
import { activeChain } from "@/lib/chain";
import type { IndexView } from "@/lib/hooks";
import { fmtNum, fmtUsd } from "@/lib/format";

type Side = "buy" | "sell";
/** Keep the field to digits and a single decimal point, so it can always be parsed. */
function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [head, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${head}.${rest.join("")}` : head;
}


const SLIPPAGE_CHOICES = [10, 50, 100] as const; // bps
const MAX_UINT = 2n ** 256n - 1n;

/**
 * Single-asset entry and exit. Buying routes USDG through the vault's swap executor into the whole
 * basket in one transaction (`mintWithUSDG`); selling does the reverse. The preview is an
 * oracle-priced estimate — the on-chain `minOut` is that estimate less the chosen slippage, so a
 * bad fill reverts instead of silently costing the user.
 */
export function UsdgForm({ ix, userBalance }: { ix: IndexView; userBalance: bigint | undefined }) {
  // `chainId` is undefined when the wallet sits on a chain wagmi does not know (e.g. Ethereum mainnet).
  // Wallets remember a chain per site, so route every action through a switch when it is parked elsewhere.
  const { address, chainId: walletChainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wrongChain = !!address && walletChainId !== activeChain.id;
  const switchToActive = () => switchChain({ chainId: activeChain.id });
  const qc = useQueryClient();
  const usdg = deployment?.usdg;
  const [side, setSide] = useState<Side>("buy");
  const [raw, setRaw] = useState("100");
  const [slippageBps, setSlippageBps] = useState<number>(50);

  const vault = { address: ix.vault, abi: IndexVaultAbi } as const;
  const who = address ?? ix.vault;

  const { data: meta } = useReadContracts({
    contracts: usdg ? [{ address: usdg, abi: erc20Abi, functionName: "decimals" as const }] : [],
    allowFailure: true,
    query: { enabled: !!usdg },
  });
  const usdgDecimals = (meta?.[0]?.result as number | undefined) ?? 6;

  const amount = useMemo(() => {
    try {
      const v = parseUnits(raw || "0", side === "buy" ? usdgDecimals : 18);
      return v > 0n ? v : 0n;
    } catch {
      return 0n;
    }
  }, [raw, side, usdgDecimals]);

  const { data: rawData, refetch } = useReadContracts({
    contracts:
      usdg && amount > 0n
        ? ([
            { ...vault, functionName: side === "buy" ? "previewMintWithUSDG" : "previewRedeemForUSDG", args: [amount] },
            { address: usdg, abi: erc20Abi, functionName: "allowance", args: [who, ix.vault] },
            { address: usdg, abi: erc20Abi, functionName: "balanceOf", args: [who] },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any)
        : [],
    allowFailure: true,
    query: { enabled: !!usdg && amount > 0n, refetchInterval: 6_000 },
  });
  const data = rawData as { status: "success" | "failure"; result?: unknown }[] | undefined;

  const expected = data?.[0]?.status === "success" ? (data[0].result as bigint) : undefined;
  const allowance = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const usdgBalance = (data?.[2]?.result as bigint | undefined) ?? 0n;
  const minOut = expected !== undefined ? (expected * BigInt(10_000 - slippageBps)) / 10_000n : 0n;

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

  const busy = isPending || confirming;
  const approved = side === "sell" || allowance >= amount;
  // One call to action at a time: while USDG still needs approving, the submit button would only
  // repeat that instruction in a disabled state. A halted index is the exception — the pause is the
  // more important thing to say, and it belongs on the primary control.
  const needsApproval = side === "buy" && !!address && amount > 0n && !approved && !ix.halted;
  const enough = side === "buy" ? usdgBalance >= amount : (userBalance ?? 0n) >= amount;
  // Only complain when the quote actually reverted — not while the batched read is still in flight.
  const quoteFailed = data?.[0]?.status === "failure";

  const approve = () =>
    usdg && writeContract({ chainId: activeChain.id, address: usdg, abi: erc20Abi, functionName: "approve", args: [ix.vault, MAX_UINT] });
  const submit = () => {
    if (!address) return;
    if (side === "buy") writeContract({ ...vault, chainId: activeChain.id, functionName: "mintWithUSDG", args: [amount, minOut, address] });
    else writeContract({ ...vault, chainId: activeChain.id, functionName: "redeemForUSDG", args: [amount, minOut, address] });
  };

  if (!usdg) return null;

  const inSymbol = side === "buy" ? "USDG" : ix.symbol;
  const outLabel =
    side === "buy"
      ? `${fmtNum(expected, 18, 4)} ${ix.symbol}`
      : `${fmtNum(expected, usdgDecimals, 2)} USDG`;

  return (
    <div className="surface rounded-[28px] border border-line p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["buy", "sell"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={side === s}
              onClick={() => {
                setSide(s);
                setRaw(s === "buy" ? "100" : "1");
              }}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize transition-colors ${
                side === s ? "bg-ink text-bg" : "border border-line bg-field text-ink hover:bg-surface"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="hidden rounded-full bg-field px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] whitespace-nowrap uppercase text-ink-faint min-[400px]:inline-block">
          one transaction
        </span>
      </div>

      <label className="mt-4 block">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          {side === "buy" ? "USDG to spend" : `${ix.symbol} to sell`}
        </span>
        <div className="surface-inset mt-1.5 flex items-center justify-between rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-ink/15">
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(sanitizeAmount(e.target.value))}
            className="tnum w-full bg-transparent font-mono text-[20px] font-semibold text-ink outline-none"
            aria-label={side === "buy" ? "USDG amount" : "index amount"}
          />
          <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold text-ink">{inSymbol}</span>
        </div>
      </label>

      <div className="mt-2 flex items-center justify-between text-[12px] text-ink-soft">
        {/* Nothing is known about a wallet that has not connected — saying "0 · insufficient" there
            answers a question nobody asked, and answers it wrongly. */}
        <span>
          {address ? (
            <>
              {side === "buy" ? "wallet " : "you hold "}
              <span className="tnum font-mono">
                {side === "buy"
                  ? `${fmtNum(usdgBalance, usdgDecimals, 2)} USDG`
                  : `${fmtNum(userBalance, 18, 4)} ${ix.symbol}`}
              </span>
              {!enough && amount > 0n && <span className="text-[#b3b3b3]"> · insufficient</span>}
            </>
          ) : (
            "Connect a wallet to trade."
          )}
        </span>
        <span className="tnum font-mono">
          {ix.nav !== undefined && side === "sell" ? `≈ ${fmtUsd((amount * ix.nav) / 10n ** 18n)} at NAV` : ""}
        </span>
      </div>

      <div className="surface-inset mt-4 rounded-2xl px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="text-[10.5px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase text-ink-faint">
            You receive ≈
          </span>
          <span className="tnum font-mono text-[18px] font-semibold text-ink sm:text-right">
            {expected === undefined ? "—" : outLabel}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11.5px] text-ink-soft">Max slippage</span>
          <div className="flex gap-1">
            {SLIPPAGE_CHOICES.map((bps) => (
              <button
                key={bps}
                type="button"
                aria-pressed={slippageBps === bps}
                onClick={() => setSlippageBps(bps)}
                className={`tnum rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                  slippageBps === bps ? "bg-ink text-bg" : "bg-surface text-ink-soft hover:text-ink"
                }`}
              >
                {bps / 100}%
              </button>
            ))}
          </div>
        </div>
        <div className="tnum mt-1.5 text-right font-mono text-[10.5px] text-ink-faint">
          reverts below {side === "buy" ? `${fmtNum(minOut, 18, 4)} ${ix.symbol}` : `${fmtNum(minOut, usdgDecimals, 2)} USDG`}
        </div>
      </div>

      {wrongChain ? (
        <button
          type="button"
          disabled={switching}
          onClick={switchToActive}
          className="mt-4 w-full rounded-full bg-ink py-3 text-[15px] font-semibold text-bg transition-colors hover:bg-bezel disabled:opacity-50"
        >
          {switching ? "Switching…" : `Switch to `}
        </button>
      ) : needsApproval ? (
        <button
          type="button"
          disabled={busy}
          onClick={approve}
          className="mt-4 w-full rounded-full bg-ink py-3 text-[15px] font-semibold text-bg transition-colors hover:bg-bezel disabled:opacity-50"
        >
          {busy ? "Approving…" : "Approve USDG"}
        </button>
      ) : (
      <button
        type="button"
        disabled={!address || busy || amount === 0n || ix.halted || !enough}
        onClick={submit}
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
              : !enough
                ? "Insufficient balance"
                : side === "buy"
                  ? `Buy ${ix.symbol} with USDG`
                  : `Sell ${ix.symbol} for USDG`}
      </button>
      )}

      {quoteFailed && !ix.halted && (
        <p className="mt-2 text-[11.5px] text-ink-faint">
          No quote for {ix.symbol} right now — the vault could not price this route.
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {busy ? (confirming ? "Confirming transaction" : "Waiting for wallet signature") : ""}
      </p>
      {reverted && (
        <p className="mt-2 text-[11.5px] text-[#b3b3b3]">
          Transaction reverted on chain — most likely the fill came in under your slippage floor.
          Nothing moved; widen the tolerance or try again.
        </p>
      )}
      {receiptError && (
        <p className="mt-2 break-words text-[11.5px] text-[#b3b3b3]">
          Could not confirm the transaction: {receiptError.message.split("\n")[0].slice(0, 140)}
        </p>
      )}
      {error && <p className="mt-2 break-words text-[11.5px] text-[#b3b3b3]">{error.message.split("\n")[0].slice(0, 160)}</p>}
      <p className="mt-3 text-center text-[11px] text-ink-faint">
        USDG is split across the basket by target weight, so buying also nudges the index back on target.
      </p>
    </div>
  );
}
