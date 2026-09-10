---
title: "Prism Capital: Tokenized Index Baskets with Honest Pricing"
description: "The design, mechanics, and failure modes of the Prism index vault — NAV, creation and redemption, the staleness rule, and the on-chain weight solver."
date: 2026-09-10
---

# Prism Capital

**A tokenized index vault for assets that do not keep the same hours.**

Version 1.0 · September 2026

---

## Abstract

Prism issues an ERC-20 token whose value is a pro-rata claim on a basket of tokenized assets held in a vault. Anyone can create tokens by delivering the basket, and anyone can redeem them for the basket back. Nothing about that is novel; it is how an exchange-traded fund has worked for thirty years, and it is the mechanism that keeps such a token's price tethered to the value of what it holds.

What is new is the constraint. Prism's baskets deliberately mix assets that trade on different clocks: tokenized equities that close on Friday afternoon, commodity products that also close, and memecoins that never stop. A basket that spans all three is, for most of any given week, only partly awake. The central design decision in this paper is what the vault does during those hours, and the answer is that it does nothing. When any leg of a basket lacks a fresh price, the vault names the stale asset and refuses to quote a net asset value at all. Creation and redemption pause. Existing holders keep their exposure. Nobody transacts against a number no market is willing to honour.

Everything else in the system follows from taking that refusal seriously.

---

## 1. Motivation

Expressing a thematic view is easy to state and expensive to execute. Deciding that semiconductors will outperform is one judgement; turning it into a position means choosing constituents, choosing weights, paying a spread on each one, and then — the part almost nobody does — trimming the winners and topping up the laggards as the weights drift.

That last step is what separates an index from a pile of correlated tickers. A twenty percent position that outperforms the basket by half becomes a twenty-six percent position without anyone touching it. Left alone for long enough, a thematic basket stops being a bet on a theme and becomes a bet on whichever constituent ran hardest. Index providers solve this with a published rulebook and a trading desk. Individuals solve it by not solving it, because on any single occasion the rebalance costs more than it visibly returns, and the cost of skipping compounds quietly instead.

Prism packages the rulebook. One token, one position, weights maintained by contract rather than by memory.

---

## 2. System overview

Four contracts, none of them upgradeable.

| Contract | Responsibility |
| --- | --- |
| `IndexVault` | Holds the basket, prices it, issues and burns the index token, rebalances. |
| `IndexToken` | ERC-20 (with Permit). Mint and burn are restricted to its vault. |
| `IndexFactory` | Deploys vaults and keeps the registry: `allIndexes()`, `vaultBySymbol()`. |
| `VaultDeployer` | Holds `IndexVault`'s creation code so the factory fits under EIP-170. |

Two interfaces describe everything the vault expects from the outside world:

- `IPriceOracle.getPrice(asset) → (price1e18, updatedAt)` — a USD price scaled to 18 decimals, and the timestamp it was published. The vault never asks *why* a price is what it is; it only asks how old it is.
- `ISwapExecutor.swap(tokenIn, amountIn, tokenOut, minAmountOut, recipient)` — an adapter over whatever venue exists on the target chain. The vault transfers the input to the executor and expects at least `minAmountOut` of the output back.

A vault is configured once, at construction, with its components and their target and maximum weights, a staleness limit, a rebalance band, a bootstrap NAV, its fees, and its risk parameters. Target weights and risk parameters can be changed later by the owner; the component set cannot. A basket is what it was born as.

### 2.1 Configuration guards

The constructor rejects a configuration it cannot honour, because a vault is immutable and there is no fixing it afterwards:

- target weights must sum to exactly 10,000 bps;
- no target may exceed its own cap;
- no duplicate components, no zero addresses;
- fees must sit under the hard ceilings (`MAX_MGMT_FEE_BPS` = 500, `MAX_MINT_FEE_BPS` = 200);
- **USDG may not be a basket component.** USDG is the settlement asset for the single-asset entry route. If it were also a leg, the USDG a minter delivers would register as an increase in basket value and mint shares against itself. The constructor reverts `UsdgCannotBeComponent`.

