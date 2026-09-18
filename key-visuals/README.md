# Prism key visuals

Ten brand key visuals rendered straight from the site's own material — the tokens in
`src/app/globals.css` (black ground, graphite surfaces, silver accent), Schibsted Grotesk +
Geist Mono, the quilted glass-tile field, the CSS glass coins, and the prism mark.

| # | File | Size | Use |
|---|------|------|-----|
| 01 | `01-hero-16x9.png` | 1920×1080 | Hero / presentation cover / YouTube thumbnail |
| 02 | `02-social-card-og.png` | 1200×630 | Open Graph / link preview / Twitter card |
| 03 | `03-mark-square.png` | 1080×1080 | Instagram post / avatar backdrop / logo lockup |
| 04 | `04-story-how-it-works.png` | 1080×1920 | Instagram / TikTok story |
| 05 | `05-x-banner.png` | 1500×500 | X (Twitter) header |
| 06 | `06-three-indexes.png` | 1920×1080 | Product slide — pSEMI / pMETL / pDGEN |
| 07 | `07-closing-stats.png` | 1920×1080 | Closing slide — 1 token / 3 indexes / 0 tickers |
| 08 | `08-priced-honestly-portrait.png` | 1080×1350 | Instagram portrait / LinkedIn post |
| 09 | `09-mint-redeem-nav.png` | 1920×1080 | Explainer — mint/redeem arbitrage to NAV |
| 10 | `10-launch-announcement.png` | 1200×675 | Announcement card — live on Robinhood Chain |

All PNGs are exported at 2× device pixel ratio.

## Editing as templates

Every visual is a plain HTML file in `src/` that shares `src/kv.css` (the design tokens,
glass field, coins, tiles, pills). Change the copy or layout in the HTML, then re-render:

```sh
node key-visuals/render.mjs        # all ten
node key-visuals/render.mjs 03 07  # only some
```

Rendering uses the Playwright Chromium already installed for the project's tests. Fonts load
from Google Fonts, so the first render needs network access. To add a new visual, copy any
`src/NN-*.html`, keep the `html,body{width:…px;height:…px}` line (the renderer reads the
size from it), and run the script.
