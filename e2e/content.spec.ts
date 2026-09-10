import { test, expect, type Page } from "@playwright/test";

/**
 * Prose pages: docs, whitepaper, blog, legal. These need no wallet and no chain — what they need is
 * to actually render the Markdown and to not link anywhere that 404s. `LINKS.blog` pointed at a
 * route that did not exist for a while, which is exactly the failure this catches.
 */

test("docs index lists every section and each one opens", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1, name: "Docs" })).toBeVisible();

  const cards = page.locator("main ul li a[href^='/docs/']");
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(5);

  const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  for (const href of hrefs) {
    const res = await page.goto(href);
    expect(res?.status(), `${href} should render`).toBe(200);
    await expect(page.locator("article h1")).toBeVisible();
  }
});

test("a docs page renders markdown structure, not raw text", async ({ page }) => {
  await page.goto("/docs/nav-and-staleness");

  await expect(page.locator("article h1")).toHaveText("NAV and the staleness rule");
  await expect(page.locator("article h2").first()).toBeVisible();
  // fenced code blocks became <pre>, not paragraphs of backticks
  await expect(page.locator("article pre code")).not.toHaveCount(0);
  await expect(page.locator("article pre code", { hasText: "maxStaleness" })).toHaveCount(1);
  // the staleness table became a real table
  await expect(page.locator("article table")).toBeVisible();
  await expect(page.locator("article table tbody tr")).toHaveCount(3);
  await expect(page.getByText("```")).toHaveCount(0);
  await expect(page.getByText("| ---")).toHaveCount(0);

  // section nav marks the current page and moves to the next one
  await expect(page.locator("nav[aria-label='Docs sections'] a[aria-current='page']")).toHaveText(
    "NAV and the staleness rule",
  );
  await page.getByRole("link", { name: /^Next/ }).click();
  await expect(page.locator("article h1")).toHaveText("Rebalancing");
});

test("whitepaper renders with a working table of contents", async ({ page }) => {
  await page.goto("/whitepaper");
  await expect(page.locator("article h1")).toContainText("Prism Capital");

  const toc = page.getByRole("navigation", { name: "On this page" });
  await expect(toc).toBeVisible();
  await expect(toc.locator("a")).not.toHaveCount(0);

  // every ToC entry points at a heading that exists on the page
  const targets = await toc.locator("a").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  for (const target of targets) {
    await expect(page.locator(`article ${target}`)).toHaveCount(1);
  }

  await expect(page.locator("article table").first()).toBeVisible();
  await expect(page.locator("article pre").first()).toBeVisible();
});

test("blog lists posts and a post renders", async ({ page }) => {
  await page.goto("/blog");
  const posts = page.locator("main ul li a[href^='/blog/']");
  await expect(posts).toHaveCount(2);

  await posts.first().click();
  await expect(page.locator("article h1")).toBeVisible();
  await expect(page.locator("article p").first()).not.toBeEmpty();
  await expect(page.getByRole("link", { name: "← Blog" })).toBeVisible();
});

/** Collect every same-origin link on a page. */
async function internalLinks(page: Page): Promise<string[]> {
  return page.locator("a[href^='/']").evaluateAll((els) =>
    Array.from(new Set(els.map((e) => e.getAttribute("href")!.split("#")[0]).filter((h) => h.length > 0))),
  );
}

test("no internal link on the site 404s", async ({ page }) => {
  const seen = new Set<string>();
  const queue = ["/", "/docs", "/whitepaper", "/blog", "/terms", "/privacy"];

  while (queue.length > 0) {
    const href = queue.shift()!;
    if (seen.has(href)) continue;
    seen.add(href);

    const res = await page.goto(href);
    expect(res?.status(), `${href} is linked but does not render`).toBe(200);

    for (const link of await internalLinks(page)) {
      if (!seen.has(link)) queue.push(link);
    }
  }

  // sanity: the crawl actually reached the prose sections rather than stopping at the landing page
  expect(seen.has("/whitepaper")).toBe(true);
  expect([...seen].some((h) => h.startsWith("/docs/"))).toBe(true);
  expect([...seen].some((h) => h.startsWith("/blog/"))).toBe(true);
});
