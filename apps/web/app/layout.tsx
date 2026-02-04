"use client";
import "./globals.css";
import { cn } from "@/lib/utils";
import AsyncLayoutDynamic from "@/containers/async-layout-dynamic";
import { Roboto, Roboto_Mono } from "next/font/google";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const robotoMono = Roboto_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={cn(
          roboto.variable,
          robotoMono.variable,
          "h-full bg-background font-sans antialiased",
        )}
      >
        <AsyncLayoutDynamic>{children}</AsyncLayoutDynamic>
      </body>
    </html>
  );
}