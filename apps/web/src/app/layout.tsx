import type { Metadata } from "next";

import localFont from "next/font/local";

import "./globals.css";

/** Inter, self-hosted so the build needs no network and the interface looks
 * the same on every machine. Licensed under the SIL Open Font License; the
 * licence text sits next to the file. */
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EV ChargeOps",
  description: "Auditable operations for shared EV charging",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
