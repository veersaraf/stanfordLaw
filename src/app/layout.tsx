import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const editorial = DM_Serif_Display({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400"],
});

const bodySans = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Everos",
  description:
    "Maritime sanctions screening, vessel intelligence, and compliance workflow.",
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
        <header className="sticky top-0 z-30 border-b border-line bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[960px] items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-3">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8L16 4L26 8V18C26 23.5 21.5 28 16 28C10.5 28 6 23.5 6 18V8Z" stroke="#209483" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M12 16L15 19L21 13" stroke="#5acdbd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-lg font-semibold tracking-[-0.02em] text-ink">
                Everos
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/checks/new"
                className="rounded-lg border border-primary bg-white px-4 py-2 font-medium text-primary shadow-sm transition hover:bg-primary hover:text-white"
              >
                New check
              </Link>
              <Link
                href="/history"
                className="rounded-lg px-4 py-2 font-medium text-muted transition hover:bg-surface hover:text-ink"
              >
                History
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col px-6 py-8 lg:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
