# Prism — Higgsfield prompts

Companion to `visual-key.html` / `visual-key/*.png` (board 01 is the primary image reference).
Prism is **strictly monochrome**: black ground, graphite surfaces, brushed silver, white light. No colour.
Rule: **scene first, style anchor last.** Paste the anchor at the end of every prompt.

## Style anchor (append to every prompt)

```
Prism brand look: strictly black and white monochrome, pure black background (#000000), graphite surfaces (#111111 to #262626), brushed satin silver metal objects, dark glass with faint white edges, quilted field of rounded dark glass tiles, thick floating silver coins with soft black shadows, one soft white key light from top-left, no colour tint at all, clean minimal 3D render, airy composition with empty black space, no people, no text, matte and satin finishes, octane render, 8K
```

## Negative prompt

```
colour, color tint, blue, teal, green, gold, yellow, orange, purple, rainbow, spectrum, neon, glow, cyberpunk, people, hands, faces, text, letters, watermark, other logos, white background, daylight, grey fog, haze, caustics, sparkle, lens flare, chrome mirror reflections, coins with faces or numbers, charts, candlesticks, rockets, bull, bear, wood, marble, nature
```

## Scenes

### 01 · Hero, coins on the field — 16:9 · reference: `visual-key/01-key-visual.png`

```
Several thick brushed-silver coins floating just above a quilted field of dark glass tiles, seen from a three-quarter top-down angle, satin faces with a soft white highlight top-left and a bright polished rim, each coin casting a soft black elliptical shadow, the centre-left of the frame left empty for a headline, black falloff at the edges.
```

### 02 · The prism (the idea) — 16:9 · video 5s · reference: `public/prismlogo.png`

```
A hollow triangular prism of clear optical glass on a pure black background, a thin bright white beam of light enters from the left and leaves the right face as a soft widening fan of white light, no rainbow, no spectrum colours, black and white only, photographic, long exposure look, minimal.
```

### 03 · Three baskets — 1:1

```
Three brushed-silver coins standing on a dark quilted glass field, each with a small triangle embossed on its face, one triangle bright silver, one dark with a fine white outline, one mid grey, soft white key light from top-left, black surroundings, product photography, satin metal.
```

### 04 · Rebalance — 16:9 · video 5s

```
Eight small brushed-silver discs of uneven sizes resting on a dark quilted glass field slowly and gently settling into eight equal-sized discs in a neat row, calm and precise, one soft white light, black background, no text, minimal 3D animation, monochrome.
```

### 05 · Stale → paused — 1:1

```
A row of brushed-silver coins on a black quilted glass field, one coin gone dull dark grey and matte while the others stay bright satin silver, very calm, soft white light, product photography, lots of empty black space, monochrome.
```

### 06 · Phone on the field — 9:16

```
A modern smartphone with a near-black bezel standing upright on a quilted dark glass field, its screen showing a blank black-to-graphite gradient, two brushed-silver coins floating beside it, three-quarter view, one soft white key light, black background, clean product render, black and white.
```

## Motion (video)

```
Slow, weightless motion. Coins drift up and down a few pixels on a 9 second cycle, alternating, never spinning fast. Camera locked off or a very slow push-in. Light stays constant. Reveal by a white beam entering the prism and fanning out. End on a held frame with the centre empty and black.
```

## Settings

| Setting | Value |
| --- | --- |
| Image reference | `visual-key/01-key-visual.png` for the whole look · `public/prismlogo.png` for the prism · `key-visuals/01-hero-16x9.png` for the site hero |
| Reference strength | 0.6–0.8 to keep the material · 0.3–0.4 for a new composition |
| Aspect | 16:9 hero & video · 1:1 social · 9:16 phone shots |
| Video | 5s clips, 24fps, motion strength low; stills first, animate the keeper |
| Colour check | desaturate the result and compare; if anything changed, it had a tint. Regenerate. |

## Workflow

1. Scene prompt + style anchor
2. Attach a reference image (board 01 or the logo)
3. 4 variations → keep the blackest, least tinted one
4. Upscale, check greys against board 02
5. Animate the keeper with the motion prompt

See also `key-visuals/` (ten finished social/OG/banner PNGs rendered from the same tokens).
