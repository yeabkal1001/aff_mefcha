"use client";

import {
  AudioLines,
  BarChart3,
  Map as MapIcon,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * `href` is null for screens that do not exist yet. They stay visible rather
 * than being cut, because the sidebar is also how the demo shows the shape of
 * the product — but they do not pretend to be links.
 */
const NAV: { label: string; icon: LucideIcon; href: string | null }[] = [
  { label: "Practice", icon: AudioLines, href: "/practice" },
  { label: "Your plan", icon: MapIcon, href: "/plan" },
  { label: "Progress", icon: BarChart3, href: null },
  { label: "Settings", icon: SlidersHorizontal, href: null },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main">
      <ul className="space-y-px">
        {NAV.map(({ label, icon: Icon, href }) => {
          const isActive = href !== null && pathname === href;

          const content = (
            <>
              <Icon
                className={cn(
                  "size-[1.0625rem] shrink-0 transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
                strokeWidth={1.75}
              />
              {label}
            </>
          );

          const className = cn(
            "group flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left",
            "text-[0.8125rem] transition-colors duration-200",
            isActive
              ? "font-medium text-foreground"
              : "text-foreground/70 hover:bg-foreground/[0.035] hover:text-foreground",
            href === null && "cursor-default opacity-55 hover:bg-transparent",
          );

          return (
            <li key={label}>
              {href ? (
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <span className={className} aria-disabled>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
