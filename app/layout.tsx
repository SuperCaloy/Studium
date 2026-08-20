import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";
import "./print.css";
import Providers from "./Providers";
import { Analytics } from "@vercel/analytics/react";
const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Studium | AI Study Guide & Reviewer Generator",
  description:
    "Transform course materials into an interactive study guide in seconds. Instantly generate AI-powered flashcards, practice quizzes, and comprehensive summaries—built exclusively from your notes. Your files never leave your device.",
  keywords: ["study guide generator", "AI flashcards", "practice quizzes", "student reviewer", "PDF to quiz", "study notes"],
  openGraph: {
    title: "Studium | AI Study Guide & Reviewer Generator",
    description: "Instantly generate AI-powered flashcards, practice quizzes, and comprehensive summaries from your notes.",
    type: "website",
    locale: "en_US",
    siteName: "Studium"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
