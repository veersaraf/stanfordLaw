import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const editorial = Cormorant_Garamond({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bodySans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Maritime Sanctions Desk",
  description:
    "Prototype workflow for maritime sanctions, counterparty risk, vessel intelligence, and PDF-led intake.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${editorial.variable} ${bodySans.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-ink">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(17,82,111,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(193,111,53,0.14),_transparent_24%),linear-gradient(180deg,_#f3ecde_0%,_#f7f4ee_48%,_#fbfaf7_100%)]" />
        <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="font-serif text-3xl leading-none tracking-tight text-navy">
                Maritime
              </span>
              <span className="rounded-full border border-navy/15 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-navy/70">
                Sanctions Desk
              </span>
            </Link>
            <nav className="flex items-center gap-2 text-sm font-semibold text-navy/80">
              <Link
                href="/checks/new"
                className="rounded-full border border-line bg-white/75 px-4 py-2 transition hover:border-navy/30 hover:bg-white"
              >
                New Check
              </Link>
              <Link
                href="/history"
                className="rounded-full px-4 py-2 transition hover:bg-white/70"
              >
                History
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8 lg:px-10 lg:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
