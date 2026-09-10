# 🔺 Prism Capital — Index / Basket

> Satu token, seluruh pasar.

## Apa ini
Kamu beli **1 token**, langsung dapat eksposur ke banyak aset sekaligus —
tokenized stocks + silver + memecoin — dengan **auto-rebalance**.

## Analogi nama
1 cahaya masuk → pecah jadi spektrum.
1 deposit → menyebar ke banyak aset.

## Produk
Index bertema:
- **Semis** — `pSEMI` (NVDA, AMD, AVGO, TSM, ASML, MU, QCOM, INTC)
- **Metals** — `pMETL` (SLV 70%, PPLT 15%, COPX 15%)
- **Degen Basket** — `pDGEN` (DOGE, SHIB, PEPE, WIF · 25% each, 35% cap, 15-min staleness)

## Buat siapa
Orang yang mau diversifikasi tanpa ribet milih aset satu-satu.

## Struktur
- `docs/` — catatan produk & desain
- `contracts/` — Foundry protocol (see below)
- `src/` — Next.js app (`/` landing, `/app` live dashboard + mint/redeem)
- `scripts/sync-abi.mjs` — copies ABIs + deployment addresses into `src/lib/generated/`

---

## Protocol (contracts/)

| Contract | Role |
| --- | --- |
| `IndexVault` | One per index. Holds the basket, prices it via the oracle, mints/burns the `IndexToken`. Pro-rata `mint`/`redeem`, `nav()`, drift-band `rebalanceNeeded()`, keeper `rebalance()` through an owner-approved `ISwapExecutor`, streaming management fee, mint/redeem fee, `Pausable` + `ReentrancyGuard`. |
| `IndexToken` | 18-dec ERC20 (+Permit); mint/burn only by its vault. |
| `IndexFactory` | Registry: `createIndex()`, `allIndexes()`, `vaultBySymbol()`. |
| `VaultDeployer` | Holds `IndexVault`'s creation code so the factory stays under the 24 KB EIP-170 limit. |
| `IPriceOracle` / `MockOracle` | `getPrice(asset) → (price1e18, updatedAt)`. Mock is owner-set and can `markStale`. |
| `ISwapExecutor` / `MockSwapExecutor` | Rebalance venue. Mock swaps at oracle price minus configurable slippage. |
| `MockERC20` | Configurable decimals, open mint. Stands in for USDG and every tokenized asset. |

**Staleness rule.** `nav()`, `mint`, `redeem` and `rebalance` all revert `StalePrice(asset)` if any leg's `updatedAt` is older than `maxStaleness`. The basket pauses instead of guessing. `staleAsset()` / `mintRedeemOpen()` are non-reverting probes for UIs. Owner can additionally `pause()`.

**Fees.** `mintFeeBps` (default 10) on mint and redeem, paid in index tokens to `feeRecipient`. `mgmtFeeBps` (default 50 / yr) streamed as newly minted index tokens on `accrueFee()` (called inside mint/redeem). Both capped in-contract.

**Rebalance guards.** Post-trade NAV may not drop more than `maxRebalanceLossBps`; every weight must stay ≤ its `maxWeightBps`; `rebalanceCooldown` between runs; only owner/keepers; only through the owner-set `swapExecutor`.

**Single-asset entry / exit.** `mintWithUSDG(usdgIn, minIndexOut, to)` pulls USDG, splits it across the basket by target weight through the owner-approved `ISwapExecutor`, and mints at NAV from the value the swaps *measurably* added — so slippage is borne by the minter, never by existing holders, and `minIndexOut` bounds it. `redeemForUSDG` is the mirror image. `previewMintWithUSDG` / `previewRedeemForUSDG` give UIs an oracle-priced estimate to derive `minOut` from. Delivering the basket directly (`mint`/`redeem`) still works and skips the venue entirely.

