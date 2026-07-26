"use client";

import { AnimatePresence, motion } from "motion/react";

import { useShell } from "@/components/shell/shell-context";
import { BrandMark } from "@/components/sidebar/brand-mark";
import {
  SidebarContent,
  type SidebarData,
} from "@/components/sidebar/sidebar-content";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Three presentations of one sidebar, chosen by viewport rather than by state.
 *
 * Below `md` there is no room for a 216px column beside a stage built around a
 * centred orb, so the sidebar becomes a drawer and the brand mark becomes its
 * trigger. At `md` and up it is an inline panel that collapses to the same
 * brand-mark rail — which is why the rail is one component and not two.
 */
export function AppSidebar({ data }: { data: SidebarData }) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useShell();

  return (
    <>
      {/* Phones and small tablets: a trigger in the corner, and a drawer.
          Positioned out of flow so the sidebar costs no horizontal space on
          the viewport that has the least of it. */}
      <div className="absolute left-0 top-0 z-20 p-2.5 md:hidden">
        <SidebarRailButton
          label="Open menu"
          onClick={() => setMobileOpen(true)}
          expanded={mobileOpen}
        />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="flex w-[17rem] max-w-[85vw] flex-col gap-0 bg-sidebar p-2.5"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigation, chat history and today&apos;s progress.
          </SheetDescription>
          <SidebarContent data={data} />
        </SheetContent>
      </Sheet>

      {/* Desktop: inline, collapsible. */}
      <div className="hidden md:contents">
        <AnimatePresence initial={false} mode="popLayout">
          {collapsed ? (
            <motion.div
              key="rail"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 p-2.5"
            >
              <SidebarRailButton
                label="Open sidebar"
                onClick={toggleCollapsed}
                expanded={false}
              />
            </motion.div>
          ) : (
            <motion.aside
              key="panel"
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="surface-panel relative z-10 m-2.5 flex w-[13.5rem] shrink-0 flex-col rounded-2xl p-2.5 shadow-panel"
            >
              <SidebarContent data={data} onCollapse={toggleCollapsed} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function SidebarRailButton({
  label,
  onClick,
  expanded,
}: {
  label: string;
  onClick: () => void;
  expanded: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-expanded={expanded}
          className="rounded-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <BrandMark className="size-8" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
