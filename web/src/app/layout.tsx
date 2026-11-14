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
        <header className="border-b border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
            <p className="text-xs uppercase tracking-widest text-muted">
              NASA Space Apps 2026 · Cottbus
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              <span className="text-accent">Fire</span> Calendar
            </p>
            <p className="mt-1 max-w-2xl text-muted">
              25 years of satellite fire history as one consistent record,
              shown as a calendar for any region.
            </p>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-muted sm:px-6">
            Data: NASA FIRMS active fire detections, MODIS and VIIRS S-NPP.
          </div>
        </footer>
      </body>
    </html>
  );
}
