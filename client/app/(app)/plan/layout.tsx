import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your plan",
  description: "The next thirty days, projected from your Life Path and level.",
};

export default function PlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
