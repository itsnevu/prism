---
title: "A Rebalance Is a Trade, and Trades Cost Money"
description: "Why Prism's vaults rebalance rarely, inside a band, with a loss cap, instead of chasing target weights every block."
date: 2026-09-13
---

# A Rebalance Is a Trade, and Trades Cost Money

Every index has target weights and every index drifts away from them. NVDA runs, and the thirty percent you meant to hold becomes thirty six. The textbook answer is to rebalance: sell some NVDA, buy the laggards, restore the weights. The textbook rarely mentions that each of those sells and buys is a trade against a real pool with a real fee and real slippage, and that a vault which rebalances every time it drifts a little will slowly bleed itself to death in fees while looking very disciplined.

Prism's vaults have three rules to stop that, and all three are on-chain parameters you can read.

The first is a band. A leg has to drift more than three percentage points from its target before the vault considers it out of band at all. Five for the degen basket, because those names move more and reacting to every move would be expensive. Inside the band, nothing happens, no matter how untidy the weights look.

The second is a cooldown. Once a rebalance has run, another one cannot run for six hours. Markets overreact, then correct. A vault that trades the overreaction and then trades the correction has paid twice to end up where it started.

The third is a loss cap. Before a rebalance executes, the vault computes the basket's value at oracle prices. After the trades, it computes it again. If the trades cost more than one percent of the basket, one and a half for degen, the whole rebalance reverts. Slippage on an illiquid pool, a stale quote, a bad route: whatever the cause, the vault refuses to complete a rebalance that made holders poorer than the drift did.

There is a fourth thing that is not a rule but a design choice. When you mint with USDG, the vault splits your dollars across the legs by target weight, not by current weight. If NVDA is overweight, your mint buys proportionally less of it. Every mint nudges the basket back toward target for free, because the trade was going to happen anyway. Most of the time this is enough and the keeper never has to rebalance at all.

The result is a vault that will sometimes show you weights that are a little off, with a label that says in band. That is not a bug or laziness. It is the vault having done the arithmetic and concluded that fixing it would cost more than leaving it. You can check the arithmetic yourself: the preview is a view function and the app runs it before every keeper decision.
