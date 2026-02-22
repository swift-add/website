import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import "react-toastify/dist/ReactToastify.css";
import type { Metadata } from "next";
import { JetBrains_Mono as FontMono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { ToastContainer } from "react-toastify";
import { cn } from "@/lib/utils";
import { Toaster } from 'sonner'

const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});
export const metadata: Metadata = {
  title: "Ad402",
  description:
    "A decentralized advertising platform for publishers and advertisers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={cn(
          "min-h-screen bg-background font-mono antialiased",
          fontMono.variable,
        )}
      >
        <Providers>
          <Header />
          <main>
            {children}
            <Toaster position="top-right" richColors />
          </main>
        </Providers>
        <ToastContainer />
        <p id="slot-description" className="sr-only">Opens booking flow for advertisement placement</p>
      </body>
    </html>
  );
}