---

## 3. Valuation

### 3.1 Net asset value

The value of a single leg is its balance converted to 18-decimal USD at the oracle price:

```
value_i = balance_i × price_i / 10^decimals_i
```

Total value is the sum over the components, and NAV per index token is that total divided by supply:

```
totalValue = Σ value_i
nav        = totalValue × 1e18 / totalSupply
```

When supply is zero the vault returns `initialNav1e18`, a bootstrap price chosen at deployment so the first mint has a defined exchange rate. Every one of these reads enforces freshness, so `nav()` is not a best-effort number: it either reflects live prices for every leg or it reverts.

### 3.2 The staleness rule

Each vault carries a `maxStaleness`. A price is fresh if

```
block.timestamp - updatedAt ≤ maxStaleness  and  price > 0
```

If any component fails that test, `freshPrice` reverts `StalePrice(asset)` — naming the specific asset — and the revert propagates through `nav()`, `totalValue()`, `mint`, `redeem`, `mintWithUSDG`, `redeemForUSDG`, and every rebalance path.

The staleness limits are set per basket, from the market each basket actually trades in:

| Index | Composition | Staleness limit | Rationale |
| --- | --- | --- | --- |
| pSEMI | 8 tokenized semiconductor equities | 26 hours | Spans a normal overnight close plus margin. |
| pMETL | Silver, platinum, copper miners | 72 hours | Spans a weekend. |
| pDGEN | 4 memecoins | 15 minutes | The market never closes, so neither may the feed. |

The alternative designs all lose money for somebody. Carrying the last known price lets a counterparty mint against Friday's number using Monday's information. Extrapolating from a correlated asset invents a price nobody quoted. Both externalise the error onto everyone else in the vault. Pausing externalises nothing; it costs convenience, and only during hours when the underlying market is itself unavailable.

For interfaces, the vault also exposes non-reverting probes — `staleAsset()` returns the first stale component or the zero address, and `mintRedeemOpen()` reports whether a transaction would be accepted — so a frontend can explain a pause instead of showing an error.

---

## 4. Creation and redemption

### 4.1 In kind: deliver the basket

`mint(indexAmount, to)` takes the basket and issues tokens. The amount owed per leg is pro-rata against current holdings, rounded **up**:

```
amount_i = ceil(balance_i × indexAmount / supply)
```

Before any supply exists, the amounts come from target weights and the bootstrap NAV instead. `redeem(indexAmount, to)` is the mirror image, rounded **down**, returning the assets themselves rather than their cash value.

Rounding always favours the vault. The minter pays a fraction of a unit more than exact, the redeemer receives a fraction less, and the difference stays with the remaining holders. This is deliberate: over many operations NAV per token ratchets very slightly upward and never leaks downward, which is the direction an error should point.

### 4.2 Why this defends the price

Because creation and redemption are open to anyone, a gap between the token's market price and the value of its basket is an arbitrage rather than a grievance. If pSEMI trades at 250 while its basket is worth 238, anyone can buy the components, mint, sell the token, and keep the difference — and will, until the premium closes. A discount closes from the other side through redemption. The peg is maintained by whoever wants to be paid for noticing it, not by a treasury and not by a market maker on retainer.

This is also why redemption returns *assets* and not cash. A redemption that pays out cash at an internally computed price is a promise. A redemption that hands over the tokens themselves is a fact.

### 4.3 In USDG: single-asset entry

Delivering eight assets in exact proportions is the correct primitive, but it is not what a first-time buyer should have to do. `mintWithUSDG(usdgIn, minIndexOut, to)` collapses it into one transaction:

