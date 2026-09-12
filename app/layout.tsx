import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cambridge H2 Physics Assessment Evidence Hub V2",
  description: "Evidence-grounded decision support for Cambridge H2 Physics assessment.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className="antialiased">{children}<Analytics /></body>
    </html>
  );
}
