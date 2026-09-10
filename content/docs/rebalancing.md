---
title: Rebalancing
description: Bands, the on-chain weight solver, and the four guards that bound every trade.
order: 4
---

# Rebalancing

## Why weights drift

A basket set to 20% NVDA does not stay at 20%. If NVDA outruns the rest of the basket by half, that leg becomes roughly 26% of the basket without anyone doing anything. Left alone for long enough, a thematic index stops being a bet on the theme and becomes a bet on whichever constituent ran hardest.

Restoring the intended shape means selling some of what went up and buying what did not. That is the entire job, and it is unglamorous enough that almost nobody does it by hand.

## When the vault acts

Not on every wiggle. Each index defines a **band** — ±3% for pSEMI and pMETL, ±5% for pDGEN — and `rebalanceNeeded()` turns true only once some leg sits outside its target plus or minus that band. Trading inside the band burns spread without changing your exposure in any way you would notice.

## The solver

`previewRebalance(slippageBps)` computes the plan on chain, in one view call:

1. Price every leg and express its distance from target as a **surplus** or a **deficit**, in dollars.
2. Match the largest surplus against the largest deficit, and net both down.
3. Repeat until nothing meaningful is left.
4. Ignore any imbalance under 0.1% of the basket — dust is not worth gas.

Settling *n* legs never takes more than *n* trades. `rebalanceToTarget(slippageBps)` runs the solver and executes the plan in a single keeper transaction.

A worked example from the local chain: NVDA is pushed from $182 to $280, taking its weight from 20.0% to 27.7% and the whole basket out of band. The solver produces seven trades. Afterwards the weights read 20.00 / 10.99 / 13.99 / 15.99 / 9.99 / 8.99 / 9.99 / 9.99 percent, and `rebalanceNeeded()` is false again.

## The four guards

Every rebalance is bounded, and each condition **reverts** rather than warning:

- **Who** — the owner or an approved keeper. Nobody else.
- **Where** — trades route only through the owner-approved swap executor.
- **How much it may cost** — NAV is measured before and after. A drop beyond the loss ceiling (1%, or 1.5% for pDGEN) reverts the entire operation, every trade in it.
- **What it may produce** — after trading, no leg may exceed its maximum weight.

Plus a **cooldown** — six hours, one hour for pDGEN — so the vault cannot thrash between two assets that keep trading places.

Each planned trade also carries its own floor: the output must beat the oracle-implied amount less the caller's tolerance. A venue worse than that fails the trade instead of executing it. In practice the per-trade floor catches a bad venue first, and the NAV ceiling catches the case where many individually-acceptable trades add up to an unacceptable loss.

## Weight caps

Caps are the structural protection, and they apply whether or not a rebalance ever runs. No pSEMI leg may exceed 30% of the basket; pDGEN's caps are the tightest of the three, because a memecoin basket is a different animal and pretending otherwise is how people get hurt. A cap breach reverts a rebalance and blocks a USDG-routed entry that would cause it.

## Who runs it

A keeper — an off-chain process that watches for drift and calls `rebalanceToTarget`. It holds no funds and has no authority beyond triggering a rebalance that the contract would have permitted anyway. Every guard above applies to it exactly as it applies to the owner. Locally, `npm run keeper:rebalance` runs one.

Next: [Contracts](/docs/contracts).
