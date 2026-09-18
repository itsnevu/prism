"use client";

import { useIndexes, type IndexView } from "@/lib/hooks";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/format";
import { Tri } from "./Logo";

const COLORS: Record<string, { color: string; stroke?: string; label: string }> = {
  pSEMI: { color: "#e6e6e6", label: "SEMIS" },
  pMETL: { color: "#8a8a8a", stroke: "#3a3a3a", label: "COMMODITIES" },
  pDGEN: { color: "#3a3a3a", stroke: "#8a8a8a", label: "DEGEN" },
};

function statusOf(ix: IndexView) {
  if (ix.paused) return { text: "Paused", down: true };
  if (ix.halted) return { text: "Stale feed · halted", down: true };
  if (ix.rebalanceNeeded) return { text: "Rebalance due", down: false };
  return { text: "Live · in band", down: false };
}

/** Top legs by target weight; live weight shown when the vault has value. */
function legs(ix: IndexView, n = 5) {
  return [...ix.components]
    .sort((a, b) => b.targetBps - a.targetBps)
    .slice(0, n)
    .map((c) => ({ t: c.symbol, target: c.targetBps, live: ix.totalValue > 0n ? c.weightBps : undefined }));
}

/** Basket tiles for the landing — every number is read from the vaults. */
export function IndexTiles() {
  const { indexes, hasDeployment, isLoading } = useIndexes();

  if (!hasDeployment) {
    return (
      <li className="lp-tile lp-tile-span">
        <div className="lp-art lp-art-field lp-art-basket lp-art-empty">
          <span className="lp-basket-name">No deployment on this network</span>
          <span className="lp-muted lp-small">
            Point NEXT_PUBLIC_CHAIN at a chain with Prism vaults, or run <code>npm run chain</code> and{" "}
            <code>npm run deploy:local</code>.
          </span>
        </div>
      </li>
    );
  }

  return (
    <>
      {indexes.map((ix) => {
        const c = COLORS[ix.key] ?? COLORS.pSEMI;
        const st = statusOf(ix);
        const top = legs(ix);
        return (
          <li key={ix.key} className="lp-tile">
            <div className="lp-art lp-art-field lp-art-basket">
              <span className="lp-art-tag lp-art-tag-mono">{ix.symbol}</span>
              <div className="lp-basket-head">
                <Tri size={44} color={c.color} stroke={c.stroke} />
                <div>
                  <span className="lp-basket-name">{c.label}</span>
                  <span className="lp-basket-band lp-muted">
                    ±{fmtPct(ix.bandBps, 0)} band · {fmtPct(ix.mintFeeBps, 2)} mint fee
                  </span>
                </div>
              </div>

              <div className="lp-spark">
                <div className="lp-spark-head">
                  <span className="lp-spark-nav">{isLoading && ix.nav === undefined ? "…" : fmtUsd(ix.nav)}</span>
                  <span className={`lp-spark-chg${st.down ? " is-down" : ""}`}>{st.text}</span>
                </div>
                <div className="lp-basket-meta lp-muted">
                  <span>NAV per {ix.symbol}</span>
                  <span>{fmtNum(ix.totalSupply, 18, 2)} minted · {fmtUsd(ix.totalValue)} held</span>
                </div>
              </div>

              <ul className="lp-legs" aria-label={`${c.label} holdings by target weight`}>
                {top.map((l) => (
                  <li key={l.t} className="lp-leg">
                    <span className="lp-leg-t">{l.t}</span>
                    <span className="lp-leg-bar">
                      <span style={{ width: `${Math.min(100, ((l.live ?? l.target) / 10_000) * 200)}%` }} />
                    </span>
                    <span className="lp-leg-w">{fmtPct(l.live ?? l.target, 0)}</span>
                  </li>
                ))}
                <li className="lp-leg lp-leg-more lp-muted">
                  {ix.components.length} names · {ix.totalValue > 0n ? "live weights" : "target weights"} · redeemable at NAV
                </li>
              </ul>
            </div>
            <p className="lp-caption">
              {c.label}{" "}
              <span className="lp-muted">
                {ix.components.length} names · rebalances inside a ±{fmtPct(ix.bandBps, 0)} band
              </span>
            </p>
          </li>
        );
      })}
    </>
  );
}

/** Running tape under the hero: NAV, supply and status per vault, straight from chain. */
export function IndexTape() {
  const { indexes, hasDeployment } = useIndexes();
  const items = hasDeployment
    ? indexes.flatMap((ix) => {
        const st = statusOf(ix);
        return [
          { t: ix.symbol, v: fmtUsd(ix.nav), c: st.text, down: st.down },
          { t: `${ix.symbol} supply`, v: fmtNum(ix.totalSupply, 18, 2), c: `${fmtUsd(ix.totalValue)} in basket`, down: false },
          ...ix.components.slice(0, 2).map((cp) => ({
            t: cp.symbol,
            v: cp.price === undefined ? "—" : fmtUsd(cp.price),
            c: cp.fresh ? `${fmtPct(cp.weightBps || cp.targetBps, 0)} of ${ix.symbol}` : "stale",
            down: !cp.fresh,
          })),
        ];
      })
    : [{ t: "No network", v: "connect a chain with Prism vaults", c: "", down: true }];
  const doubled = [...items, ...items];
  return (
    <div className="lp-tape" aria-hidden="true">
      <div className="lp-tape-track" style={{ animationDuration: `${Math.max(24, doubled.length * 3)}s` }}>
        {doubled.map((it, i) => (
          <span key={i} className="lp-tape-item">
            <Tri size={10} color={it.down ? "#5a5a5a" : "#e6e6e6"} />
            <span className="lp-tape-t">{it.t}</span>
            <span className="lp-tape-v">{it.v}</span>
            {it.c && <span className={`lp-tape-c${it.down ? " is-down" : ""}`}>{it.c}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Closing tile: the live index list (symbol · leg count) instead of a typed-in one. */
export function IndexCountList() {
  const { indexes, hasDeployment } = useIndexes();
  if (!hasDeployment) return <li>No deployment on this network</li>;
  return (
    <>
      {indexes.map((ix) => (
        <li key={ix.key}>
          {ix.symbol} · {ix.components.length} names
        </li>
      ))}
    </>
  );
}