1. Read `navBefore` and `valueBefore` while every leg is fresh.
2. Pull `usdgIn` from the caller.
3. Split it across the components **by target weight** and buy each leg through the swap executor. The last leg absorbs the rounding remainder, so no USDG is stranded.
4. Measure what actually arrived: `valueAdded = totalValue() − valueBefore`.
5. Issue `gross = valueAdded × 1e18 / navBefore`, take the mint fee, and revert `SlippageExceeded` if the net is below `minIndexOut`.
6. Re-check every weight cap.

Step 4 is the load-bearing one. Shares are issued against value the vault can *see*, not against the USDG that was handed over. A poor fill therefore reduces what the minter receives and leaves NAV per token untouched, which means slippage is borne by the person who caused it rather than socialised across existing holders. `minIndexOut` bounds how poor a fill the minter is willing to accept.

Because the split follows target weights, entering also nudges the basket back toward its intended shape — inflows do part of the rebalancing work for free.

`redeemForUSDG(indexAmount, minUsdgOut, to)` runs the reverse: compute the pro-rata basket, burn, sell each leg to USDG through the executor, and transfer the measured proceeds, reverting if they fall short of `minUsdgOut`.

Both routes are strictly optional. If the executor is unset or the venue is bad, the in-kind path still works and touches no external contract.

### 4.4 Fees

| Fee | Rate on the live baskets | Ceiling | Mechanism |
| --- | --- | --- | --- |
| Mint / redeem | 10 bps | 200 bps | Charged in index tokens to `feeRecipient` on both directions. |
| Management | 50 bps / year | 500 bps | Streamed continuously as newly minted index tokens. |

The management fee accrues by time, not by event: `pendingManagementFee()` is `totalSupply × mgmtFeeBps × elapsed / (10000 × 1 year)`, and `accrueFee()` mints it. It is called at the start of every mint and redeem so that the supply a user transacts against is always current, and it is settled at the old rate before any fee change takes effect.

---

## 5. Rebalancing

### 5.1 When

Weights drift as prices move. A vault defines a band — 300 bps for the equity and metals baskets, 500 bps for memecoins — and `rebalanceNeeded()` is true once any leg sits outside its target ± band. Trading inside the band is not free discipline; it is churn that burns spread for no change in exposure.

### 5.2 The solver

`previewRebalance(slippageBps)` computes the trade plan on chain. It prices every leg, expresses each one's distance from its target as a surplus or a deficit in USD, and then greedily matches the largest surplus against the largest deficit, netting both down and repeating. Imbalances smaller than `MIN_TRADE_BPS` (10 bps of the basket) are left alone, because dust is not worth gas. Settling *n* legs never needs more than *n* trades.

Each planned trade carries a floor: the output must be at least what the oracle implies, less the caller's `slippageBps` tolerance. A venue worse than that tolerance fails the trade rather than executing it.

`rebalanceToTarget(slippageBps)` solves and executes in a single keeper call. The older `rebalance(...)` entry point, which takes an explicit list of pairs, remains for cases where an operator wants to override the solver.

### 5.3 Guards

Every rebalance path is bounded by four independent conditions, each of which reverts rather than warns:

- **Authorisation** — owner or an approved keeper only.
- **Venue** — trades route exclusively through the owner-approved `swapExecutor`.
- **NAV loss ceiling** — NAV is measured before and after; a drop beyond `maxRebalanceLossBps` (100 bps, or 150 for pDGEN) reverts the whole operation.
- **Weight caps** — after trading, no leg may exceed its `maxWeightBps`.
- **Cooldown** — a minimum interval between rebalances (6 hours, 1 hour for pDGEN) prevents thrashing between two assets that keep trading places.

Caps deserve emphasis because they are the structural protection against a basket quietly becoming a single-name bet. In pSEMI no leg may exceed 30% whatever happens to prices; in pDGEN the caps are tightest of all, because a memecoin basket is a different animal and pretending otherwise is how people get hurt.

---

## 6. Trust assumptions

Being explicit about what must be trusted is more useful than claiming nothing must be.

