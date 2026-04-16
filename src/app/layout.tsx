import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// Geist for editor UI chrome only — proposal fonts are loaded via CSS from Google Fonts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Safari Studio — Proposal Builder for East African Tour Operators",
  description:
    "Build stunning, multi-tier safari proposals in minutes. Designed exclusively for East African tour operators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
