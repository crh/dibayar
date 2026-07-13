import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dibayar — Segera Hadir",
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
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
