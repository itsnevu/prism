import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { injectedWalletScript } from "./wallet";

/**
 * The one thing `cast` could not prove: that a person with a wallet can actually do this in a
 * browser. Every write below goes through wagmi, the real ABIs, and a real transaction on anvil —
 * only the assertions talk to the chain directly, so a green run means the UI really moved tokens.
 */

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
// anvil account #1 — the deploy script funds it with USDG and every basket component.
const ACCOUNT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
// anvil account #0 — deployer, and owner of the mock oracle.
const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const deployment = JSON.parse(
  readFileSync(resolve(__dirname, "../contracts/deployments/local.json"), "utf8"),
);

async function rpc(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result!;
}

const pad = (hex: string) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");

/** balanceOf(address), read straight from the chain to check the UI against the truth. */
async function tokenBalance(token: string, who = ACCOUNT): Promise<bigint> {
  return BigInt(await rpc("eth_call", [{ to: token, data: `0x70a08231${pad(who)}` }, "latest"]));
}

/** Rewind a feed's timestamp so the vault sees it as stale. */
async function markStale(asset: string, ageSeconds: number) {
  const data = `0x16454e5a${pad(asset)}${pad(ageSeconds.toString(16))}`;
  await rpc("eth_sendTransaction", [{ from: DEPLOYER, to: deployment.oracle, data }]);
}

/** Re-stamp a feed to now. */
async function refresh(asset: string) {
  await rpc("eth_sendTransaction", [
    { from: DEPLOYER, to: deployment.oracle, data: `0x0afb0409${pad(asset)}` },
  ]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(injectedWalletScript(RPC_URL, ACCOUNT, "0x7a69")); // 31337
  page.on("pageerror", (e) => console.error("page error:", e.message));
});

async function connect(page: Page) {
  await page.goto("/app");
  const button = page.getByRole("button", { name: "Connect wallet" });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("button", { name: "Disconnect wallet" })).toBeVisible();
}

const card = (page: Page, key: string) => page.getByTestId(`index-${key}`);

/** Wait for the USDG route's quote to actually resolve — "—" means the read is still in flight. */
async function waitForQuote(scope: ReturnType<typeof card>) {
  await expect(scope.getByText(/You receive ≈/)).toBeVisible();
  await expect(scope.getByText("—", { exact: true })).toHaveCount(0, { timeout: 15_000 });
}

/**
 * Click a submit button and wait for the transaction to actually change something.
 *
 * Waiting for the "Confirming…" state to appear is unreliable: on a fast chain the transaction can
 * come and go between polls, and on a slow runner the click can land on a node React is about to
 * replace and quietly do nothing. Both look identical from the outside. So this waits on the
 * *effect* instead, and only clicks again if nothing happened at all.
 */
async function submitUntil(
  scope: ReturnType<typeof card>,
  name: RegExp,
  landed: () => Promise<boolean>,
  attempts = 3,
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await scope.getByRole("button", { name }).click();

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (await landed()) return;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error(`clicking ${name} never took effect`);
}

/**
 * Click an approval and wait for the allowance read to catch up. The button only appears once the
 * batched preview/allowance read resolves, so we wait for it rather than sampling once — sampling
 * is what made this flaky.
 */
async function approveIfNeeded(scope: ReturnType<typeof card>, name: string | RegExp, done: RegExp) {
  const approve = scope.getByRole("button", { name }).first();
  const settled = scope.getByRole("button", { name: done }).first();

  await expect(approve.or(settled).first()).toBeVisible({ timeout: 30_000 });
  if (!(await approve.isVisible())) return false;

  await approve.click();
  await expect(settled).toBeVisible({ timeout: 30_000 });
  return true;
}

test("wallet connects and the app reads live vault state", async ({ page }) => {
  await connect(page);

  await expect(page.getByRole("navigation").getByText("0x7099…79C8")).toBeVisible();
  // NAV is quoted from the chain, not a placeholder
  await expect(card(page, "pSEMI").getByText(/^\$2\d\d\.\d\d$/).first()).toBeVisible();
  await expect(page.getByText("No deployment found")).toHaveCount(0);
});

