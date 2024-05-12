"use client";
import "./globals.css";
import { cn } from "@/lib/utils";
import AsyncLayoutDynamic from "@/containers/async-layout-dynamic";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={cn(
          "h-full bg-background font-sans antialiased",
          GeistSans.className,
        )}
      >
        <AsyncLayoutDynamic>{children}</AsyncLayoutDynamic>
      </body>
    </html>
  );
}
