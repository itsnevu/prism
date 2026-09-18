"use client";

import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { useBlock } from "wagmi";
import { relTime, useActivity, useIndexes, useUserIndexBalances, type ActivityItem } from "@/lib/hooks";
import { fmtNum, fmtPct, fmtUsd, short } from "@/lib/format";
import { PrismMark, Tri } from "./Logo";
import { CardIcon, ChevronIcon, ClockIcon, GridIcon, PlusIcon, WalletIcon } from "./Icons";

/**
 * iPhone frame as an SVG <symbol>: bezel, side buttons, dynamic island,
 * status bar (9:41 · signal · wifi · battery) and home indicator.
 * Render once per page; every <IPhone> references it with <use>.
 * Geometry is the 433x882 frame crumbs.family uses.
 */
export function PhoneDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <mask id="iphone-punch" maskUnits="userSpaceOnUse" x="0" y="0" width="433" height="882">
          <rect width="433" height="882" fill="#fff" />
          <rect x="21.25" y="19.25" width="389.5" height="843.5" rx="55.75" ry="55.75" fill="#000" />
        </mask>
        <symbol id="iphone-frame" viewBox="0 0 433 882">
          <g mask="url(#iphone-punch)">
            <rect x="2" y="0" width="428" height="882" rx="73" ry="73" fill="var(--bezel)" />
            <path d="M0 171C0 170.448 0.447715 170 1 170H3V204H1C0.447715 204 0 203.552 0 203V171Z" fill="var(--bezel)" />
            <path d="M1 234C1 233.448 1.44772 233 2 233H3.5V300H2C1.44772 300 1 299.552 1 299V234Z" fill="var(--bezel)" />
            <path d="M1 319C1 318.448 1.44772 318 2 318H3.5V385H2C1.44772 385 1 384.552 1 384V319Z" fill="var(--bezel)" />
            <path d="M430 279H432C432.552 279 433 279.448 433 280V384C433 384.552 432.552 385 432 385H430V279Z" fill="var(--bezel)" />
            <rect x="5" y="3" width="422" height="876" rx="70" ry="70" fill="#000" />
          </g>
          {/* antenna sliver */}
          <path opacity="0.4" d="M174 5H258V5.5C258 6.60457 257.105 7.5 256 7.5H176C174.895 7.5 174 6.60457 174 5.5V5Z" fill="var(--bezel)" />
          {/* dynamic island */}
          <path d="M154 48.5C154 38.2827 162.283 30 172.5 30H259.5C269.717 30 278 38.2827 278 48.5C278 58.7173 269.717 67 259.5 67H172.5C162.283 67 154 58.7173 154 48.5Z" fill="#0a0a0a" />
          <circle cx="259.5" cy="48.5" r="8" fill="#1a1a1a" />
          <circle cx="259.5" cy="48.5" r="3.6" fill="#2b2b2b" />
          {/* status bar */}
          <text x="61" y="55" fontSize="16" fontWeight="500" fill="var(--bezel-ink)" fontFamily="inherit">
            9:41
          </text>
          <g transform="translate(299, 41)" fill="var(--bezel-ink)">
            <rect x="0" y="11" width="3" height="3" rx="0.6" />
            <rect x="4.5" y="9" width="3" height="5" rx="0.6" />
            <rect x="9" y="6.5" width="3" height="7.5" rx="0.6" />
            <rect x="13.5" y="4" width="3" height="10" rx="0.6" />
          </g>
          <g transform="translate(322, 44)" fill="var(--bezel-ink)">
            <path d="M8 0 A10 10 0 0 1 16 4 L14.2 5.5 A7.5 7.5 0 0 0 8 2.4 A7.5 7.5 0 0 0 1.8 5.5 L0 4 A10 10 0 0 1 8 0 Z" />
            <path d="M8 3.5 A7 7 0 0 1 13 5.7 L11.3 7.2 A4.5 4.5 0 0 0 8 6 A4.5 4.5 0 0 0 4.7 7.2 L3 5.7 A7 7 0 0 1 8 3.5 Z" />
            <circle cx="8" cy="9" r="1.6" />
          </g>
          <g transform="translate(345, 41)">
            <rect x="0.5" y="0.5" width="26" height="12" rx="3.2" ry="3.2" stroke="var(--bezel-ink)" strokeOpacity="0.4" strokeWidth="1" fill="none" />
            <rect x="28" y="4.5" width="1.5" height="4" rx="0.5" fill="var(--bezel-ink)" fillOpacity="0.4" />
            <rect x="2" y="2" width="18" height="9" rx="1.6" fill="var(--bezel-ink)" />
          </g>
          {/* home indicator */}
          <rect x="149.5" y="853" width="134" height="5" rx="2.5" fill="var(--bezel-ink)" opacity="0.5" />
        </symbol>
      </defs>
    </svg>
  );
}