test("a leg sitting on its target is not labelled with a signed zero", async ({ page }) => {
  await page.goto("/app");
  const semis = card(page, "pSEMI");
  await expect(semis.getByText("on target").first()).toBeVisible();
  // "+0.0%" and "-0.0%" are the same number wearing two different signs
  await expect(page.getByText(/^[+\u2212-]0\.0%$/)).toHaveCount(0);
});

test("buying an index with USDG works end to end in the browser", async ({ page }) => {
  await connect(page);
  const semis = card(page, "pSEMI");
  const before = await tokenBalance(deployment.pSEMI.token);

  await semis.getByRole("tab", { name: "With USDG" }).click();
  await semis.getByRole("button", { name: "buy", exact: true }).click();
  await semis.getByLabel("USDG amount").fill("250");

  // the quote has to resolve before the button means anything
  await waitForQuote(semis);

  await approveIfNeeded(semis, "Approve USDG", /^Buy pSEMI with USDG$/);
  await submitUntil(
    semis,
    /^Buy pSEMI with USDG$/,
    async () => (await tokenBalance(deployment.pSEMI.token)) > before,
  );

  // 250 USDG at a NAV near $238 buys about one token — assert the magnitude, not a number that
  // would break the moment the seeded price changes.
  const got = Number((await tokenBalance(deployment.pSEMI.token)) - before) / 1e18;
  expect(got).toBeGreaterThan(0.5);
  expect(got).toBeLessThan(2);
});

test("selling back to USDG works end to end in the browser", async ({ page }) => {
  await connect(page);
  const semis = card(page, "pSEMI");

  const held = await tokenBalance(deployment.pSEMI.token);
  test.skip(held < 10n ** 17n, "nothing to sell — the buy test seeds this balance");

  await semis.getByRole("tab", { name: "With USDG" }).click();
  await semis.getByRole("button", { name: "sell", exact: true }).click();
  await semis.getByLabel("index amount").fill("0.1");
  await waitForQuote(semis);

  const usdgBefore = await tokenBalance(deployment.usdg);
  await submitUntil(
    semis,
    /^Sell pSEMI for USDG$/,
    async () => (await tokenBalance(deployment.pSEMI.token)) < held,
  );
  expect(await tokenBalance(deployment.usdg)).toBeGreaterThan(usdgBefore);
});

test("minting by delivering the basket walks through the per-leg approvals", async ({ page }) => {
  await connect(page);
  const metals = card(page, "pMETL");
  const before = await tokenBalance(deployment.pMETL.token);

  await metals.getByRole("tab", { name: "With the basket" }).click();
  await metals.getByLabel("amount").fill("2");

  // one approval per component — exactly what the basket route costs the user
  for (const symbol of deployment.pMETL.assetSymbols as string[]) {
    const button = metals.getByTestId(`approve-${symbol}`);
    const badge = metals.getByTestId(`approved-${symbol}`);
    await expect(button.or(badge).first()).toBeVisible({ timeout: 30_000 });
    if (await badge.isVisible()) continue;
    await button.click();
    await expect(badge).toBeVisible({ timeout: 30_000 });
  }

  await expect(metals.getByRole("button", { name: /^Mint / })).toBeEnabled({ timeout: 30_000 });
  await submitUntil(metals, /^Mint /, async () => (await tokenBalance(deployment.pMETL.token)) > before);
});

test("a stale leg pauses the index instead of quoting a guess", async ({ page }) => {
  // pDGEN's staleness limit is 15 minutes; rewind its feed and the vault must refuse to quote.
  const asset = deployment.pDGEN.assets[0] as string;
  await markStale(asset, 3_600);

  try {
    await connect(page);
    const degen = card(page, "pDGEN");
    await expect(degen.getByText(/Mint & redeem paused/)).toBeVisible({ timeout: 30_000 });
    await degen.getByRole("tab", { name: "With USDG" }).click();
    await expect(degen.getByRole("button", { name: "Paused — stale leg" })).toBeDisabled();

    // and it comes back on its own once the oracle publishes again
    await refresh(asset);
    await expect(degen.getByText(/Mint & redeem paused/)).toBeHidden({ timeout: 30_000 });
  } finally {
    await refresh(asset);
  }
});
