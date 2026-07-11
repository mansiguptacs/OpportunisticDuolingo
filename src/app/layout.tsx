import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";

export const runtime = "edge";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Synapse — Active Second Brain",
  description: "Alchemize tabs into a living neural atlas you actually revise.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${jetbrains.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
