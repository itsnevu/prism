/**
 * Prism mark — /public/prismlogo.png, sized by the parent. `ink`/`fill`
 * are kept for call-site compatibility but the raster logo ignores them.
 */
export function PrismMark({
  size = 44,
  className = "",
}: {
  size?: number;
  ink?: string;
  fill?: string;
  className?: string;
}) {
  return (
    <img
      src="/prismlogo.png"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={`block shrink-0 rounded-full object-cover ${className}`}
    />
  );
}

/** Solid triangle used as the icon for each index basket. */
export function Tri({
  size,
  color = "#e6e6e6",
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
