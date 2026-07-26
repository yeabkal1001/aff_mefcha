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

import { useShell } from "@/components/shell/shell-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * `href` is null for screens that do not exist yet. They stay visible rather
 * than being cut, because the sidebar is also how the product shows its own
 * shape — but a placeholder has to say so. Each one carries a "Soon" chip and
 * a tooltip that names what will be there, so nobody clicks twice wondering
 * whether it is broken.
 */
interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string | null;
  /** Why this is not here yet. Shown on hover and to screen readers. */
  soon?: string;
}

const NAV: NavItem[] = [
  { label: "Practice", icon: AudioLines, href: "/practice" },
  { label: "Your plan", icon: MapIcon, href: "/plan" },
  { label: "Progress", icon: BarChart3, href: "/progress" },
  { label: "Settings", icon: SlidersHorizontal, href: "/settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  // On a phone the nav lives in a drawer, and a drawer that stays open over
  // the screen it just navigated to is a bug in every product that has one.
  const { setMobileOpen } = useShell();

  return (
    <nav aria-label="Main">
      <ul className="space-y-px">
        {NAV.map((item) => (
          <li key={item.label}>
            <NavRow
              item={item}
              active={item.href === pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const { label, icon: Icon, href, soon } = item;

  const className = cn(
    "group flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left",
    "text-ui transition-colors duration-200",
    active
      ? "font-medium text-foreground"
      : "text-foreground/70 hover:bg-foreground/[0.035] hover:text-foreground",
    href === null && "cursor-default text-foreground/45 hover:bg-transparent",
  );

  const body = (
    <>
      <Icon
        className={cn(
          "size-[1.0625rem] shrink-0 transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground group-hover:text-foreground",
          href === null && "group-hover:text-muted-foreground",
        )}
        strokeWidth={1.75}
      />
      <span className="flex-1 truncate">{label}</span>
      {soon && (
        <span className="shrink-0 rounded-full bg-foreground/[0.06] px-1.5 py-px text-micro font-semibold uppercase tracking-wide text-muted-foreground">
          Soon
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        {body}
      </Link>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Focusable rather than inert: a keyboard learner should be able to
            reach the explanation, which is the only thing it offers. */}
        <span tabIndex={0} aria-disabled className={className}>
          {body}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="max-w-[15rem]">
        {soon}
      </TooltipContent>
    </Tooltip>
  );
}
