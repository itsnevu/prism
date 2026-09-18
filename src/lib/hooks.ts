"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useBlock, usePublicClient, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";

import {
  deployment,
  hasDeployment,
  IndexVaultAbi,
  IndexTokenAbi,
  MockERC20Abi,
  MockOracleAbi,
  type IndexKey,
} from "./contracts";

export type ComponentView = {
  asset: Address;
  symbol: string;
  decimals: number;
  targetBps: number;
  maxBps: number;
  /** current weight in bps (0 when value unknown) */
  weightBps: number;
  balance: bigint;
  /** oracle price, 1e18 USDG per whole unit */
  price: bigint | undefined;
  updatedAt: number | undefined;
  /** age in seconds relative to latest block timestamp */
  ageSec: number | undefined;
  fresh: boolean;
  /** USDG value of the leg, 1e18 */
  value: bigint;
};

export type IndexView = {
  key: IndexKey;
  name: string;
  vault: Address;
  token: Address;
  symbol: string;
  /** nav() result; undefined when reverted (stale) or not loaded */
  nav: bigint | undefined;
  navError: string | undefined;
  totalSupply: bigint | undefined;
  totalValue: bigint;
  paused: boolean;
  staleAsset: Address | undefined;
  /** any leg stale or owner-paused */
  halted: boolean;
  maxStaleness: number;
  bandBps: number;
  mintFeeBps: number;
  mgmtFeeBps: number;
  rebalanceNeeded: boolean | undefined;
  components: ComponentView[];
  hasDeployment: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000";
const PER_VAULT = 10;

type Contract = { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] };

function buildCalls() {
  const calls: Contract[] = [];
  if (!deployment) return calls;
  for (const ix of deployment.indexes) {
    const v = { address: ix.vault, abi: IndexVaultAbi } as const;
    calls.push(
      { ...v, functionName: "nav" },
      { ...v, functionName: "totalSupply" },
      { ...v, functionName: "paused" },
      { ...v, functionName: "staleAsset" },
      { ...v, functionName: "maxStaleness" },
      { ...v, functionName: "components" },
      { ...v, functionName: "bandBps" },
      { ...v, functionName: "mintFeeBps" },
      { ...v, functionName: "mgmtFeeBps" },
      { ...v, functionName: "rebalanceNeeded" },
    );
    for (const a of ix.assets) {
      calls.push({ address: a, abi: MockERC20Abi, functionName: "balanceOf", args: [ix.vault] });
      calls.push({ address: deployment.oracle, abi: MockOracleAbi, functionName: "getPrice", args: [a] });
    }
  }
  return calls;
}

type Res = { status: "success" | "failure"; result?: unknown; error?: Error };

function ok<T>(r: Res | undefined): T | undefined {
  return r && r.status === "success" ? (r.result as T) : undefined;
}

