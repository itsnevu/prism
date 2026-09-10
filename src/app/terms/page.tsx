import { ProseShell } from "@/components/prose/ProseShell";
import { CONTACT_EMAIL } from "@/lib/links";

export const metadata = { title: "Terms — Prism Capital" };

export default function Page() {
  return (
    <ProseShell>
      <div className="mx-auto max-w-[70ch] px-5 py-16 sm:px-8 md:py-24">
        <h1 className="text-[40px] font-semibold tracking-[-0.025em] text-ink">Terms</h1>
        <div className="mt-8 space-y-5 text-[16px] leading-relaxed text-ink-soft">
          <p>Prism Capital is software, not a broker, fund, or financial institution. It is provided as is, without warranty, and responsibility for your own funds stays with you.</p>
          <p>An index token is a claim on the basket its vault holds. Prices go down as well as up, and the token tracks the net asset value of that basket rather than any promised figure. Past composition and past performance say nothing about future returns.</p>
          <p>Minting and redemption pause whenever any asset in a basket has no fresh price. This is deliberate. Tokenized equities and metals follow markets that close, and quoting a price nobody can defend would move losses onto other holders.</p>
          <p>The protocol is in open beta. Weights, caps, and fee parameters may be adjusted, and vaults may be paused. Nothing here is investment advice or a solicitation.</p>
          <p>You are responsible for your own tax position and for the laws that apply where you live.</p>
          <p>
            Questions:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-ink">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
        <p className="mt-12 border-t border-line pt-6 text-[14px] text-ink-faint">Last updated 10 September 2026</p>
      </div>
    </ProseShell>
  );
}
