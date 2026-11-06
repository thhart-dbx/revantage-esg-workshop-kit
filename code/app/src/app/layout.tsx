import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Leaf } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revantage · Tenant ESG & Satisfaction Survey",
  description: "Quarterly tenant survey on sustainability, comfort and building management at Revantage properties.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background">
        <header className="border-b bg-brand-navy text-white">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <Leaf className="size-4 text-emerald-300" aria-hidden />
              </span>
              <span className="text-lg font-semibold tracking-tight">Revantage</span>
              <span className="hidden text-sm text-white/60 sm:inline">| Tenant ESG Survey</span>
            </div>
            <span className="text-xs text-white/60">Europe portfolio</span>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t bg-white">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-1 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>© 2026 Revantage. Your answers are used to improve building operations and our ESG reporting.</span>
            <span>Questions? Contact your Revantage property manager.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
