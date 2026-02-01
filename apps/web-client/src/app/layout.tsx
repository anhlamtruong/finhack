import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/provider/query-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-editor/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TRPCReactProvider } from "@/trpc/client";
import { ThemeLoader } from "@/components/theme-editor/theme-loader";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Strict Budgeting. Smart Reminders. Shared Wealth. | FinHack Finance",
  description:
    "The strict financial app for partners. Set hard limits, get proactive reminders before you overspend, and build wealth together.",
  applicationName: "FinHack Finance",
  authors: [{ name: "FinHack Team" }],
  keywords: [
    "budgeting app",
    "finance for couples",
    "expense tracking",
    "wealth management",
  ],

  openGraph: {
    title: "FinHack Finance | Master Your Money",
    description:
      "The strict financial app for partners. Build wealth together.",
    url: "https://chuchube.co",
    siteName: "FinHack Finance",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FinHack Finance Dashboard Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <TRPCReactProvider>
        <QueryProvider>
          <html lang="en">
            <body
              className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
              <Suspense>
                <NuqsAdapter>
                  <ThemeProvider defaultTheme="light">
                    <ThemeLoader>{children}</ThemeLoader>
                    <Toaster />
                  </ThemeProvider>
                </NuqsAdapter>
              </Suspense>
            </body>
          </html>
        </QueryProvider>
      </TRPCReactProvider>
    </ClerkProvider>
  );
}
