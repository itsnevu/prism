---
title: NAV and the staleness rule
description: How the basket is priced, and why the vault would rather say nothing than guess.
order: 3
---

# NAV and the staleness rule

## How NAV is computed

Every leg is priced from the oracle and converted to USD:

```
value_i = balance_i × price_i / 10^decimals_i
```

Net asset value per token is the sum of those values divided by the tokens outstanding:

```
nav = Σ value_i × 1e18 / totalSupply
```

Nothing here is smoothed, modelled, or averaged. It is what the vault holds, at the prices the oracle published, divided by the claims against it. Before any tokens exist the vault quotes its bootstrap NAV — $238.10 for pSEMI, $33.20 for pMETL, $0.19 for pDGEN — so the first mint has a defined rate.

## Why staleness is the hard part

Prism's baskets deliberately mix assets that keep different hours. Tokenized equities close on Friday afternoon and stay shut through the weekend. Silver closes. Memecoins never sleep, not for a minute and not for a holiday. For most of any given week, a mixed basket is only partly awake.

So what price does a vault use for a stock at 3am on a Sunday?

Three answers are available, and two of them cost somebody money:

- **Carry the last known price.** Now anyone can mint against Friday's number using Monday's information. The gain is real and it comes out of everyone else in the vault.
- **Model it** from a correlated asset or an index future. Now the vault transacts at a price no market ever quoted, and the error lands on whoever is still holding.
- **Refuse to quote.** Costs convenience, during hours when the underlying market is itself shut.

Prism takes the third.

## What the rule actually does

Every price carries the timestamp it was published. A price is fresh when

```
now − updatedAt ≤ maxStaleness    and    price > 0
```

If any component fails that test, the vault reverts with `StalePrice(asset)` — naming the specific asset — and that revert propagates through everything that depends on a price: `nav()`, minting, redeeming, and rebalancing alike.

The limits are set from the market each basket trades in:

| Index | Limit | Why |
| --- | --- | --- |
| pSEMI | 26 hours | Covers a normal overnight close, with margin |
| pMETL | 72 hours | Covers a weekend |
| pDGEN | 15 minutes | The market never closes, so neither may the feed |

## What a pause looks like

The index card shows an amber banner naming the stale leg and how long the limit is. The NAV figure is replaced by the revert rather than a stale number. Buy and sell buttons are disabled.

What does **not** happen: your tokens are untouched, your exposure is untouched, and nothing is liquidated. A pause blocks new transactions, nothing else. When the oracle publishes again the index reopens on its own — there is no manual step and no admin action involved.

For interfaces, the vault exposes two non-reverting probes so a frontend can explain a pause rather than show a stack trace: `staleAsset()` returns the offending component or the zero address, and `mintRedeemOpen()` answers whether a transaction would be accepted right now.

## The owner pause is separate

The owner can also pause a vault outright. That is a different mechanism with a different banner, and unlike the staleness pause it does not clear itself.

Next: [Rebalancing](/docs/rebalancing).
