---
title: "One Transaction, and a Vault That Solves Its Own Weights"
description: "Two things shipped that change what using Prism actually costs you: single-asset entry, and rebalancing the vault computes for itself."
date: 2026-09-10
---

# One Transaction, and a Vault That Solves Its Own Weights

Until this week, buying a Prism index meant doing the thing Prism exists to spare you. To mint pSEMI you had to hold all eight semiconductor tokens, in the right proportions, and approve each one — eight signatures before the ninth that actually bought anything. The vault was correct. The experience was a joke at the vault's expense.

Two things shipped that fix it. Neither is clever, and the reason both took a while is that the obvious implementations quietly move money from one group of users to another.

## Buying with USDG, without taxing everyone else

The new route is one transaction: hand over USDG, receive index tokens. Underneath, the vault splits your USDG across the basket by target weight, buys every leg through the swap venue, and issues your tokens. One approval for USDG, then a single signature per trade forever after.

The interesting part is the accounting. The naive version issues tokens for the USDG you sent — you send 250 USDG, NAV is 238, you get 1.05 tokens. It reads fine and it is wrong, because the vault does not receive 250 dollars of assets. It receives whatever the venue actually filled, which is less. The difference gets made up out of the basket, which means every existing holder pays a small tax on your bad fill.

So Prism does not price your mint off what you sent. It reads the basket's value before the swaps, runs them, reads it again, and issues tokens against the difference — the value that demonstrably arrived. A poor fill now costs the person who caused it. NAV per token does not move. And `minIndexOut` lets you cap how poor a fill you are willing to accept, so a genuinely bad venue reverts instead of filling.

There is a free side effect. Because your USDG is split by *target* weight rather than current weight, every purchase pushes the basket slightly back toward the shape it is supposed to have. Inflows do part of the rebalancing work at no cost to anyone.

Selling runs the same machinery backwards, and the in-kind route — deliver the basket yourself, no venue involved — is still there, untouched. It remains the primitive the whole design rests on. It is just no longer the only door.

## The vault now works out its own trades

Rebalancing used to require a keeper to name the pairs: sell this much of that, buy that much of this. Fine for a demo, brittle as a process, and it put judgement in exactly the place you do not want judgement.

The vault now computes the plan itself. `previewRebalance` prices every leg, expresses each one's distance from target as a surplus or a deficit in dollars, and greedily matches the biggest surplus against the biggest deficit until nothing meaningful is left — ignoring anything under 0.1% of the basket, because dust is not worth gas. Settling eight legs never takes more than eight trades. `rebalanceToTarget` solves and executes in one call.

Pushing NVDA from $182 to $280 on a local chain takes its weight from 20.0% to 27.7% and the basket out of band. The solver produces seven trades. Afterwards the weights read 20.00, 10.99, 13.99, 15.99, 9.99, 8.99, 9.99, 9.99 percent, and the vault reports itself back in band.

Every guard that applied to the manual path still applies: keeper-only, one approved venue, a NAV-loss ceiling that reverts the whole operation, weight caps enforced afterwards, and a cooldown so it cannot thrash. The solver decides *what* to trade. It gained no authority to decide *whether* it is allowed to.

## What we found while checking

Two things worth writing down, because both were real.

The first: nothing stopped USDG from being configured as a basket leg. It never was, but if it had been, the USDG a minter delivers would have registered as an increase in basket value — the vault would have counted your own deposit as a gain and minted free shares against it. The constructor now rejects that configuration outright. A vault is immutable; a bad basket definition has to be caught before it exists, not after.

The second was in the interface. A transaction that lands and reverts still returns a perfectly good receipt, so the button sat on "Confirming…" forever and never told anyone what happened. It now reads the receipt status and says so.

We also added five invariants that hammer the vault with 128,000 random sequences of mints, redeems, buys and sells with prices held flat, and assert the property that matters: NAV per token can ratchet up — rounding always favours the vault — but it may never fall. A fall would mean someone extracted more than their share.

None of that is an audit, and Prism has not had one. It is not deployed to a live network either. But the machinery is now the machinery we described, rather than the machinery we intended.

Read the [whitepaper](/whitepaper) for the full design, or the [docs](/docs) for how to use it.
