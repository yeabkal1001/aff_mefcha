import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get started",
  description:
    "Nine questions and a four-minute conversation. We never ask your English level — we measure it.",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
