---
title: Buying and selling
description: Two routes in and out — one transaction with USDG, or deliver the basket yourself.
order: 2
---

# Buying and selling

There are two ways in, and the same two ways out. They settle into the same vault and the same token; they differ in what you hand over and how many approvals it costs you.

## With USDG — one transaction

Pick an index, choose **With USDG**, enter an amount. The vault pulls your USDG, splits it across the basket by target weight, buys every leg through the swap venue, and issues you tokens — all in one transaction. Selling runs the same machinery backwards and pays you in USDG.

You approve USDG once. After that, buying and selling is a single signature each.

### Slippage

The quote you see is priced from the oracle with no slippage. The real fill goes through a venue, so the transaction carries a floor: **you receive at least the quote less your chosen tolerance, or the transaction reverts and nothing moves.** The tolerance selector offers 0.1%, 0.5% and 1%; the interface shows the exact floor under the quote.

Reverting is the desired behaviour. A transaction that fails costs you gas; a transaction that fills badly costs you the difference.

### Why buying with USDG does not dilute anyone

The vault does not issue you tokens for the USDG you sent. It issues them for the value that **actually arrived in the basket**, measured after the swaps complete, divided by NAV. If the venue fills badly, you get fewer tokens — the cost lands on you, not on existing holders. That is the whole reason the accounting is done this way.

A useful side effect: because your USDG is split by *target* weight, buying nudges the basket back toward its intended shape. Inflows do part of the rebalancing work for free.

## With the basket — deliver it yourself

Choose **With the basket** and the form shows exactly how much of each component you owe, pro-rata against what the vault currently holds. Approve each one, then mint. Redeeming returns your slice of every asset — the assets themselves, not their cash value.

This route touches no external venue, so there is no slippage and nothing to tolerate. It costs one approval per component. It is the primitive the whole design rests on, and it stays available even if the swap venue does not.

## Fees

| Fee | Rate | Paid how |
| --- | --- | --- |
| Mint and redeem | 0.10% | In index tokens, on both directions |
| Management | 0.50% / year | Streamed continuously in index tokens |

A round trip therefore costs about 0.20% in fees plus whatever the venue charges on each side. There is no spread taken by Prism, no performance fee, and no exit penalty.

## When you cannot transact

If any leg of the basket has no fresh price, mint and redeem are paused for that index and the interface says which asset went stale. Your tokens and your exposure are unaffected — only new transactions are blocked, and only until the feed publishes again. This is deliberate; see [NAV and the staleness rule](/docs/nav-and-staleness).

Next: [NAV and the staleness rule](/docs/nav-and-staleness).
