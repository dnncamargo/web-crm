import { AuthProvider } from './components/auth/AuthProvider';
import { GoogleOAuthProvider } from '@react-oauth/google';
import type { Metadata } from "next";
import "./globals.css";

import localFont from 'next/font/local';

const connexusFont = localFont({
  src: '/assets/Connexus.ttf',
  variable: '--font-connexus'
});

export const metadata: Metadata = {
  title: "Connexus",
  description: "Gerenciamento de Clientes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-br">
      <body className={connexusFont.variable}>
        <GoogleOAuthProvider clientId="996833302397-gsksfg2ujfqgt27jg5ulti0ffrnmje9a.apps.googleusercontent.com">
          <AuthProvider>
            {children}
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
};