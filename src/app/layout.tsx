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
