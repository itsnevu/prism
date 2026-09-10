import { defineChain } from "viem";
import { anvil as anvilBase } from "viem/chains";

/**
 * Chain config is entirely env-driven so the same build can point at anvil, a testnet, or
 * Robinhood Chain. Set these in `.env.local` (see `.env.example`):
 *
 *   NEXT_PUBLIC_CHAIN         "local" (default) | "target"
 *   NEXT_PUBLIC_CHAIN_ID      decimal chain id of the target chain
 *   NEXT_PUBLIC_CHAIN_NAME    display name
 *   NEXT_PUBLIC_RPC_URL       RPC endpoint
 *   NEXT_PUBLIC_EXPLORER_URL  block explorer base URL (optional)
 *   NEXT_PUBLIC_NATIVE_SYMBOL native currency symbol (default ETH)
 *
 * Nothing here is hardcoded to a specific network: Robinhood Chain has not published an RPC or a
 * chain id, so pointing at it is a config change, not a code change.
 */

const env = {
  chain: process.env.NEXT_PUBLIC_CHAIN ?? "local",
  id: process.env.NEXT_PUBLIC_CHAIN_ID,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME,
  rpc: process.env.NEXT_PUBLIC_RPC_URL,
  explorer: process.env.NEXT_PUBLIC_EXPLORER_URL,
  symbol: process.env.NEXT_PUBLIC_NATIVE_SYMBOL,
};

/** Local Anvil (chain id 31337). */
export const anvil = defineChain({
  ...anvilBase,
  rpcUrls: { default: { http: [env.rpc ?? "http://127.0.0.1:8545"] } },
});

/** True once a real chain id and RPC have been supplied. */
export const targetConfigured = env.chain === "target" && !!env.id && !!env.rpc;

/**
 * The production target. Until NEXT_PUBLIC_CHAIN_ID / NEXT_PUBLIC_RPC_URL are set this is a
 * placeholder that is never selected — `activeChain` stays on anvil.
 */
export const targetChain = defineChain({
  id: Number(env.id ?? 0) || 1_337_000,
  name: env.name ?? "Target Chain",
  nativeCurrency: { name: env.symbol ?? "Ether", symbol: env.symbol ?? "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env.rpc ?? "http://127.0.0.1:8545"] } },
  ...(env.explorer
    ? { blockExplorers: { default: { name: "Explorer", url: env.explorer } } }
    : {}),
  testnet: process.env.NEXT_PUBLIC_CHAIN_TESTNET !== "false",
});

/** @deprecated kept as an alias while the target chain is unnamed. */
export const robinhoodChain = targetChain;

export const chains = [anvil, targetChain] as const;

export const activeChain = targetConfigured ? targetChain : anvil;

export function explorerAddressUrl(address: string): string | undefined {
  const base = activeChain.blockExplorers?.default.url;
  return base ? `${base.replace(/\/$/, "")}/address/${address}` : undefined;
}
