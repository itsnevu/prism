/**
 * Every outbound link and contact point on the site, in one place.
 *
 * Entries that are `null` have no destination yet: the components that use them render nothing
 * rather than pointing at an empty landing page. Publishing the real handles is a one-line change
 * here, not a hunt through the markup.
 */
export const LINKS = {
  /** No account exists yet. Set to the profile URL to show the icon. */
  x: null as string | null,
  telegram: null as string | null,
  docs: "/docs",
  blog: "/blog",
  whitepaper: "/whitepaper",
  // Live pages in this app:
  app: "/app",
  terms: "/terms",
  privacy: "/privacy",
} as const;

/**
 * Address printed on the legal pages. Point it at a mailbox that a person actually reads before
 * publishing the site — the Terms and Privacy pages both invite people to write to it.
 */
export const CONTACT_EMAIL = "support@prism.capital";

/** Block explorer link for an address, when the active chain publishes one. */
export function explorerAddress(explorerUrl: string | undefined, address: string): string | undefined {
  if (!explorerUrl) return undefined;
  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}
