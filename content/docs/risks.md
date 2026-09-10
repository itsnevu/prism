---
title: Risks
description: What can go wrong, what is trusted, and what has not been done yet.
order: 6
---

# Risks

Read this before you use anything here with money.

## Prism is not audited

The contracts have been reviewed internally and tested hard — 62 tests including invariants over 128,000 random call sequences. They have **not** been audited by a third party. Testing shows the presence of correct behaviour under the cases you thought of; an audit is how you find the ones you did not. Until that happens, treat this as unaudited software.

## It is not deployed

There is no live deployment. The target chain has not published an RPC endpoint, a chain id, or the addresses of the tokenized assets the baskets need. Anything you run today is a local chain with mock tokens.

## Market risk is the ordinary kind

An index token tracks the value of its basket. A basket of eight falling assets falls. Diversification across one theme is not diversification across risk — pSEMI is eight ways to be exposed to semiconductors, and they will mostly move together. The memecoin basket is speculative by construction; the tighter weight caps bound concentration, not loss.

## The oracle is trusted for price

The vault checks that a price is fresh and non-zero. It does not, and cannot, check that it is *right*. A wrong or manipulated feed misprices creation and redemption. What bounds it: staleness limits cap how old a manipulation can be, and the NAV-loss ceiling caps what a single rebalance can destroy. A production deployment needs a feed with its own aggregation and deviation controls.

## The swap venue is trusted with what it is handed

When you buy with USDG, or when a rebalance runs, the vault sends tokens to the swap executor before receiving anything back. A malicious executor could keep them. The executor is set by the owner and should be a thin adapter over one specific venue.

The in-kind route — delivering the basket yourself — never touches it. That is why it remains the primitive, and why it stays available even if the venue does not.

## The owner has real power, bounded

The owner can pause an index, change target weights within existing caps, adjust risk parameters and fees under hard ceilings, appoint keepers, and replace the oracle or the swap executor. Replacing the oracle is the sharpest of these.

The owner **cannot** withdraw the basket, mint tokens directly, add or remove components, or raise fees above the in-contract ceilings. Ownership belongs on a multisig, and the production deployment script refuses to run until one is configured.

## Pauses are a real cost

The staleness rule means an index is unavailable while any of its legs has no fresh price — over a weekend, that is most of it for pSEMI and pMETL. You cannot buy or sell during a pause. Your holdings are unaffected, but the ability to act is genuinely suspended, and if the price keeper fails the pause lasts until it is fixed.

## Liquidity and size

The USDG routes execute against a single venue with no order splitting or path-finding. Large orders will move the price against themselves. Set a slippage tolerance you are willing to live with, and prefer the in-kind route for size.

## Rounding is not neutral

Minting rounds the basket you owe **up**; redeeming rounds what you receive **down**. The difference stays with the remaining holders. It is a fraction of a unit per operation and it always points the same way — in favour of the vault, never out of it. This is intentional, and it means very small mints and redeems are proportionally worse for you than large ones.

## Nothing here is advice

Prism is software for holding a basket. It is not investment advice, not a recommendation, and not a promise of any outcome.
