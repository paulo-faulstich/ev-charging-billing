import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "EV ChargeOps",
  description: "Auditable operations for shared EV charging",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
