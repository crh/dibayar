import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "Dibayar — Kelola deal sampai dibayar",
  description:
    "Dibayar membantu kreator Indonesia mengelola deal brand, invoice, dan pengingat pembayaran di satu tempat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className={`${plusJakartaSans.variable} flex min-h-full flex-col font-sans`}>{children}</body>
    </html>
  );
}
