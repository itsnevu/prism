"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Split a heading into word spans once, so GSAP can stagger them. */
function splitWords(el: HTMLElement) {
  if (el.dataset.split) return Array.from(el.querySelectorAll<HTMLElement>(".w"));
  const frag = document.createDocumentFragment();
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent!.split(/(\s+)/).forEach((tok) => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(" ")); return; }
        const s = document.createElement("span");
        s.className = "w";
        s.textContent = tok;
        frag.appendChild(s);
      });
    } else if ((node as HTMLElement).tagName === "BR") {
      frag.appendChild(node.cloneNode());
    } else {
      const wrap = document.createElement("span");
      wrap.className = "w";
      wrap.appendChild(node.cloneNode(true));
      frag.appendChild(wrap);
    }
  });
  el.replaceChildren(frag);
  el.dataset.split = "1";
  return Array.from(el.querySelectorAll<HTMLElement>(".w"));
}

/**
 * Landing motion: hero entrance timeline, scroll parallax on the coins and
 * phone, word-by-word headings, magnetic pills. Everything is inside a
 * gsap.matchMedia so reduced-motion users get a static page.
 */
export function Motion() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // --- hero entrance
      const hero = document.querySelector<HTMLElement>("[data-hero]");
      if (hero) {
        const h1 = hero.querySelector<HTMLElement>("h1");
        const words = h1 ? splitWords(h1) : [];
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        tl.from(".lp-header", { y: -24, opacity: 0, duration: 1 }, 0)
          .from(words, { yPercent: 110, opacity: 0, rotateX: -40, duration: 1.1, stagger: 0.06 }, 0.15)
          .from(".lp-portal .ip", { y: 80, opacity: 0, rotateX: 12, scale: 0.94, duration: 1.4 }, 0.25)
          .from(hero.querySelectorAll(".lp-col-right > *"), { y: 30, opacity: 0, duration: 1, stagger: 0.1 }, 0.55)
          .from(".lp-coin", { scale: 0.6, opacity: 0, duration: 1.4, stagger: 0.08, ease: "back.out(1.6)" }, 0.4);
      }

      // --- scroll parallax: coins drift at different speeds, phone eases up.
      gsap.utils.toArray<HTMLElement>(".lp-coin").forEach((c, i) => {
        gsap.to(c, {
          yPercent: -30 - (i % 3) * 25,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 0.6 },
        });
      });
      gsap.to("[data-hero] .lp-portal", {
        yPercent: -12, ease: "none",
        scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 0.8 },
      });

      // --- section headings: words rise as they enter.
      gsap.utils.toArray<HTMLElement>("h2.lp-head").forEach((h) => {
        const words = splitWords(h);
        gsap.from(words, {
          yPercent: 100, opacity: 0, duration: 0.9, stagger: 0.04, ease: "expo.out",
          scrollTrigger: { trigger: h, start: "top 85%", once: true },
        });
      });

      // --- tiles: 3D tilt toward the pointer.
      gsap.utils.toArray<HTMLElement>(".lp-art").forEach((tile) => {
        const rx = gsap.quickTo(tile, "rotationX", { duration: 0.5, ease: "power3" });
        const ry = gsap.quickTo(tile, "rotationY", { duration: 0.5, ease: "power3" });
        gsap.set(tile, { transformPerspective: 900 });
        tile.addEventListener("pointermove", (e) => {
          const r = tile.getBoundingClientRect();
          rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
          ry(((e.clientX - r.left) / r.width - 0.5) * 12);
        });
        tile.addEventListener("pointerleave", () => { rx(0); ry(0); });
      });

      // --- magnetic pills.
      gsap.utils.toArray<HTMLElement>(".lp-pill").forEach((b) => {
        const x = gsap.quickTo(b, "x", { duration: 0.4, ease: "power3" });
        const y = gsap.quickTo(b, "y", { duration: 0.4, ease: "power3" });
        b.addEventListener("pointermove", (e) => {
          const r = b.getBoundingClientRect();
          x((e.clientX - (r.left + r.width / 2)) * 0.25);
          y((e.clientY - (r.top + r.height / 2)) * 0.35);
        });
        b.addEventListener("pointerleave", () => { x(0); y(0); });
      });

      // --- phone: subtle tilt following the pointer over the hero.
      const phone = document.querySelector<HTMLElement>("[data-hero] .ip");
      if (phone && hero) {
        gsap.set(phone, { transformPerspective: 1200 });
        const rx = gsap.quickTo(phone, "rotationX", { duration: 0.8, ease: "power2" });
        const ry = gsap.quickTo(phone, "rotationY", { duration: 0.8, ease: "power2" });
        hero.addEventListener("pointermove", (e) => {
          rx(-((e.clientY / window.innerHeight) - 0.5) * 8);
          ry(((e.clientX / window.innerWidth) - 0.5) * 12);
        });
        hero.addEventListener("pointerleave", () => { rx(0); ry(0); });
      }
    });
    return () => mm.revert();
  }, []);
  return null;
}
