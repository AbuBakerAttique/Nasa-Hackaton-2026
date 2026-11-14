import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fire Calendar",
  description:
    "25 years of satellite fire history as one consistent record, shown as a calendar for any region.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main-content" className="skip-link">Skip to fire explorer</a>
        <header className="site-header">
          <div className="page-width flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
            <a href="#" className="brand" aria-label="Fire Calendar home">
              <span className="brand-symbol" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M13 2c1 6-5 6-3 11 1-2 3-3 4-4 0 3 5 5 5 9a7 7 0 0 1-14 0c0-5 6-8 8-16Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              </span>
              <span>Fire<span className="font-normal opacity-65"> Calendar</span><span className="brand-caption">EARTH OBSERVATION EXPLORER</span></span>
            </a>
            <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm sm:gap-8">
              <a href="#explorer" className="nav-link">Explore</a>
              <a href="#spatial-view" className="nav-link">Map</a>
              <a href="#trends" className="nav-link">Insights</a>
              <span className="mission-tag hidden sm:inline-flex">SPACE APPS / 2026</span>
            </nav>
          </div>
        </header>

        <main id="main-content" className="page-width flex-1 py-8 sm:py-12">
          {children}
        </main>

        <footer className="border-t border-line">
          <div className="page-width flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-muted">
            <p>Built for NASA Space Apps 2026 · Cottbus</p>
            <a href="https://www.earthdata.nasa.gov/data/tools/firms" target="_blank" rel="noreferrer" className="hover:text-accent">Data: NASA FIRMS · MODIS + VIIRS S-NPP ↗</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
