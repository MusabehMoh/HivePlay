import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Rajdhani } from "next/font/google";
import "./globals.css";
import ClientLayout from "./components/ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HivePlay",
  description: "A modern music player for YouTube audio",
  icons: {
    icon: [
      { url: "/hiveplay.png", type: "image/png", sizes: "32x32" },
      { url: "/hiveplay.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/hiveplay.png" }],
    shortcut: ["/hiveplay.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={rajdhani.className}>
      <head>
        {/* Explicit icon links to override default Next.js favicon and bust caches */}
        <link
          rel="icon"
          href="/hiveplay.png?v=2"
          type="image/png"
          sizes="32x32"
        />
        <link rel="apple-touch-icon" href="/hiveplay.png?v=2" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
