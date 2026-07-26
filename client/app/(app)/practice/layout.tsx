import type { Metadata } from "next";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Practice",
  description: "Today's Mission: a themed set of short speaking activities.",
};

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
