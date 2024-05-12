import type { Preview } from "@storybook/react";
import "../app/globals.css";
import React from "react";
import { cn } from "../lib/utils";
import localFont from "next/font/local";

const GeistSans = localFont({
  src: "../fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist-sans",
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        className={cn(
          "dark h-screen w-screen bg-background font-sans antialiased",
          GeistSans.className,
        )}
      >
        {Story()}
      </div>
    ),
  ],
};

export default preview;
