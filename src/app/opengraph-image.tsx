import { ImageResponse } from "next/og";

export const alt = "Prism Capital — one token, the whole theme";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card that renders when a Prism link is shared.
 *
 * Deliberately drawn from the brand's own geometry — the prism, the refracted spectrum — with no
 * webfont fetch: a network call here would make every build depend on Google Fonts being up, and
 * the shapes carry the identity more than the typeface does.
 */
export default function OpengraphImage() {
  const ink = "#394938";
  const green = "#7be372";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafafa",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="88" height="88" viewBox="0 0 44 44" fill="none">
            <path d="M3 23H14" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M22 7 L35 33 H9 Z" fill="#edf6eb" stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M27 17 L41 9" stroke={green} strokeWidth="2.8" strokeLinecap="round" />
            <path d="M29 21 L43 21" stroke="#6ed964" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M27 25 L41 33" stroke={ink} strokeWidth="2.8" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-0.02em", color: ink }}>prism</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              color: ink,
            }}
          >
            One token.
          </span>
          <span
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              color: "#97a395",
            }}
          >
            The whole theme.
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", height: 6, width: "100%" }}>
            <div style={{ flex: 3, background: green }} />
            <div style={{ flex: 2, background: "#6ed964" }} />
            <div style={{ flex: 1, background: ink }} />
          </div>
          <span style={{ fontSize: 27, color: "#596557", letterSpacing: "-0.01em" }}>
            Tokenized index baskets, redeemable at NAV — and paused rather than priced when a market
            is shut.
          </span>
        </div>
      </div>
    ),
    size,
  );
}
