import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Ethiopic } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Amharic labels appear across the intake coach and navigation. Without an
// Ethiopic-script font the demo machine falls back to tofu boxes, which the
// risk register calls out by name.
const notoEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Skill-Connect Ethiopia",
  description:
    "AI-powered workforce infrastructure connecting Ethiopian youth with SMEs through verified, AI-graded capability scores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoEthiopic.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
