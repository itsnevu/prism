import type { CSSProperties } from "react";

type CoinVars = CSSProperties & {
  "--tilt"?: number;
  "--rot"?: string;
  "--th"?: string;
  "--dur"?: string;
  "--delay"?: string;
};

function CoinBody({ style }: { style?: CoinVars }) {
  return (
    <div className="lp-coin-body" style={style}>
      <span className="lp-coin-side" />
      <span className="lp-coin-band" />
      <span className="lp-coin-face" />
    </div>
  );
}

/**
 * A single glass coin: a thick disc seen at an angle.
 * tilt = ellipse height / width (1 = seen from above, ~0.3 = nearly edge-on),
 * rot = rotation in the picture plane, thick = visible rim thickness in px.
 */
function Coin({
  left,
  top,
  width,
  tilt,
  rot,
  thick,
  dur = 9,
  delay = 0,
  pale = false,
}: {
  left: string;
  top: string;
  width: number;
  tilt: number;
  rot: number;
  thick: number;
  dur?: number;
  delay?: number;
  pale?: boolean;
}) {
  const style: CoinVars = {
    left,
    top,
    width,
    "--tilt": tilt,
    "--rot": `${rot}deg`,
    "--th": `${thick}px`,
    "--dur": `${dur}s`,
    "--delay": `${delay}s`,
  };
  return (
    <div className={`lp-coin${pale ? " lp-coin-pale" : ""}`} style={style} aria-hidden="true">
      <CoinBody />
      <span className="lp-coin-shadow" />
    </div>
  );
}

/** Two overlapping coins sharing one ground shadow (top-left of the hero). */
function CoinPair({ left, top, width }: { left: string; top: string; width: number }) {
  const style: CoinVars = { left, top, width, aspectRatio: "1.3", "--dur": "10s", "--delay": "-3s" };
  return (
    <div className="lp-coin lp-coin-pair" style={style} aria-hidden="true">
      <CoinBody style={{ left: "42%", top: "0", width: "58%", "--tilt": 0.8, "--rot": "24deg", "--th": "10px" }} />
      <CoinBody style={{ left: "0", top: "20%", width: "78%", "--tilt": 0.7, "--rot": "-14deg", "--th": "13px" }} />
      <span className="lp-coin-shadow" />
    </div>
  );
}

/**
 * Hero backdrop: quilted glass-tile field (base gradient + corner blooms +
 * masked rounded-square relief) and the floating glass coins, positioned
 * where crumbs.family places its disc renders.
 */
export function HeroBackdrop() {
  return (
    <div className="lp-bg" aria-hidden="true">
      <span className="lp-glass-base" />
      <span className="lp-glass-bloom" />
      <span className="lp-glass-relief" />

      <CoinPair left="3%" top="9%" width={210} />
      <Coin left="76%" top="13%" width={175} tilt={0.3} rot={4} thick={10} pale dur={11} delay={-5} />
      <Coin left="86%" top="52%" width={140} tilt={0.55} rot={-38} thick={10} dur={9} delay={-1} />
      <Coin left="20%" top="72%" width={120} tilt={0.34} rot={-62} thick={9} dur={12} delay={-7} />
      <Coin left="69%" top="78%" width={105} tilt={0.6} rot={-18} thick={8} dur={8} delay={-2} />
      <Coin left="91%" top="82%" width={84} tilt={0.5} rot={30} thick={7} dur={10} delay={-4} pale />
    </div>
  );
}
