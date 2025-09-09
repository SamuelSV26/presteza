// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Presteza",
  description: "Restaurante – Best Food For Your Taste",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-base-900 text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
