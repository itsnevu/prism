import { chromium } from "playwright";
const targets = {
  3001: ["/", "/app", "/docs", "/whitepaper", "/faq"],
  3002: ["/", "/app", "/docs", "/whitepaper", "/portfolio", "/risk"],
  3003: ["/", "/app", "/docs", "/blog", "/whitepaper", "/privacy", "/risk"],
};
const b = await chromium.launch();
for (const [port, paths] of Object.entries(targets)) {
  for (const path of paths) {
    for (const vw of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const p = await b.newPage({ viewport: vw });
      const logs = [];
      p.on("pageerror", e => logs.push("PAGEERROR " + e.message.slice(0, 200)));
      p.on("console", m => { const t = m.text(); if ((m.type() === "error" || m.type() === "warning") && !t.includes("ERR_CONNECTION") && !t.includes("DevTools") && !t.includes("HMR")) logs.push(m.type().toUpperCase() + " " + t.slice(0, 220)); });
      const res = await p.goto(`http://localhost:${port}${path}`, { waitUntil: "networkidle" }).catch(e => ({ status: () => "ERR " + e.message }));
      await p.waitForTimeout(1500);
      const hs = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      const hidden = await p.evaluate(() => Array.from(document.querySelectorAll("[data-reveal]:not([data-in])")).filter(e => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).length);
      console.log(`${port}${path} @${vw.width} status=${res.status()} hscroll=${hs} hiddenInView=${hidden}`);
      [...new Set(logs)].slice(0, 4).forEach(l => console.log("   ", l));
      await p.close();
    }
  }
}
await b.close();