/** Live view of every deployed index: NAV, supply, per-leg weight/price/freshness, pause state. */
export function useIndexes(): { indexes: IndexView[]; isLoading: boolean; hasDeployment: boolean; refetch: () => void } {
  const calls = useMemo(() => buildCalls(), []);
  const { data: block } = useBlock({ watch: true, query: { enabled: hasDeployment } });
  const { data, isLoading, refetch } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: calls as any,
    allowFailure: true,
    query: { enabled: hasDeployment && calls.length > 0, refetchInterval: 6_000 },
  });

  const indexes = useMemo<IndexView[]>(() => {
    if (!deployment) return [];
    // freshness is judged against the latest block timestamp; until it loads, nothing is "fresh"
    const now = block ? Number(block.timestamp) : 0;
    const res = (data ?? []) as Res[];
    let cursor = 0;
    return deployment.indexes.map((ix) => {
      const r = (i: number) => res[cursor + i];
      const navRes = r(0);
      const nav = ok<bigint>(navRes);
      const navError = navRes?.status === "failure" ? shortErr(navRes.error) : undefined;
      const totalSupply = ok<bigint>(r(1));
      const paused = ok<boolean>(r(2)) ?? false;
      const staleRaw = ok<Address>(r(3));
      const staleAsset = staleRaw && staleRaw.toLowerCase() !== ZERO ? staleRaw : undefined;
      const maxStaleness = Number(ok<number | bigint>(r(4)) ?? 0);
      const comps = ok<readonly { asset: Address; targetWeightBps: number; maxWeightBps: number; decimals: number }[]>(r(5)) ?? [];
      const bandBps = Number(ok<number>(r(6)) ?? 0);
      const mintFeeBps = Number(ok<number>(r(7)) ?? 0);
      const mgmtFeeBps = Number(ok<number>(r(8)) ?? 0);
      const rebalanceNeeded = ok<boolean>(r(9));
      cursor += PER_VAULT;

      const components: ComponentView[] = ix.assets.map((asset, i) => {
        const balance = ok<bigint>(res[cursor + i * 2]) ?? 0n;
        const p = ok<readonly [bigint, bigint]>(res[cursor + i * 2 + 1]);
        const meta = comps.find((c) => c.asset.toLowerCase() === asset.toLowerCase());
        const decimals = meta?.decimals ?? 18;
        const price = p?.[0];
        const updatedAt = p ? Number(p[1]) : undefined;
        const ageSec = updatedAt !== undefined ? Math.max(0, now - updatedAt) : undefined;
        const staleByVault = staleAsset?.toLowerCase() === asset.toLowerCase();
        const fresh = !staleByVault && ageSec !== undefined && ageSec <= maxStaleness && (price ?? 0n) > 0n;
        const value = price ? (balance * price) / 10n ** BigInt(decimals) : 0n;
        return {
          asset,
          symbol: ix.assetSymbols[i] ?? short(asset),
          decimals,
          targetBps: meta?.targetWeightBps ?? 0,
          maxBps: meta?.maxWeightBps ?? 0,
          weightBps: 0,
          balance,
          price,
          updatedAt,
          ageSec,
          fresh,
          value,
        };
      });
      cursor += ix.assets.length * 2;

      const totalValue = components.reduce((s, c) => s + c.value, 0n);
      if (totalValue > 0n) {
        for (const c of components) c.weightBps = Number((c.value * 10_000n) / totalValue);
      }

      return {
        key: ix.key,
        name: ix.name,
        vault: ix.vault,
        token: ix.token,
        symbol: ix.key,
        nav,
        navError,
        totalSupply,
        totalValue,
        paused,
        staleAsset,
        halted: paused || !!staleAsset || components.some((c) => !c.fresh),
        maxStaleness,
        bandBps,
        mintFeeBps,
        mgmtFeeBps,
        rebalanceNeeded,
        components,
        hasDeployment: true,
      };
    });
  }, [data, block]);

  return { indexes, isLoading, hasDeployment, refetch: () => void refetch() };
}

export type UserIndexBalance = { key: IndexKey; token: Address; balance: bigint | undefined };

/** Index-token balances of `address` for every deployed index. */
export function useUserIndexBalances(address: Address | undefined): {
  balances: UserIndexBalance[];
  byKey: Record<IndexKey, bigint | undefined>;
  isLoading: boolean;
  refetch: () => void;
} {
  const ixs = useMemo(() => deployment?.indexes ?? [], []);
  const { data, isLoading, refetch } = useReadContracts({
    contracts: ixs.map((ix) => ({
      address: ix.token,
      abi: IndexTokenAbi,
      functionName: "balanceOf" as const,
      args: [address ?? ZERO] as const,
    })),
    allowFailure: true,
    query: { enabled: hasDeployment && !!address, refetchInterval: 6_000 },
  });
  // Without a connected wallet there is no balance to report. Defaulting to 0n here would render a
  // confident "0 pSEMI" for a question nobody asked — undefined means unknown, and the UI shows "—".
  const balances = useMemo<UserIndexBalance[]>(
    () => ixs.map((ix, i) => ({ key: ix.key, token: ix.token, balance: address ? ok<bigint>((data as Res[] | undefined)?.[i]) : undefined })),
    [data, ixs, address],
  );
  const byKey = { pSEMI: undefined, pMETL: undefined, pDGEN: undefined } as Record<IndexKey, bigint | undefined>;
  for (const b of balances) byKey[b.key] = b.balance;
  return { balances, byKey, isLoading, refetch: () => void refetch() };
}

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortErr(e: Error | undefined) {
  if (!e) return "reverted";
  const m = e.message.match(/StalePrice\(([^)]+)\)/);
  if (m) return `StalePrice(${short(m[1])})`;
  return e.message.split("\n")[0].slice(0, 80);
}