**Weight solver.** `previewRebalance(slippageBps)` computes the trade plan on-chain — every leg's drift from target becomes a surplus or a deficit, and the largest surplus is greedily matched against the largest deficit until nothing above 0.1% of the basket is left. `rebalanceToTarget(slippageBps)` executes that plan in one keeper call under the same guards as the manual pairwise `rebalance()`.

**Site.** `/` landing · `/app` the index app · `/docs` six pages on how it works · `/whitepaper` the full design · `/blog`. All prose lives in `content/` as Markdown with frontmatter and is rendered by `src/lib/markdown.tsx` straight into React elements — no `dangerouslySetInnerHTML`. Adding a page is adding a file.

**Testing.** `npm run contracts:test` runs 62 Foundry tests — unit, fuzz, and five invariants that hammer the vault with 128,000 random user actions each and assert NAV per token can only ratchet up, never leak. `npm run test:e2e` runs ten browser tests in Chromium against a throwaway anvil: an injected EIP-1193 wallet exercises connect → approve → mint/redeem end to end rather than mocked, and the prose pages are checked for real Markdown structure and for internal links that 404. Neither is a substitute for an audit.

**Deploying for real.** Nothing is hardcoded to a network. Fill in `contracts/script/config/ProductionConfig.sol` (USDG, oracle, swap venue, multisig owner, fee recipient, keeper, and the real token address for every basket leg), then `npm run deploy:check` — a preflight that reverts `NotConfigured`, `WeightsDoNotSum`, `NoOraclePrice` or `OraclePriceStale` rather than half-deploying. `npm run deploy:production` broadcasts and writes `contracts/deployments/production.json`. Point the frontend at it with the env vars in `.env.example`.

```bash
cd contracts
~/.foundry/bin/forge build
~/.foundry/bin/forge test -vvv      # 62 tests: unit, fuzz, and invariants
~/.foundry/bin/forge build --sizes  # EIP-170 headroom
```

## Dev — local chain → deploy → sync → app

```bash
npm install
npm run chain            # 1. anvil on 127.0.0.1:8545 (chain id 31337), keep running
                         #    (port busy? ANVIL_PORT=8548 npm run chain, then RPC_URL=http://127.0.0.1:8548 npm run deploy:local
                         #     and NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8548 npm run dev)
npm run deploy:local     # 2. deploys mocks + oracle + factory + pSEMI/pMETL/pDGEN, seeds prices,
                         #    mints assets to deployer & anvil #1, one initial mint per index,
                         #    writes contracts/deployments/local.json, then runs abi:sync
npm run abi:sync         # 3. (re-run any time) → src/lib/generated/{abis,deployments}.ts
npm run dev              # 4. http://localhost:3000  ·  dashboard at /app
```

Connect an injected wallet on chain 31337 (import Anvil account #1
`0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` — it holds every asset).
On `/app`: approve each component → Mint; or Redeem. Values refresh every 6 s.

Config is swappable: `NEXT_PUBLIC_CHAIN=robinhood` + `NEXT_PUBLIC_RPC_URL` select the placeholder
`robinhoodChain` in `src/lib/chain.ts`; the deployment manifest is only used when its chain id matches.

### Simulate a stale leg (cast)
```bash
export PATH=$HOME/.foundry/bin:$PATH; R=http://127.0.0.1:8545
V=$(jq -r .pSEMI.vault contracts/deployments/local.json); O=$(jq -r .oracle contracts/deployments/local.json)
NVDA=$(jq -r .pSEMI.assets[0] contracts/deployments/local.json)
cast call $V 'nav()(uint256)' --rpc-url $R                                   # live NAV
cast send $O 'markStale(address,uint256)' $NVDA 100000 --rpc-url $R \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
cast call $V 'nav()(uint256)' --rpc-url $R                                   # reverts StalePrice(NVDA)
cast send $O 'refresh(address)' $NVDA --rpc-url $R --private-key 0xac09…ff80  # reopen
```

Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4 + wagmi 3 / viem 2 · Foundry 1.7 + OpenZeppelin 5.
