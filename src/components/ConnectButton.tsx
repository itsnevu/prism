"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { short } from "@/lib/format";

export type ConnectButtonProps = { className?: string; label?: string };

/** Injected-wallet connect button. Shows truncated address + disconnect when connected. */
export function ConnectButton({ className = "", label = "Connect wallet" }: ConnectButtonProps) {
  // false during SSR/hydration, true once mounted in the browser (avoids wallet-state mismatches)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const base =
    className ||
    "rounded-full bg-ink px-5 py-2.5 text-[15px] font-semibold text-bg hover:bg-bezel disabled:opacity-60";

  if (!mounted) {
    return (
      <button type="button" className={base} disabled>
        {label}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="tnum rounded-full border border-line bg-surface px-3.5 py-2 font-mono text-[13.5px] font-medium text-ink">
          {short(address)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-field"
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </span>
    );
  }

  const connector = connectors[0];
  return (
    <button
      type="button"
      className={base}
      disabled={!connector || isPending || isConnecting}
      onClick={() => connector && connect({ connector })}
      title={connector ? undefined : "No injected wallet found"}
    >
      {isPending || isConnecting ? "Connecting…" : connector ? label : "No wallet"}
    </button>
  );
}
