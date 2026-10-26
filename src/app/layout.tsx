import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PDF → PNG Converter | Descarga y comparte por WhatsApp",
  description:
    "Convierte cada página de un PDF en una imagen PNG directamente en tu navegador. Descarga individual o en ZIP y compártelo por WhatsApp.",
  keywords: [
    "PDF a PNG",
    "convertir PDF",
    "WhatsApp",
    "PDF splitter",
    "extraer páginas PDF",
  ],
  authors: [{ name: "Z.ai" }],
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "PDF → PNG Converter",
    description:
      "Convierte PDF a PNG y compártelo por WhatsApp. 100% en el navegador.",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF → PNG Converter",
    description:
      "Convierte PDF a PNG y compártelo por WhatsApp. 100% en el navegador.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <SonnerToaster richColors position="top-center" />
      </body>
    </html>
  );
}
