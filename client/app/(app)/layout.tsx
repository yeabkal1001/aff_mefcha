import type { Metadata } from "next";

import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  // The shell screens are the logged-in product. Nothing here is a landing
  // page and none of it should be indexed.
  robots: { index: false, follow: false },
};

/**
 * Never prerendered.
 *
 * Every screen under this layout is one learner's, and there is no such thing
 * as a build-time version of it — the build has no session, so the shell would
 * be rendered signed-out and shipped as the first paint for everyone. Marking
 * it dynamic also keeps the build free of runtime secrets, which is why it can
 * run in CI without a Clerk key.
 */
export const dynamic = "force-dynamic";

/**
 * The signed-in shell: ambient field, sidebar, and the screen itself.
 *
 * A route group rather than a path segment, so `/practice` and `/plan` keep
 * their URLs while sharing one mounted sidebar. That sharing is the point —
 * the collapse state and the ambient washes both survive navigation now.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
