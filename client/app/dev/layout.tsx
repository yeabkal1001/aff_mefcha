import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Internal tooling. Never indexed, never linked from the product.
export const metadata: Metadata = {
  title: "Internal",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Development-only, enforced rather than assumed.
 *
 * `robots: noindex` asks a crawler not to list the page; it does not stop
 * anyone who guesses the URL. These are internal reference screens and a real
 * deployment should behave as though they do not exist, so in production they
 * do not — the 404 is the same one an unknown path gets, which gives away
 * nothing about what is behind it.
 */
export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  return children;
}
