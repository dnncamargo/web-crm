import type { Metadata } from "next";
import "./globals.css";

import localFont from 'next/font/local'

const connexusFont = localFont({
  src: '/assets/Connexus.ttf',
  variable: '--font-connexus'
})

export const metadata: Metadata = {
  title: "Connexus",
  description: "Gerenciamento de Clientes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={connexusFont.variable}>
        {children}
      </body>
    </html>
  );
}
