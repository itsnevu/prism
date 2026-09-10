import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Schibsted_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const grotesk = Schibsted_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Prism Capital — One token. The whole theme.";
const DESCRIPTION =
  "Buy one token, hold a whole theme. Semis, metals, degen baskets — weighted, rebalanced and redeemable at NAV.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL in production so shared links resolve absolutely.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: TITLE, template: "%s" },
  description: DESCRIPTION,
  applicationName: "Prism Capital",
  openGraph: {
    type: "website",
    siteName: "Prism Capital",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

// Typed explicitly rather than with Next's generated `LayoutProps`: that global only exists once
// `next build` has written .next/types, so relying on it makes `tsc` fail on a clean checkout.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${grotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