export function IPhone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ip ${className}`}>
      <div className="ip-screen">
        <div className="ip-app">{children}</div>
      </div>
      <svg className="ip-bezel" viewBox="0 0 433 882" aria-hidden="true">
        <use href="#iphone-frame" />
      </svg>
    </div>
  );
}

function AppHead({ address }: { address?: `0x${string}` }) {
  return (
    <div className="ip-head">
      <span className="ip-lockup">
        <PrismMark />
        <span className="ip-wordmark">
          prism<span className="ip-beta">beta</span>
        </span>
      </span>
      <span className="ip-wallet">
        <span>
          <WalletIcon />
        </span>
        {address ? short(address) : "Not connected"}
      </span>
    </div>
  );
}

function Dock({ active }: { active: "baskets" | "activity" }) {
  return (
    <nav className="ip-dock" aria-hidden="true">
      <span className="ip-dock-list">
        <span className="ip-dock-item" aria-current={active === "baskets" ? "page" : undefined}>
          <GridIcon />
          {active === "baskets" && "Baskets"}
        </span>
        <span className="ip-dock-item" aria-current={active === "activity" ? "page" : undefined}>
          <CardIcon />
          {active === "activity" && "Activity"}
        </span>
        <span className="ip-dock-item">
          <ClockIcon />
        </span>
      </span>
      <span className="ip-dock-fab">
        <PlusIcon />
      </span>
    </nav>
  );
}

const INDEX_COLORS: Record<string, string> = {
  SEMIS: "#e6e6e6",
  COMMODITIES: "#8a8a8a",
  DEGEN: "#3a3a3a",
};

/** Latest block timestamp — activity ages are measured against chain time, not the wall clock. */
function useNow() {
  const { data } = useBlock({ watch: true });
  return data ? Number(data.timestamp) : undefined;
}

const LABEL: Record<string, string> = { pSEMI: "SEMIS", pMETL: "COMMODITIES", pDGEN: "DEGEN" };

function ActivityRow({ it, now }: { it: ActivityItem; now: number | undefined }) {
  const label = LABEL[it.key] ?? it.key;
  const title =
    it.kind === "mint" ? `Minted ${it.symbol}` : it.kind === "redeem" ? `Redeemed ${it.symbol}` : `Rebalanced ${label}`;
  const sub = it.kind === "rebalance" ? "Band trigger" : `${fmtNum(it.amount, 18, 2)} ${it.symbol}`;
  const right = it.kind === "rebalance" ? `${it.sold ?? "?"}→${it.bought ?? "?"}` : `${it.kind === "mint" ? "+" : "−"}${fmtNum(it.amount, 18, 1)}`;
  return (
    <div className="ip-row ip-row-sm">
      <span className="ip-tile">
        <Tri color={INDEX_COLORS[label]} />
      </span>
      <span className="ip-row-main">
        <span className="ip-row-name">{title}</span>
        <span className="ip-row-sub">{sub}</span>
      </span>
      <span className="ip-row-amount">
        <span className="ip-row-count">
          <span className="ip-mark" />
          {right}
        </span>
        <span className="ip-row-money">{relTime(it.timestamp, now)}</span>
      </span>
    </div>
  );
}

/**
 * Dashboard screen. With a connected wallet the rows are that wallet's holdings; without one
 * they are the vaults themselves (supply and value), which is the only honest number to show.
 */
export function DashboardPhone() {
  const { indexes, hasDeployment } = useIndexes();
  const { address } = useAccount();
  const { byKey } = useUserIndexBalances(address);
  const { items: activity } = useActivity(2);
  const now = useNow();

  const mine = !!address;
  const rows = indexes.map((ix) => {
    const qty = mine ? byKey[ix.key] : ix.totalSupply;
    const usd = qty !== undefined && ix.nav !== undefined ? (qty * ix.nav) / 10n ** 18n : undefined;
    const status = ix.paused ? "paused" : ix.halted ? "stale" : ix.rebalanceNeeded ? "rebalance due" : "in band";
    return { ix, qty, usd, status, down: ix.paused || ix.halted, label: LABEL[ix.key] ?? ix.key };
  });
  const total = rows.reduce((acc, r) => acc + (r.usd ?? 0n), 0n);
  const known = rows.some((r) => r.usd !== undefined);

  return (
    <IPhone>
      <AppHead address={address} />
      <div className="ip-body">
        <div>
          <p className="ip-label">{mine ? "Your baskets" : "All baskets"}</p>
          <p className="ip-total">{hasDeployment && known ? fmtUsd(total) : "—"}</p>
          <p className="ip-sub">{hasDeployment ? `${indexes.length} indexes` : "no network"}</p>
        </div>

        <div className="ip-card">
          {rows.map((r) => (
            <div key={r.ix.key} className={`ip-row${r.down ? " ip-row-hi" : ""}`}>
              <span className="ip-tile">
                <Tri color={INDEX_COLORS[r.label]} />
              </span>
              <span className="ip-row-main">
                <span className="ip-row-name">{r.label}</span>
                <span className="ip-row-sub">{r.ix.components.length} names</span>
              </span>
              <span className="ip-row-amount">
                <span className="ip-row-big">
                  {fmtNum(r.qty, 18, 2)} <small>{r.ix.symbol}</small>
                </span>
                <span className="ip-row-money">
                  {fmtUsd(r.usd)} <span className={r.down ? "ip-down" : "ip-up"}>{r.status}</span>
                </span>
              </span>
              <ChevronIcon className="ip-chevron" />
            </div>
          ))}
          {hasDeployment && rows.length === 0 && <div className="ip-row ip-row-sm"><span className="ip-row-sub">Loading vaults…</span></div>}
        </div>

        <div className="ip-card">
          <p className="ip-card-head">Activity</p>
          {activity.length === 0 ? (
            <div className="ip-row ip-row-sm">
              <span className="ip-row-main">
                <span className="ip-row-sub">{hasDeployment ? "No mints, redeems or rebalances yet" : "Connect a network"}</span>
              </span>
            </div>
          ) : (
            activity.map((it) => <ActivityRow key={it.id} it={it} now={now} />)
          )}
        </div>
      </div>
      <Dock active="baskets" />
    </IPhone>
  );
}

/** Mint screen for pSEMI: a 1,000 USDG quote priced off live NAV and the mint fee, plus live composition. */
export function MintPhone() {
  const { indexes, hasDeployment } = useIndexes();
  const { address } = useAccount();
  const { items: activity } = useActivity(1);
  const now = useNow();
  const ix = indexes.find((i) => i.key === "pSEMI") ?? indexes[0];
  // 1,000 USDG expressed in 1e18 USD like nav(); token decimals do not enter this quote.
  const IN_USD = 1_000n * 10n ** 18n;
  const out =
    ix && ix.nav !== undefined && ix.nav > 0n
      ? (((IN_USD * BigInt(10_000 - ix.mintFeeBps)) / 10_000n) * 10n ** 18n) / ix.nav
      : undefined;
  const comp = ix ? [...ix.components].sort((a, b) => b.targetBps - a.targetBps) : [];
  const last = activity[0];

  return (
    <IPhone>
      <AppHead address={address} />
      <div className="ip-body">
        <div>
          <p className="ip-back">‹ Baskets</p>
          <p className="ip-title">Mint {ix?.symbol ?? "—"}</p>
        </div>

        <div className="ip-card">
          <div className="ip-row">
            <span className="ip-row-main">
              <span className="ip-row-sub">You deliver</span>
              <span className="ip-row-big ip-row-big-left">
                1,000 <small>USDG</small>
              </span>
            </span>
            <span className="ip-chip">USDG</span>
          </div>
          <div className="ip-row">
            <span className="ip-row-main">
              <span className="ip-row-sub">You receive · NAV {ix ? fmtUsd(ix.nav) : "—"}{ix ? ` · ${fmtPct(ix.mintFeeBps, 2)} fee` : ""}</span>
              <span className="ip-row-big ip-row-big-left">
                {out === undefined ? "—" : fmtNum(out, 18, 3)} <small>{ix?.symbol ?? ""}</small>
              </span>
            </span>
          </div>
        </div>

        <div className="ip-card">
          <p className="ip-card-head">Basket composition{ix && ix.totalValue > 0n ? " · live" : " · target"}</p>
          <div className="ip-comp">
            {comp.length === 0 && <span className="ip-row-sub">{hasDeployment ? "Loading…" : "Connect a network"}</span>}
            {comp.map((c) => {
              const w = ix && ix.totalValue > 0n ? c.weightBps : c.targetBps;
              return (
                <div key={c.asset}>
                  <span className="ip-comp-row">
                    <span>{c.symbol}</span>
                    <span>{fmtPct(w, 0)}</span>
                  </span>
                  <span className="ip-bar">
                    <span style={{ width: `${Math.min(100, (w / 10_000) * 400)}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ip-card">
          {last ? (
            <ActivityRow it={last} now={now} />
          ) : (
            <div className="ip-row ip-row-sm">
              <span className="ip-row-main">
                <span className="ip-row-sub">{hasDeployment ? "No activity yet — be the first mint" : "Connect a network"}</span>
              </span>
            </div>
          )}
        </div>
      </div>
      <Dock active="activity" />
    </IPhone>
  );
}
