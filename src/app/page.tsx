import Link from "next/link";
import { LINKS } from "@/lib/links";
import { ConnectButton } from "@/components/ConnectButton";
import { PrismMark } from "@/components/Logo";
import { IndexCountList, IndexTiles, IndexTape } from "@/components/LiveIndexes";
import { ArrowIcon, TelegramIcon, XIcon } from "@/components/Icons";
import { DashboardPhone, MintPhone, PhoneDefs } from "@/components/Phone";
import { HeroBackdrop } from "@/components/HeroBackdrop";

function Header() {
  return (
    <header className="lp-header">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Prism home">
        <PrismMark size={44} />
        <span className="lp-wordmark text-[26px]">prism</span>
      </Link>
      <nav className="flex items-center gap-1.5">
        {LINKS.x && (
          <a href={LINKS.x} target="_blank" rel="noreferrer" aria-label="Prism on X" className="lp-icon-button">
            <XIcon />
          </a>
        )}
        {LINKS.telegram && (
          <a href={LINKS.telegram} target="_blank" rel="noreferrer" aria-label="Prism on Telegram" className="lp-icon-button">
            <TelegramIcon />
          </a>
        )}
        <Link href={LINKS.docs} className="lp-small ml-1 hidden px-3 py-2 font-medium sm:block">
          Docs
        </Link>
        <Link href={LINKS.app} className="lp-small hidden px-3 py-2 font-medium sm:block">
          Log in
        </Link>
        <ConnectButton className="lp-pill lp-pill-sm lp-pill-ink" label="Get started" />
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="lp-section lp-hero lp-glass" data-hero="true">
      <HeroBackdrop />
      <div className="lp-col lp-col-left order-1">
        <h1 className="lp-display">Buy an idea, not a spreadsheet.</h1>
      </div>
      <div className="lp-portal order-2">
        <DashboardPhone />
      </div>
      <div className="lp-col lp-col-right order-3 flex flex-col items-start gap-6">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <p className="lp-body lp-muted">
            Buy pSEMI, hold eight semiconductor names. Buy pMETL, hold silver and friends. Real tokenized assets, in
            your own wallet.
          </p>
          <Link href="/app" className="lp-pill lp-pill-ink self-center">
            Get started
          </Link>
        </div>
        <p className="lp-small lp-muted">Mint or redeem any time. No broker, no eight tickers to babysit.</p>
      </div>
    </section>
  );
}

