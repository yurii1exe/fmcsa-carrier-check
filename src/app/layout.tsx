import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FMCSA Carrier Check",
    template: "%s — FMCSA Carrier Check",
  },
  description:
    "Look up a motor carrier's operating authority, insurance filings, safety rating and inspection history by USDOT or MC number, using FMCSA's public QCMobile data.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-accent focus:shadow"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
