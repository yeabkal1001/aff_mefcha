"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * `next-themes` writes the `.dark` class the coach tokens key off, and reads
 * the system preference so a learner who runs their phone dark never gets a
 * white flash on the way in.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