/** Between the two phones: a running tape of basket marks, then the three steps in one line. */
function Bridge() {
  return (
    <div className="lp-bridge">
      <IndexTape />
      <section className="lp-section lp-steps" aria-label="How it works">
        <ol className="lp-col lp-steps-list">
          {[
            ["01", "Pick a theme", "Semis, metals or degen — one token each."],
            ["02", "Mint with USDG", "Deliver USDG, receive the basket at NAV."],
            ["03", "Hold or redeem", "Weights rebalance inside a band. Exit at NAV whenever."],
          ].map(([n, t, d]) => (
            <li key={n} className="lp-step">
              <span className="lp-step-n">{n}</span>
              <span className="lp-step-t">{t}</span>
              <span className="lp-step-d lp-muted">{d}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function MintRedeem() {
  return (
    <div className="lp-panel-wrap">
      <section className="lp-section lp-panel">
        <div className="lp-col lp-col-left order-1">
          <h2 className="lp-head">
            Mint the basket.
            <br />
            <span className="lp-muted">Redeem the basket.</span>
          </h2>
        </div>
        <div className="lp-portal order-2">
          <MintPhone />
        </div>
        <div className="lp-col lp-col-right order-3 flex flex-col items-start gap-6">
          <p className="lp-body max-w-sm">
            Anyone can mint by delivering the basket and redeem back into it. If the token trades above what it holds,
            minting is profitable. Below, redeeming is. Arbitrage drags price to NAV — the peg is defended by everyone
            who wants free money, not by us.
          </p>
          <Link href="/app" className="lp-pill lp-pill-surface">
            See how it works <ArrowIcon />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Indexes() {
  return (
    <section className="lp-section lp-cards">
      <div className="lp-col lp-cards-head">
        <div className="max-w-xl">
          <h2 className="lp-head">
            Three indexes.
            <br />
            <span className="lp-muted">One token each.</span>
          </h2>
        </div>
        <div className="flex max-w-sm flex-col items-start gap-6">
          <p className="lp-body lp-muted">
            Pick the theme. Prism holds the names, keeps the weights, and rebalances inside a band so it never trades
            every wiggle.
          </p>
          <Link href="/app" className="lp-pill lp-pill-ink">
            See every index <ArrowIcon />
          </Link>
        </div>
      </div>
      <ul className="lp-col lp-grid">
        <IndexTiles />
      </ul>
    </section>
  );
}

const PRICING = [
  {
    figure: "Oracle-priced",
    note: "Every leg is marked from a live feed — tokenized equities, silver and oil alike — so NAV is a number, not a guess.",
  },
  {
    figure: "Paused, not guessed",
    note: "Equities close at the bell and silver closes for the weekend. When a leg goes stale, mint and redeem pause for that basket instead of inventing a price.",
  },
  {
    figure: "Capped per asset",
    note: "No single name can swallow a basket. Weights are capped and pulled back inside a band when they drift.",
  },
];

function Pricing() {
  return (
    <div className="lp-on-field">
      <section className="lp-section lp-cards">
        <div className="lp-col lp-cards-head">
          <h2 className="lp-head max-w-xl">
            Priced honestly,
            <br />
            <span className="lp-muted">even when half the market is asleep.</span>
          </h2>
          <p className="lp-body lp-muted max-w-sm">
            Equities close. Silver closes. Oil closes. Feeds go quiet over the weekend. Prism prices each leg from an oracle and refuses to
            quote a basket while any leg is stale.
          </p>
        </div>
        <ul className="lp-col lp-grid">
          {PRICING.map((t) => (
            <li key={t.figure} className="lp-tile">
              <div className="lp-art lp-art-surface lp-art-stat">
                <span className="lp-figure">{t.figure}</span>
                <span className="lp-note">{t.note}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const STATS = [
  { figure: "1", label: "token", note: "holds the whole theme, weighted and rebalanced", detail: ["Mint with USDG", "Redeem for the basket", "Trades at NAV"] },
  { figure: "3", label: "indexes", note: "semis, metals, degen", detail: [] as string[], live: true },
  { figure: "0", label: "tickers to babysit", note: "a wallet is the whole of it", detail: ["No broker", "No rebalancing chores", "No claim button"] },
];

function Closing() {
  return (
    <div className="lp-on-night">
      <section className="lp-section lp-cards lp-closing">
        <div className="lp-col lp-cards-head">
          <h2 className="lp-head max-w-xl">
            Buy an idea,
            <br />
            <span className="lp-muted">not a spreadsheet.</span>
          </h2>
        </div>
        <ul className="lp-col lp-grid lp-grid-4">
          {STATS.map((s) => (
            <li key={s.figure} className="lp-tile">
              <div className="lp-art lp-art-outline">
                <span className="lp-figure">
                  {s.figure} <span className="lp-figure-label">{s.label}</span>
                </span>
                <ul className="lp-detail">
                  {"live" in s && s.live ? <IndexCountList /> : s.detail.map((d) => <li key={d}>{d}</li>)}
                </ul>
                <span className="lp-note">{s.note}</span>
              </div>
            </li>
          ))}
          <li className="lp-tile">
            <Link href="/app" className="lp-art lp-art-cta">
              <span className="lp-figure">Get started</span>
              <span className="lp-arrow">
                <ArrowIcon size={32} />
              </span>
            </Link>
          </li>
        </ul>

        <footer className="lp-col lp-footer">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <PrismMark size={40} />
              <span className="lp-wordmark text-[24px]">prism</span>
            </div>
            <p className="lp-small lp-muted max-w-md">
              Prices go down as well as up. Index tokens track the NAV of their underlying basket.
            </p>
            <span className="lp-small lp-muted">Not audited. Not deployed to a live network.</span>
          </div>
          <div className="flex flex-col items-start gap-5 lg:items-end">
            {(LINKS.x || LINKS.telegram) && (
              <div className="flex items-center gap-1.5">
                {LINKS.x && (
                  <a href={LINKS.x} target="_blank" rel="noreferrer" aria-label="Prism on X" className="lp-icon-button">
                    <XIcon />
                  </a>
                )}
                {LINKS.telegram && (
                  <a
                    href={LINKS.telegram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Prism on Telegram"
                    className="lp-icon-button"
                  >
                    <TelegramIcon />
                  </a>
                )}
              </div>
            )}
            <nav className="lp-small flex flex-wrap gap-x-6 gap-y-2 lg:justify-end">
              <Link href={LINKS.app}>Indexes</Link>
              <Link href={LINKS.docs}>Docs</Link>
              <Link href="/whitepaper">Whitepaper</Link>
              <Link href={LINKS.blog}>Blog</Link>
              <Link href={LINKS.terms}>Terms</Link>
              <Link href={LINKS.privacy}>Privacy</Link>
            </nav>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <main className="lp flex-1 overflow-x-clip">
      <PhoneDefs />
      <Header />
      <Hero />
      <Bridge />
      <MintRedeem />
      <Indexes />
      <Pricing />
      <Closing />
    </main>
  );
}
