---
title: What Prism is
description: One token that holds a whole basket, and what that gets you.
order: 1
---

# What Prism is

Prism turns a theme into a single token. You buy one thing; underneath, a vault holds the whole basket at defined weights and keeps it there.

A Prism index token is not a wrapper around a promise. It is a **pro-rata claim on assets held in a vault**, and anyone can take delivery of them at any moment. That one property is what makes the price honest: if the token ever trades above what its basket is worth, anyone can buy the components, create new tokens, and sell them until the gap closes. If it trades below, redemption closes it from the other side.

## The three live baskets

| Index | Holds | Staleness limit | Rebalance band |
| --- | --- | --- | --- |
| **pSEMI** | 8 semiconductor equities — NVDA, TSM, AVGO, AMD, QCOM, INTC, ASML, MU | 26 hours | ±3% |
| **pMETL** | Silver, platinum, copper miners | 72 hours | ±3% |
| **pDGEN** | 4 memecoins, equally weighted | 15 minutes | ±5% |

They were chosen to prove the machinery against three different clocks: equities that close overnight, a metal that closes for the weekend, and memecoins that never stop. The product is not the three baskets — it is the vault that makes any basket possible.

## What you get

- **One position instead of eight.** One thing to buy, one thing to sell, one line in your portfolio, one cost basis.
- **The weights you intended, maintained.** A 20% leg that outruns the basket becomes a 26% leg on its own. The vault trims it back; you do not have to remember to.
- **A token you can verify and exit.** Every holding, weight, price and drift is readable on chain, and redemption is open to anyone. If you doubt what you hold, take delivery of it.
- **A refusal to guess.** When any leg has no fresh price, the vault names it and pauses rather than quoting a number no market will honour. See [NAV and the staleness rule](/docs/nav-and-staleness).

## What it is not

It is not a fund and there is no manager taking discretion. It is not a promise of return — prices go down as well as up, and a basket of eight falling assets falls. It is not audited yet, and it is not deployed to a live network. See [Risks](/docs/risks).

Next: [Buying and selling](/docs/buying).
