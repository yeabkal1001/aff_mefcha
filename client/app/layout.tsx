import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "./providers";

import "./globals.css";

// shadcn's theme maps --font-sans, so Geist has to publish under that name or
// every element silently falls back to the browser serif.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const TITLE = "AI Communication Coach";
const DESCRIPTION =
  "Speak English with confidence, one conversation at a time. An AI coach that talks with you, catches what you get wrong the moment you say it, and explains why in your own language.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    // Every other route reads as "<Screen> · AI Communication Coach".
    template: `%s · ${TITLE}`,
  },
  description: DESCRIPTION,
  applicationName: TITLE,
  keywords: [
    "English speaking practice",
    "AI language coach",
    "Amharic",
    "Ethiopia",
    "CEFR",
    "pronunciation",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Matches --ambient-mist in each theme, so the browser chrome on mobile
  // continues the ambient field rather than framing it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdff" },
    { media: "(prefers-color-scheme: dark)", color: "#141519" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // next-themes sets the class on <html> before paint, which is a mismatch
    // against the server render by definition.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
