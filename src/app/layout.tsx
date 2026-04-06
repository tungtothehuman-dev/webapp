import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthLayout from "@/components/AuthLayout";
import { GlobalModal } from "@/components/GlobalModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Order & Label Manager",
  description: "Merge tracking labels with Excel orders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-white flex`}>
        <AuthLayout>{children}</AuthLayout>
        <GlobalModal />
      </body>
    </html>
  );
}
