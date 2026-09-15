import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "After Hours — Blackjack with your Grok bot",
  description: "Blackjack with play chips, table chat, and an MCP connection for your Grok bots.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
