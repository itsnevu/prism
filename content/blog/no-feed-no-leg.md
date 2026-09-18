---
title: "No Feed, No Leg"
description: "The one rule that decides what goes in a Prism basket, and why it cost the semiconductor index two names at launch."
date: 2026-09-14
---

# No Feed, No Leg

There are a hundred and ninety four Robinhood Stock Tokens on Robinhood Chain as of this week. Thirty five of them have a Chainlink price feed on the chain. Prism baskets are drawn from the thirty five, and only the thirty five, and this post is about why that rule is worth the names it costs.

An index vault does three things with a price. It marks the basket, which is how it knows what a share is worth and therefore how many shares to give you when you mint. It decides whether to rebalance, by comparing what each leg is worth against what it should be. And it protects holders during trades, by refusing to complete a rebalance that lost more than the cap. All three of those depend on the price being something the contract can read, on-chain, at the moment it needs it, from a source that does not belong to us.

A Stock Token without a feed fails all three at once. The vault could use the pool price from Uniswap, and some protocols do, but a pool price is whatever the last trade was, and the last trade can be a manipulation, a fat finger, or simply nothing for six hours. The vault could use a price we push from a server, and that is worse, because then the basket is worth whatever we say it is worth, and the entire point of putting this on a chain is that it is not.

So the rule is simple. A leg needs a Chainlink feed on Robinhood Chain or it does not ship. Broadcom and Qualcomm were in the semiconductor design. They are real Stock Tokens with real Uniswap liquidity. They do not have feeds yet, so the index launched with six names instead of eight, and the weights were redistributed across the six. It is a smaller basket. It is also a basket where every number the app shows you was produced by an oracle rather than by us.

The same rule is why there are no memecoins in the degen basket, and why the metals basket is silver and oil rather than silver, platinum and copper. In each case the honest answer to what else could go in here was nothing yet.

When a feed appears for a name we want, the basket does not change under you. A Prism vault's component list is fixed at creation, so widening the semiconductor index means launching a new index with eight legs and letting holders move across if they want the wider one. That is deliberate. The basket you bought is the basket you hold, and nobody, including us, can quietly swap a leg in or out after the fact. Until then, the rule holds. No feed, no leg.
