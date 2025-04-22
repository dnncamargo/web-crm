import type { Metadata } from "next";
import { AuthProvider } from './components/AuthProvider'
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
}: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={connexusFont.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
