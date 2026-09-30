import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Listening Coach · Daily Listening Practice",
  description: "A daily English listening routine",
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
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
