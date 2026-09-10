"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { Wordmark } from "@/components/Logo";
import { ConnectButton } from "@/components/ConnectButton";
import { IndexCard } from "@/components/app/IndexCard";
import { useIndexes, useUserIndexBalances } from "@/lib/hooks";
import { activeChain } from "@/lib/chain";
import { deployment } from "@/lib/contracts";
import { fmtUsd, short } from "@/lib/format";

const container = "mx-auto w-full max-w-[1120px] px-5 sm:px-8";

export default function AppPage() {
  const { address, chainId } = useAccount();
  const { indexes, isLoading, hasDeployment } = useIndexes();
  const { byKey } = useUserIndexBalances(address);

  const portfolio = indexes.reduce((s, ix) => {
    const b = byKey[ix.key];
    return b && ix.nav !== undefined ? s + (b * ix.nav) / 10n ** 18n : s;
  }, 0n);
  const wrongChain = address && chainId !== undefined && chainId !== activeChain.id;

  return (
    <main className="flex-1">
      <header className={`${container} flex h-[72px] items-center justify-between`}>
        <Link href="/" aria-label="Prism home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-2">
          <span className="hidden rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft sm:inline-block">
            {activeChain.name} · {activeChain.id}
          </span>
          <ConnectButton />
        </nav>
      </header>

      <section className={`${container} pt-8 pb-6`}>
        <div className="flex flex-col gap-6 rounded-[36px] bg-bezel px-7 py-8 text-white sm:flex-row sm:items-end sm:justify-between sm:px-10">
          <div>
            <div className="text-[12px] font-medium text-white/60">Your baskets</div>
            <div className="mt-1 flex items-baseline gap-2">
              {address ? (
                <span className="tnum font-mono text-[40px] leading-none font-semibold tracking-tight">
                  {fmtUsd(portfolio)}
                </span>
              ) : (
                <span className="text-[40px] leading-none font-semibold tracking-tight text-white/25">—</span>
              )}
              <span className="text-[13px] text-white/60">· {indexes.length} indexes</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {indexes.map((ix) => (
                <span key={ix.key} className="tnum rounded-full bg-white/10 px-3 py-1 font-mono text-[12px]">
                  {byKey[ix.key] !== undefined ? Number(byKey[ix.key]! / 10n ** 14n) / 10_000 : "—"} {ix.symbol}
                </span>
              ))}
            </div>
          </div>
          <div className="text-[12.5px] text-white/60 sm:text-right">
            {address ? (
              <>
                <div className="tnum font-mono">{short(address)}</div>
                {wrongChain && <div className="mt-1 text-[#ffb27a]">Switch wallet to {activeChain.name} (chain {activeChain.id})</div>}
              </>
            ) : (
              <div>Connect a wallet to mint or redeem.</div>
            )}
            {deployment && (
              <div className="tnum mt-1 font-mono text-[11px] text-white/40">
                factory {short(deployment.factory)} · oracle {short(deployment.oracle)}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={`${container} flex flex-col gap-6 pb-24`}>
        {!hasDeployment && (
          <div className="rounded-[36px] border border-line bg-white p-10 text-center">
            <div className="text-[24px] font-bold tracking-[-0.02em] text-ink">No deployment found for {activeChain.name}</div>
            <p className="mx-auto mt-3 max-w-[520px] text-[15px] text-ink-soft">
              Run <code className="rounded bg-field px-1.5 py-0.5 font-mono text-[13px]">npm run chain</code>, then{" "}
              <code className="rounded bg-field px-1.5 py-0.5 font-mono text-[13px]">npm run deploy:local</code> and{" "}
              <code className="rounded bg-field px-1.5 py-0.5 font-mono text-[13px]">npm run abi:sync</code>, then reload.
            </p>
          </div>
        )}
        {hasDeployment && isLoading && indexes.every((i) => i.nav === undefined && !i.navError) && (
          <div className="rounded-[36px] bg-field p-10 text-center text-[15px] text-ink-soft">Reading vaults from {activeChain.name}…</div>
        )}
        {indexes.map((ix) => (
          <IndexCard key={ix.key} ix={ix} userBalance={byKey[ix.key]} />
        ))}
        {hasDeployment && (
          <p className="text-center text-[12.5px] text-ink-faint">
            Buy with USDG in one transaction (<span className="font-mono">mintWithUSDG</span>), or deliver the basket yourself. Either way you own the
            components, not a wrapper.
          </p>
        )}
      </section>
    </main>
  );
}
