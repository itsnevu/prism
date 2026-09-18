---
title: "Prism Is Live on Robinhood Chain. Three Baskets, Every Leg a Real Stock Token."
description: "What actually shipped, what changed from the plan, and why two names were left out of the semiconductor basket."
date: 2026-09-12
---

# Prism Is Live on Robinhood Chain. Three Baskets, Every Leg a Real Stock Token.

Prism is live on Robinhood Chain mainnet. Three index tokens, each one backed by a vault that holds real Robinhood Stock Tokens, priced by Chainlink feeds that run on the same chain, traded through Uniswap pools that already exist. Nothing in the basket is a placeholder. If you mint pSEMI, the vault goes and buys six semiconductor names on your behalf, in one transaction, and the tokens sit in a contract you can inspect.

Here is what shipped, and here is what changed on the way to shipping. The semiconductor basket was designed with eight names. It launched with six: NVDA, AMD, TSM, ASML, MU, INTC. Broadcom and Qualcomm have Stock Tokens on the chain but do not yet have a Chainlink price feed there, and Prism does not hold anything it cannot price from an oracle. A leg without a feed is a leg the vault cannot mark, cannot rebalance, and cannot redeem honestly. So they wait. When the feeds appear, the basket can be widened.

The metals basket became a commodities basket. Silver is there. Platinum and copper were in the design and are not on the chain, so the second leg is oil, through USO, which is. Seventy thirty, silver to oil. It is a smaller idea than the one we sketched and it is a real one, which is the trade we will make every time.

The degen basket changed the most. It was meant to hold memecoins. Robinhood Chain does not issue any. Rather than bridge something in and pretend, the basket holds the four Stock Tokens that trade most like memecoins: GME, MSTR, PLTR, TSLA, equal weight. Same character, same volatility, and every leg has a feed.

One more thing to know. Stock price feeds update during market hours and go quiet over the weekend. Prism's vaults treat a price as stale after eighty hours, which is a weekend plus a margin, and refuse to mint, redeem or rebalance while any leg is stale. That means there will be hours when the app tells you it cannot quote. That is not an outage. It is the vault declining to guess. You can read the exact freshness of every leg on the app page, in minutes, straight from the oracle.

Fees are a tenth of a percent to mint or redeem and half a percent a year, streamed. The first mint on mainnet was three dollars, made by us, so that every number on the page is a real number. Go and read it.
