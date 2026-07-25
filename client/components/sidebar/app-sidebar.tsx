"use client";

import { PanelLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { BrandMark } from "@/components/sidebar/brand-mark";
import { ChatHistory } from "@/components/sidebar/chat-history";
import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { TipCard } from "@/components/sidebar/tip-card";
import { TodaysProgress } from "@/components/sidebar/todays-progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { coachTip, learner } from "@/lib/mock-data";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  speakingMinutes: number;
  corrections: number;
}

export function AppSidebar({
  collapsed,
  onToggle,
  speakingMinutes,
  corrections,
}: AppSidebarProps) {
  return (
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Open sidebar"
                aria-expanded={false}
                className="rounded-[0.5rem] transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <BrandMark className="size-8" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Open sidebar
            </TooltipContent>
          </Tooltip>
        </motion.div>
      ) : (
        <motion.aside
          key="panel"
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="surface-panel relative z-10 m-2.5 flex w-[11.5rem] shrink-0 flex-col rounded-xl p-2 shadow-[0_20px_60px_-40px_oklch(0.4_0.06_280/45%)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <BrandMark />
              <span className="min-w-0">
                <span className="block truncate text-[0.75rem] font-semibold leading-tight text-foreground">
                  {learner.name}
                </span>
                <span className="block text-[0.625rem] leading-tight text-muted-foreground">
                  {learner.plan}
                </span>
              </span>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label="Collapse sidebar"
                  aria-expanded
                  className="rounded-md p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <PanelLeft className="size-3.5" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="mt-3.5">
            <SidebarNav />
          </div>

          <div className="mt-3.5">
            <ChatHistory />
          </div>

          {/* Pushes the two cards to the bottom, as in the design. */}
          <div className="flex-1" />

          <div className="space-y-2">
            <TodaysProgress
              speakingMinutes={speakingMinutes}
              corrections={corrections}
            />
            <TipCard tip={coachTip} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
