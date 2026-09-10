import { formatUnits } from "viem";

export function fmtUsd(v: bigint | undefined, decimals = 18, digits = 2) {
  if (v === undefined) return "—";
  const n = Number(formatUnits(v, decimals));
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toLocaleString("en-US", { maximumSignificantDigits: 3 })}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function fmtNum(v: bigint | undefined, decimals = 18, digits = 4) {
  if (v === undefined) return "—";
  const n = Number(formatUnits(v, decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function fmtPct(bps: number, digits = 1) {
  return `${(bps / 100).toFixed(digits)}%`;
}

export function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}
