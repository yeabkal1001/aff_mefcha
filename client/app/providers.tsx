"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

import { AuthBridge } from "@/components/auth-bridge";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Every client-side provider the tree needs, in one place.
 *
 * The root layout stays a server component this way, so the document shell and
 * its metadata are still rendered on the server.
 *
 * Clerk sits inside `ThemeProvider` rather than outside it, because its own
 * components have to follow the light/dark choice and `useTheme` is only
 * available below the provider that owns it.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ClerkShell>
        <QueryProvider>
          <TooltipProvider delayDuration={350}>
            {children}
            <Toaster />
          </TooltipProvider>
        </QueryProvider>
      </ClerkShell>
    </ThemeProvider>
  );
}

/**
 * Clerk, themed to match, and legible when it is not configured.
 *
 * Without a publishable key `ClerkProvider` throws on render — a blank screen
 * and a stack trace for what is really a missing line in `.env.local`. Saying
 * so plainly costs a dozen lines and saves the twenty minutes it otherwise
 * takes to work out that the stack trace is about configuration.
 *
 * Rendering `children` unauthenticated instead was the earlier answer here, and
 * it was worse: every `useAuth` and `useUser` below this point then throws its
 * own "must be used within ClerkProvider", turning one clear failure into a
 * dozen unclear ones several screens away.
 */
function ClerkShell({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) return <MissingClerkKey />;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        // `theme`, not `baseTheme`: the latter was renamed in Clerk 6 and the
        // old name is silently ignored rather than rejected, which is how a
        // dark sign-in box ends up white on a dark page with no error anywhere.
        theme: resolvedTheme === "dark" ? dark : undefined,
        variables: {
          // The one branded control, matched to `--primary` in globals.css.
          colorPrimary: "oklch(0.49 0.205 288)",
          borderRadius: "0.625rem",
        },
      }}
    >
      {/* Inside the provider, because `useAuth` only exists here. */}
      <AuthBridge />
      {children}
    </ClerkProvider>
  );
}

/** Deliberately unstyled by the design system, which may itself not be loaded. */
function MissingClerkKey() {
  return (
    <div style={{ padding: "3rem 1.5rem", maxWidth: "38rem", margin: "0 auto", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Authentication is not configured</h1>
      <p style={{ marginTop: "0.75rem" }}>
        Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> in{" "}
        <code>client/.env.local</code> and restart the dev server. The key is in
        the Clerk dashboard under API Keys, and starts with <code>pk_</code>.
      </p>
      <p style={{ marginTop: "0.75rem" }}>
        The server needs the matching <code>CLERK_SECRET_KEY</code> in{" "}
        <code>server/.env</code>.
      </p>
    </div>
  );
}
