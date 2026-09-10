import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://moritz-admin.vercel.app"),
  title: {
    default: "Moritz · Overview",
    template: "Moritz · %s",
  },
  description:
    "Firm command center for Moritz operations — triage, capacity, and flat-fee delivery.",
  openGraph: {
    title: "Moritz Operations Dashboard",
    description:
      "A single-page command center for law firm operations: triage, capacity, and flat-fee delivery.",
    url: "https://moritz-admin.vercel.app",
    siteName: "Moritz",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary",
    title: "Moritz Operations Dashboard",
    description:
      "A single-page command center for law firm operations: triage, capacity, and flat-fee delivery.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
