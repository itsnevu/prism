// Local oracle heartbeat / price pusher.
// Keeps every basket leg fresh so vaults don't pause on staleness during a demo.
//   node scripts/keeper.mjs                 # refresh every 30s, prices unchanged
//   node scripts/keeper.mjs --drift 0.4     # ±0.4% random walk per tick
//   node scripts/keeper.mjs --interval 10   # tick every 10s
//   node scripts/keeper.mjs --once          # single push, then exit
//   node scripts/keeper.mjs --rebalance     # also solve + execute rebalances when legs drift
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
// anvil account #0 — the deployer, which owns MockOracle.
const PRIVATE_KEY =
  process.env.KEEPER_PRIVATE_KEY ??
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const intervalMs = Number(flag("interval", 30)) * 1000;
const driftPct = Number(flag("drift", 0));
const once = flag("once", false) === true;
const doRebalance = flag("rebalance", false) === true;
// Tolerance handed to the on-chain solver for each trade's minOut floor.
const rebalanceSlippageBps = Number(flag("rebalance-slippage", 50));

const dep = JSON.parse(readFileSync(resolve(root, "contracts/deployments/local.json"), "utf8"));
const oracle = dep.oracle;

// Unique assets across every deployed index.
const assets = [];
const labels = new Map();
if (dep.usdg) {
  // USDG is not a basket leg, but the swap executor quotes against it — keep it fresh too.
  assets.push(dep.usdg);
  labels.set(dep.usdg, "USDG (peg)");
}
for (const key of Object.keys(dep)) {
  const ix = dep[key];
  if (!ix || typeof ix !== "object" || !Array.isArray(ix.assets)) continue;
  ix.assets.forEach((a, i) => {
    if (labels.has(a)) return;
    labels.set(a, `${ix.assetSymbols?.[i] ?? a} (${key})`);
    assets.push(a);
  });
}
if (assets.length === 0) {
  console.error("no assets found in contracts/deployments/local.json — run npm run deploy:local");
  process.exit(1);
}

const vaults = [];
for (const key of Object.keys(dep)) {
  const ix = dep[key];
  if (ix && typeof ix === "object" && ix.vault) vaults.push({ key, vault: ix.vault });
}

const vaultAbi = [
  { type: "function", name: "rebalanceNeeded", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "previewRebalance",
    stateMutability: "view",
    inputs: [{ name: "slippageBps", type: "uint16" }],
    outputs: [
      { name: "sellAssets", type: "address[]" },
      { name: "sellAmts", type: "uint256[]" },
      { name: "buyAssets", type: "address[]" },
      { name: "buyAmts", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "rebalanceToTarget",
    stateMutability: "nonpayable",
    inputs: [{ name: "slippageBps", type: "uint16" }],
    outputs: [{ name: "swaps", type: "uint256" }],
  },
];

const oracleAbi = [
  {
    type: "function",
    name: "getPrice",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "price1e18", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "setPrices",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "address[]" },
      { name: "prices", type: "uint256[]" },
    ],
    outputs: [],
  },
];

const account = privateKeyToAccount(PRIVATE_KEY);
const chain = { id: dep.chainIdNum, name: dep.network ?? "local", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } };
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

function jitter(price) {
  if (!driftPct) return price;
  const bps = BigInt(Math.round((Math.random() * 2 - 1) * driftPct * 100));
  return price + (price * bps) / 10000n;
}

/// Ask each vault's on-chain solver for a plan and execute it when there is one. Cooldowns and the
/// NAV-loss guard live in the contract, so a rejected attempt is logged and skipped, never retried
/// blindly.
async function rebalanceTick() {
  for (const { key, vault } of vaults) {
    try {
      const needed = await publicClient.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: "rebalanceNeeded",
      });
      if (!needed) continue;
      const plan = await publicClient.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: "previewRebalance",
        args: [rebalanceSlippageBps],
      });
      if (plan[0].length === 0) continue;
      const hash = await walletClient.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "rebalanceToTarget",
        args: [rebalanceSlippageBps],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  rebalanced ${key}: ${plan[0].length} swap(s)  ${hash.slice(0, 10)}`);
    } catch (e) {
      const msg = e.shortMessage ?? e.message;
      // CooldownActive / NothingToRebalance are normal — the guard did its job.
      console.log(`  ${key} rebalance skipped: ${msg.split("\n")[0].slice(0, 100)}`);
    }
  }
}

async function tick() {
  const prices = [];
  for (const asset of assets) {
    const [price] = await publicClient.readContract({
      address: oracle,
      abi: oracleAbi,
      functionName: "getPrice",
      args: [asset],
    });
    prices.push(jitter(price));
  }
  const hash = await walletClient.writeContract({
    address: oracle,
    abi: oracleAbi,
    functionName: "setPrices",
    args: [assets, prices],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  const stamp = new Date().toISOString().slice(11, 19);
  const sample = assets
    .slice(0, 3)
    .map((a, i) => `${labels.get(a).split(" ")[0]} $${Number(formatUnits(prices[i], 18)).toFixed(2)}`)
    .join("  ");
  console.log(`[${stamp}] pushed ${assets.length} feeds  ${sample}${assets.length > 3 ? "  …" : ""}  ${hash.slice(0, 10)}`);
  if (doRebalance) await rebalanceTick();
}

console.log(
  `keeper → oracle ${oracle} on ${RPC_URL}\n` +
    `  ${assets.length} feeds · every ${intervalMs / 1000}s · drift ±${driftPct}%${once ? " · single shot" : ""}` +
    (doRebalance ? `\n  auto-rebalance on · ${vaults.length} vaults · ${rebalanceSlippageBps} bps tolerance` : ""),
);

await tick();
if (!once) {
  setInterval(() => {
    tick().catch((e) => console.error("tick failed:", e.shortMessage ?? e.message));
  }, intervalMs);
}