/* ------------------------------------------------------------------ activity (vault events) */

export type ActivityKind = "mint" | "redeem" | "rebalance";
export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  key: IndexKey;
  symbol: string;
  /** index tokens moved (mint/redeem), 1e18 */
  amount: bigint | undefined;
  /** rebalance: sold → bought asset symbols */
  sold?: string;
  bought?: string;
  blockNumber: bigint;
  timestamp: number | undefined;
};

/**
 * Recent vault activity read straight from logs: MintedWithUSDG / RedeemedForUSDG /
 * Rebalanced across every deployed vault, newest first. Polls with the block watcher so a
 * fresh mint shows up within a block or two. Empty (not fake) when no deployment is reachable.
 */
export function useActivity(limit = 8): { items: ActivityItem[]; isLoading: boolean } {
  const client = usePublicClient();
  const { data: block } = useBlock({ watch: true, query: { enabled: hasDeployment } });
  const ixs = useMemo(() => deployment?.indexes ?? [], []);
  const assetSymbol = useMemo(() => {
    const m = new Map<string, string>();
    for (const ix of ixs) ix.assets.forEach((a, i) => m.set(a.toLowerCase(), ix.assetSymbols[i] ?? short(a)));
    return m;
  }, [ixs]);

  const { data, isLoading } = useQuery({
    queryKey: ["activity", block?.number?.toString() ?? "0", limit],
    enabled: hasDeployment && !!client && !!block,
    staleTime: 5_000,
    queryFn: async () => {
      if (!client) return [];
      const latest = block?.number ?? 0n;
      // Local chains are short; on a long chain only scan the last ~50k blocks per refresh.
      const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;
      const out: ActivityItem[] = [];
      const blocks = new Map<bigint, number>();
      const tsOf = async (n: bigint) => {
        const hit = blocks.get(n);
        if (hit !== undefined) return hit;
        const b = await client.getBlock({ blockNumber: n });
        blocks.set(n, Number(b.timestamp));
        return Number(b.timestamp);
      };
      for (const ix of ixs) {
        const logs = await client.getContractEvents({
          address: ix.vault,
          abi: IndexVaultAbi,
          fromBlock,
          toBlock: latest,
        });
        for (const l of logs) {
          const name = l.eventName as string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = l.args as any;
          let item: ActivityItem | undefined;
          if (name === "MintedWithUSDG") item = { id: `${l.transactionHash}:${l.logIndex}`, kind: "mint", key: ix.key, symbol: ix.key, amount: a.indexAmount, blockNumber: l.blockNumber, timestamp: undefined };
          else if (name === "RedeemedForUSDG") item = { id: `${l.transactionHash}:${l.logIndex}`, kind: "redeem", key: ix.key, symbol: ix.key, amount: a.indexAmount, blockNumber: l.blockNumber, timestamp: undefined };
          else if (name === "Rebalanced") item = { id: `${l.transactionHash}:${l.logIndex}`, kind: "rebalance", key: ix.key, symbol: ix.key, amount: undefined, sold: assetSymbol.get(String(a.sold).toLowerCase()), bought: assetSymbol.get(String(a.bought).toLowerCase()), blockNumber: l.blockNumber, timestamp: undefined };
          if (item) out.push(item);
        }
      }
      out.sort((x, y) => (y.blockNumber > x.blockNumber ? 1 : y.blockNumber < x.blockNumber ? -1 : 0));
      const top = out.slice(0, limit);
      for (const it of top) it.timestamp = await tsOf(it.blockNumber);
      return top;
    },
  });

  return { items: data ?? [], isLoading };
}

/** "Just now", "4 min ago", "Tue" — relative to the latest block, not the wall clock. */
export function relTime(ts: number | undefined, now: number | undefined) {
  if (ts === undefined || !now) return "—";
  const d = Math.max(0, now - ts);
  if (d < 60) return "Just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86_400) return `${Math.floor(d / 3600)} h ago`;
  return new Date(ts * 1000).toLocaleDateString("en-US", { weekday: "short" });
}
