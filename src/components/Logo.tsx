/**
 * Prism mark: a light ray enters a triangular prism from the left and
 * leaves as three rays. Pure inline SVG, sized by the parent (CSS wins
 * over the width/height attributes when set).
 */
export function PrismMark({
  size = 44,
  ink = "#394938",
  fill = "#edf6eb",
  className = "",
}: {
  size?: number;
  ink?: string;
  fill?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* incoming ray */}
      <path d="M3 23H14" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      {/* prism */}
      <path d="M22 7 L35 33 H9 Z" fill={fill} stroke={ink} strokeWidth="2.6" strokeLinejoin="round" />
      {/* three rays */}
      <path d="M27 17 L41 9" stroke="#7be372" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M29 21 L43 21" stroke="#6ed964" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M31 25 L41 33" stroke={ink} strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

/** Solid triangle used as the icon for each index basket. */
export function Tri({
  size,
  color = "#7be372",
  stroke,
  className = "",
}: {
  size?: number;
  color?: string;
  stroke?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 3.2 L21.8 20.4 H2.2 Z"
        fill={color}
        stroke={stroke}
        strokeWidth={stroke ? 1.6 : 0}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({
  size = 26,
  markSize = 44,
  ink,
  fill,
  className = "",
}: {
  size?: number;
  markSize?: number;
  ink?: string;
  fill?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <PrismMark size={markSize} ink={ink} fill={fill} />
      <span className="lp-wordmark" style={{ fontSize: size }}>
        prism
      </span>
    </span>
  );
}
