// Renders every key-visual template in ./src to a PNG next to this file.
//   node key-visuals/render.mjs            → all
//   node key-visuals/render.mjs 03 07      → only those numbers
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "src");
const only = process.argv.slice(2);

const files = readdirSync(src)
  .filter((f) => f.endsWith(".html"))
  .filter((f) => only.length === 0 || only.some((n) => f.startsWith(n)))
  .sort();

const browser = await chromium.launch();
for (const file of files) {
  const html = readFileSync(resolve(src, file), "utf8");
  const [, w, h] = html.match(/width:(\d+)px;height:(\d+)px/) ?? [];
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(resolve(src, file)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const out = resolve(here, basename(file, ".html") + ".png");
  await page.screenshot({ path: out, type: "png" });
  console.log(`${file} → ${w}×${h} @2x`);
  await page.close();
}
await browser.close();
