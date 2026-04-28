import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PresenceProvider } from "@/components/presence/PresenceProvider";
import { CommandPalette } from "@/components/CommandPalette";
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
  // Theme colour for browser chrome (Safari address bar, mobile status
  // bar). Matches the deep teal in the brand palette.
  themeColor: "#1f3a3a",
  // Next.js auto-discovers /app/icon.svg and /app/apple-icon.svg.
  // The explicit `icons` block here is belt-and-braces for crawlers
  // that don't follow Next 13+ file conventions, plus declares the
  // .ico fallback for very old browsers.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Safari Studio — Proposal Builder for East African Tour Operators",
    description:
      "Build stunning, multi-tier safari proposals in minutes. Designed exclusively for East African tour operators.",
    siteName: "Safari Studio",
    images: ["/logo.svg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Safari Studio",
    description:
      "Build stunning, multi-tier safari proposals in minutes.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          <PresenceProvider>{children}</PresenceProvider>
          <CommandPalette />
        </body>
      </html>
    </ClerkProvider>
  );
}
