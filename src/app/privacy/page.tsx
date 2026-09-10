import { ProseShell } from "@/components/prose/ProseShell";

export const metadata = { title: "Privacy — Prism Capital" };

export default function Page() {
  return (
    <ProseShell>
      <div className="mx-auto max-w-[70ch] px-5 py-16 sm:px-8 md:py-24">
        <h1 className="text-[40px] font-semibold tracking-[-0.025em] text-ink">Privacy</h1>
        <div className="mt-8 space-y-5 text-[16px] leading-relaxed text-ink-soft">
          <p>There is no account and no signup. Prism does not ask for your name, email, or identity documents.</p>
          <p>The site sees your public wallet address once you connect, plus ordinary web request data such as IP address and browser type. That is used to serve the site and to spot abuse, nothing else.</p>
          <p>Mints, redemptions, and balances are recorded on a public blockchain. They are readable by anyone and cannot be deleted, by us or by you.</p>
          <p>Your browser talks directly to an RPC provider and to your wallet extension, each of which has its own policy.</p>
          <p>We do not sell data and we do not run advertising or cross site tracking.</p>
          <p>Questions: support@prism.capital</p>
        </div>
        <p className="mt-12 border-t border-line pt-6 text-[14px] text-ink-faint">Last updated 10 September 2026</p>
      </div>
    </ProseShell>
  );
}