**The oracle is trusted for price.** The vault verifies freshness and non-zero, nothing more. A compromised or wrong oracle misprices creation and redemption. Mitigations are structural rather than cryptographic: staleness limits bound how old a manipulation can be, and the NAV-loss guard bounds what a single rebalance can destroy. A production deployment should use a feed with its own aggregation and deviation controls.

**The swap executor is trusted with the assets it is handed.** During a rebalance or a USDG-routed entry the vault transfers tokens to the executor before receiving anything back. A malicious executor could keep them. The executor is set by the owner and should be a thin, audited adapter over a specific venue. The in-kind mint and redeem paths never touch it at all, which is why they remain the primitive.

**The owner is trusted with parameters, not with funds.** The owner can pause, change target weights within existing caps, set risk parameters and fees under hard-coded ceilings, appoint keepers, and replace the oracle or executor. The owner **cannot** withdraw the basket, mint tokens directly, add or remove components, or raise fees above the contract ceilings. Ownership belongs on a multisig; the production deployment script refuses to run until one is configured.

**Tokens are assumed to be well-behaved ERC-20s** — no transfer fees, no rebasing. Tokenized equity and stablecoin issuers do not generally do these things, but a basket must not include one that does.

---

## 7. Verification

The contracts ship with 62 Foundry tests: unit coverage of every guard, fuzz tests, and five invariants exercised over 128,000 random call sequences each. The invariants hold prices flat and switch the management fee off, which isolates the property under test — whether entering and leaving can move value that does not belong to the person moving it.

- **NAV never falls.** With prices flat, a decline in NAV per token means someone extracted more than their share.
- **NAV does not inflate.** The opposite failure: shares issued against value that was never delivered.
- **Supply priced at NAV equals the basket.** The token is a claim on what is actually held.
- **No USDG is stranded.** The vault settles the single-asset routes straight through and never sits on a balance.
- **Caps hold.** No sequence of user activity pushes a leg past its ceiling.

A sixth check asserts the run was not vacuous — that the sequences genuinely executed mints and buys rather than reverting throughout, which is the standard way an invariant suite passes while testing nothing.

The frontend is covered separately by browser tests that drive a real wallet against a local chain: connect, approve, buy with USDG, sell back, mint in kind, and confirm that a stale feed pauses the interface rather than quoting a guess.

None of this is a substitute for an external audit, and Prism has not had one.

---

## 8. Limitations and open work

**No audit.** The contracts have been reviewed internally and tested as described above. They have not been audited by a third party and must not hold real money until they have been.

**The target chain is unresolved.** Prism is written for a chain with tokenized equities, a USD stablecoin, a price oracle, and a swap venue. Robinhood Chain is the intended home and has not published an RPC endpoint, a chain id, or asset addresses. Nothing in the code names a network: deployment is a configuration file plus a preflight that refuses to broadcast while any address is still unset.

**The price keeper is a demo.** The local keeper republishes existing prices to keep feeds fresh. A production keeper must source from real feeds, and the staleness rule means the vault's availability depends on it.

**Single-venue routing.** The USDG routes execute against one executor with no splitting or path-finding. That is adequate for launch and a real limitation on size.

**Governance is a multisig, not a protocol.** Weight changes are an owner action. A published methodology and a delay on parameter changes are the obvious next step.

---

## 9. What comes next

The three live baskets are a proof, not the product. They were chosen to test the machine against three different clocks: equities that close, a metal that closes, and memecoins that never do. What generalises is the vault, which does not care what it holds.

The near work is breadth — more themes, each a configuration rather than a rebuild — and then handing over the pen, so that anyone can define an index, publish it, and earn a share of the fees when other people hold it. Three baskets curated by a team is a product. A thousand baskets curated by a market is an asset class.

The ambition underneath is unchanged: having an investment idea should not require becoming an operations department to act on it. You should be able to buy the idea.

**One token. The whole theme.**
