"use client";

import { useState } from "react";
import { Tri } from "@/components/Logo";
import type { IndexView } from "@/lib/hooks";
import { fmtNum, fmtPct, fmtUsd, short } from "@/lib/format";
import { MintRedeemForm } from "./MintRedeemForm";
import { UsdgForm } from "./UsdgForm";

const COLORS: Record<string, string> = { pSEMI: "#7be372", pMETL: "#6ed964", pDGEN: "#394938" };

type Route = "usdg" | "basket";

export function IndexCard({ ix, userBalance }: { ix: IndexView; userBalance: bigint | undefined }) {
  const staleLegs = ix.components.filter((c) => !c.fresh);
  // USDG first: one approval and one transaction beats approving every leg of the basket.
  const [route, setRoute] = useState<Route>("usdg");
  return (
    <section data-testid={`index-${ix.key}`} className="rounded-[36px] bg-field p-6 sm:p-8">
      {(ix.halted || ix.paused) && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#e7c9a3] bg-[#fff4e6] px-4 py-3 text-[13.5px] text-[#7a4a1d]">
          <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-[#e08a3c]" />
          <div>
            <div className="font-semibold">
              {ix.paused ? "Paused by owner." : "Mint & redeem paused — stale price."}
            </div>
            <div className="mt-0.5 text-[12.5px]">
              {ix.paused
                ? "The vault owner has halted mint/redeem."
                : `${staleLegs.map((c) => c.symbol).join(", ") || short(ix.staleAsset)} hasn’t updated within ${ix.maxStaleness / 3600 >= 1 ? `${(ix.maxStaleness / 3600).toFixed(0)}h` : `${ix.maxStaleness / 60}m`}. NAV is not quoted rather than guessed.`}
            </div>
          </div>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="flex items-center gap-4">
              <Tri size={40} color={COLORS[ix.key] ?? "#7be372"} />
              <div>
                <div className="text-[30px] leading-none font-bold tracking-[-0.03em] text-ink sm:text-[34px]">
                  {ix.name}
                </div>
                <div className="tnum mt-1.5 font-mono text-[13.5px] font-medium whitespace-nowrap text-ink-soft sm:text-[14px]">
                  {ix.symbol} · <span className="text-ink-faint">{short(ix.vault)}</span>
                </div>
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[10.5px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase text-ink-faint">
                NAV / token
              </div>
              <div className="tnum font-mono text-[28px] font-semibold leading-none tracking-tight text-ink">
                {ix.nav !== undefined ? fmtUsd(ix.nav) : <span className="text-[#b5533a] text-[16px]">{ix.navError ?? "—"}</span>}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
            <Stat label="Supply" value={`${fmtNum(ix.totalSupply, 18, 2)} ${ix.symbol}`} />
            <Stat label="Basket value" value={fmtUsd(ix.totalValue)} />
            <Stat
              label="Rebalance"
              value={ix.rebalanceNeeded === undefined ? "—" : ix.rebalanceNeeded ? "needed" : `in band ±${fmtPct(ix.bandBps, 0)}`}
            />
          </div>

          <div className="mb-1 mt-6 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Components · weight vs target
          </div>
          <div className="surface divide-y divide-line rounded-2xl border border-line px-4">
            {ix.components.map((c) => {
              const drift = c.weightBps - c.targetBps;
              const outOfBand = Math.abs(drift) > ix.bandBps;
              // Below the resolution we print, a leg is on target. "+0.0%" and "-0.0%" are the same
              // number wearing two different signs, and the sign is the only thing the eye catches.
              const onTarget = Math.abs(drift) < 5;
              return (
                <div
                  key={c.asset}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-2.5 sm:grid-cols-[64px_1fr_auto]"
                >
                  <div>
                    <div className="text-[13.5px] font-semibold text-ink">{c.symbol}</div>
                    <div className="tnum font-mono text-[10.5px] text-ink-faint">cap {fmtPct(c.maxBps, 0)}</div>
                  </div>
                  <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                    <div className="surface-inset relative h-[7px] overflow-hidden rounded-full">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-green shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                        style={{ width: `${Math.min(100, c.weightBps / 100)}%` }}
                      />
                      <span
                        className="absolute inset-y-[-2px] w-[2px] rounded-full bg-ink"
                        title="target weight"
                        style={{ left: `${Math.min(100, c.targetBps / 100)}%` }}
                      />
                    </div>
                    {/* On target, naming the target again says the same thing twice. */}
                    <div className="tnum mt-1 flex flex-wrap gap-x-2 font-mono text-[10.5px] text-ink-soft">
                      <span>{fmtPct(c.weightBps)}</span>
                      {onTarget ? (
                        <span className="text-ink-faint">on target</span>
                      ) : (
                        <>
                          <span className="text-ink-faint">target {fmtPct(c.targetBps)}</span>
                          <span className={outOfBand ? "text-[#b5533a]" : "text-ink-faint"}>
                            {drift > 0 ? "+" : "−"}
                            {fmtPct(Math.abs(drift))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tnum font-mono text-[13px] font-medium text-ink">{fmtUsd(c.price)}</div>
                    <span
                      className={`mt-0.5 inline-block rounded-full px-2 py-[1px] text-[10px] font-semibold ${
                        c.fresh ? "bg-[#e3f7e0] text-[#2f7a2a]" : "bg-[#fde8e3] text-[#b5533a]"
                      }`}
                      title={c.ageSec !== undefined ? `updated ${fmtAge(c.ageSec)} ago (chain time)` : ""}
                    >
                      {c.fresh ? "fresh" : "stale"}
                      {c.ageSec !== undefined && <span className="tnum ml-1 font-mono font-medium opacity-70">{fmtAge(c.ageSec)}</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-ink-soft">
            Fees: {fmtPct(ix.mintFeeBps, 2)} mint/redeem · {fmtPct(ix.mgmtFeeBps, 2)}/yr management, streamed in {ix.symbol}. Staleness limit{" "}
            {fmtAge(ix.maxStaleness)}.
          </p>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex gap-1.5" role="tablist" aria-label={`How to trade ${ix.symbol}`}>
            {(
              [
                ["usdg", "With USDG"],
                ["basket", "With the basket"],
              ] as [Route, string][]
            ).map(([r, label]) => (
              <button
                key={r}
                type="button"
                role="tab"
                id={`${ix.key}-tab-${r}`}
                aria-selected={route === r}
                aria-controls={`${ix.key}-panel`}
                onClick={() => setRoute(r)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-all ${
                  route === r ? "surface text-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div id={`${ix.key}-panel`} role="tabpanel" aria-labelledby={`${ix.key}-tab-${route}`}>
            {route === "usdg" ? (
              <UsdgForm ix={ix} userBalance={userBalance} />
            ) : (
              <MintRedeemForm ix={ix} userBalance={userBalance} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-2xl border border-line px-4 py-3">
      <div className="text-[10.5px] font-semibold tracking-[0.1em] uppercase text-ink-faint">{label}</div>
      <div className="tnum mt-1 font-mono text-[14px] font-medium break-words text-ink">{value}</div>
    </div>
  );
}

function fmtAge(s: number) {
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  if (s < 172800) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
