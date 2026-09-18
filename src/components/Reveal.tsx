"use client";

import { useEffect } from "react";

/**
 * Scroll-triggered fade-in for every major block. Purely additive: elements
 * matching SELECTOR get `data-reveal` (hidden) and `data-in` once they enter
 * the viewport; the transition itself lives in globals.css and is switched
 * off under prefers-reduced-motion. Siblings are staggered by their index.
 */
const SELECTOR = [
  ".lp-section > .lp-col",
  ".lp-section > .lp-portal",
  ".lp-cards-head > *",
  ".lp-tile",
  ".lp-footer > *",
  ".reveal",
  "main > *",
  "article > *",
].join(",");

export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    // Idempotent on purpose: StrictMode runs this effect twice in dev, and the
    // second pass must re-observe nodes the first pass already tagged.
    nodes.forEach((n) => {
      if (n.hasAttribute("data-in") || n.closest("[data-hero]")) return;
      const parent = n.parentElement;
      const i = parent ? Array.from(parent.children).indexOf(n) : 0;
      n.style.setProperty("--reveal-delay", `${Math.min(i, 8) * 90}ms`);
      n.setAttribute("data-reveal", "");
      io.observe(n);
    });
    return () => io.disconnect();
  }, []);
  return null;
}
