import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escala ICI",
  description: "Gestão e consulta de escalas corporativas.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/icons/favicon-48.png",
    shortcut: "/icons/favicon-48.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
