---
title: Contracts
description: What each contract does, the functions worth knowing, and how to run the whole thing locally.
order: 5
---

# Contracts

Four contracts, none upgradeable, no proxies.

| Contract | Responsibility |
| --- | --- |
| `IndexVault` | Holds the basket, prices it, mints and burns the index token, rebalances. |
| `IndexToken` | ERC-20 with Permit. Only its vault may mint or burn. |
| `IndexFactory` | Deploys vaults and keeps the registry — `allIndexes()`, `vaultBySymbol()`. |
| `VaultDeployer` | Holds `IndexVault`'s creation code so the factory stays under the 24 KB contract size limit. |

Two interfaces cover everything external: `IPriceOracle.getPrice(asset) → (price1e18, updatedAt)` and `ISwapExecutor.swap(tokenIn, amountIn, tokenOut, minAmountOut, recipient)`.

## Reading a vault

Every one of these reverts `StalePrice(asset)` if a leg has gone stale, except the probes.

| Function | Returns |
| --- | --- |
| `nav()` | NAV per index token, 18 decimals |
| `totalValue()` | Value of the whole basket |
| `components()` | Each leg: asset, target weight, cap, decimals |
| `currentWeightsBps()` | Live weights, same order |
| `rebalanceNeeded()` | Whether any leg is outside its band |
| `staleAsset()` | First stale leg, or the zero address — **does not revert** |
| `mintRedeemOpen()` | Whether a transaction would be accepted — **does not revert** |
| `previewMint(amount)` / `previewRedeem(amount)` | Basket owed or returned, per leg |
| `previewMintWithUSDG(usdgIn)` / `previewRedeemForUSDG(amount)` | Oracle-priced estimate for the single-asset routes |
| `pendingManagementFee()` | Fee shares that would be minted right now |

## Writing to a vault

| Function | Who | Notes |
| --- | --- | --- |
| `mint(amount, to)` | anyone | Deliver the basket; requires an approval per component |
| `redeem(amount, to)` | anyone | Returns the assets themselves |
| `mintWithUSDG(usdgIn, minIndexOut, to)` | anyone | One transaction; reverts `SlippageExceeded` under the floor |
| `redeemForUSDG(amount, minUsdgOut, to)` | anyone | The reverse |
| `accrueFee()` | anyone | Settles the streamed management fee |
| `rebalanceToTarget(slippageBps)` | keeper | Solves and executes |
| `rebalance(sell[], sellAmts[], buy[], buyAmts[])` | keeper | Explicit pairs, for manual override |
| `setTargetWeights`, `setRiskParams`, `setFeeParams`, `setKeeper`, `setOracle`, `setSwapExecutor`, `pause`, `unpause` | owner | Bounded by hard-coded ceilings |

The owner **cannot** withdraw the basket, mint tokens directly, change the component set, or raise fees past the in-contract ceilings (5%/yr management, 2% mint).

## Errors worth recognising

| Error | Meaning |
| --- | --- |
| `StalePrice(asset)` | That leg has no fresh price; the index is paused |
| `SlippageExceeded(got, minOut)` | The fill came in under your floor; nothing moved |
| `WeightAboveCap(asset, weight, cap)` | The operation would push a leg past its ceiling |
| `RebalanceLossTooHigh(before, after)` | The rebalance would have cost more NAV than permitted |
| `CooldownActive(availableAt)` | Too soon since the last rebalance |
| `NothingToRebalance` | Every leg is inside its band |
| `UsdgCannotBeComponent` | Rejected at construction: USDG may not be a basket leg |

## Deployed addresses

Prism is not deployed to a live network yet. The target chain has not published an RPC endpoint, a chain id, or asset addresses, and nothing in the code names a network — pointing at one is configuration, not a code change. Addresses will be published here when they exist.

## Running it locally

```bash
npm install
npm run chain          # anvil on 127.0.0.1:8545
npm run deploy:local   # deploys mocks, oracle, factory, and the three indexes
npm run dev            # http://localhost:3000/app

npm run keeper             # keep oracle feeds fresh
npm run keeper:rebalance   # and solve rebalances as weights drift
```

The local deployment uses mock tokens and an owner-controlled oracle, so you can push a price and watch the basket drift, or mark a feed stale and watch the index pause.

## Tests

```bash
npm run contracts:test   # 62 Foundry tests: unit, fuzz, and invariants
npm run test:e2e         # browser wallet flow against a throwaway chain
npm run contracts:sizes  # contract size headroom
```

The invariant suite runs 128,000 random call sequences per property, holding prices flat, and asserts that NAV per token can only ratchet up and never leak down. The browser tests drive a real injected wallet — connect, approve, buy, sell, mint in kind — so the interface is verified against a chain rather than mocked.

Next: [Risks](/docs/risks).
