import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Providers } from "../components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MemorySeal — Evidence-bound canonical memory",
    template: "%s · MemorySeal",
  },
  description:
    "MemorySeal binds evidence provenance, freshness, corroboration and exact consensus outcomes before claims advance canonical memory.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0b0c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
