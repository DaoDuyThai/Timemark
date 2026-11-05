import type { Metadata, Viewport } from "next";
import { Roboto_Condensed } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/register-sw";

const stamp = Roboto_Condensed({
  variable: "--font-stamp",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Timemark",
  description: "Chấm công nội bộ bằng ảnh có dấu ngày giờ và địa điểm.",
  applicationName: "Timemark",
  appleWebApp: { capable: true, title: "Timemark", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/192" },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${stamp.variable} h-full dark`}>
      <body className="min-h-full bg-black font-sans text-white">
        {children}
        <Toaster position="top-center" />
        <RegisterSW />
      </body>
    </html>
  );
}
