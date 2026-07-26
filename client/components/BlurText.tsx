"use client";

import { motion, useReducedMotion, type Easing, type Transition } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Text that resolves out of a blur, one word at a time.
 *
 * Originally a React Bits install; ours now, and changed in four ways that the
 * registry version gets wrong for this product:
 *
 * - It rendered a hard-coded `<p>`, so the landing page had no `<h1>`.
 * - Every word became its own `<span>`, which some screen readers announce as
 *   separate fragments. The spans are hidden and the whole string is exposed
 *   once, as an `aria-label`.
 * - It animated through Motion, which is JavaScript, so the global
 *   `prefers-reduced-motion` rule in globals.css could not touch it.
 * - Keys were array indices over text that changes between renders.
 */
type BlurTextElement = "p" | "h1" | "h2" | "h3" | "span" | "div";

interface BlurTextProps {
  text: string;
  /** The element to render. Defaults to a paragraph. */
  as?: BlurTextElement;
  /** Milliseconds between each word or letter starting. */
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Array<Record<string, string | number>>;
  easing?: Easing | Easing[];
  onAnimationComplete?: () => void;
  stepDuration?: number;
}

function buildKeyframes(
  from: Record<string, string | number>,
  steps: Array<Record<string, string | number>>,
): Record<string, Array<string | number>> {
  const keys = new Set<string>([
    ...Object.keys(from),
    ...steps.flatMap((step) => Object.keys(step)),
  ]);

  const keyframes: Record<string, Array<string | number>> = {};
  for (const key of keys) {
    keyframes[key] = [from[key], ...steps.map((step) => step[key])];
  }
  return keyframes;
}

export default function BlurText({
  text,
  as = "p",
  delay = 200,
  className,
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing = (t: number) => t,
  onAnimationComplete,
  stepDuration = 0.35,
}: BlurTextProps) {
  const reducedMotion = useReducedMotion();
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const segments = useMemo(
    () => (animateBy === "words" ? text.split(" ") : [...text]),
    [animateBy, text],
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom = useMemo(
    () =>
      direction === "top"
        ? { filter: "blur(10px)", opacity: 0, y: -50 }
        : { filter: "blur(10px)", opacity: 0, y: 50 },
    [direction],
  );

  const defaultTo = useMemo(
    () => [
      { filter: "blur(5px)", opacity: 0.5, y: direction === "top" ? 5 : -5 },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction],
  );

  const Tag = motion[as];

  // Reduced motion still gets the text, just not the reveal. Rendering the
  // string directly also drops the per-word spans entirely.
  if (reducedMotion) {
    return <Tag className={cn(className, "flex flex-wrap")}>{text}</Tag>;
  }

  const from = animationFrom ?? defaultFrom;
  const to = animationTo ?? defaultTo;
  const stepCount = to.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1),
  );
  const keyframes = buildKeyframes(from, to);

  return (
    <Tag
      ref={ref as never}
      className={cn(className, "flex flex-wrap")}
      aria-label={text}
    >
      {segments.map((segment, index) => {
        const transition: Transition = {
          duration: totalDuration,
          times,
          delay: (index * delay) / 1000,
          ease: easing,
        };

        return (
          <motion.span
            // The text is fixed per mount and segments are positional, so the
            // index is only unique alongside the segment itself.
            key={`${index}-${segment}`}
            aria-hidden
            initial={from}
            animate={inView ? keyframes : from}
            transition={transition}
            onAnimationComplete={
              index === segments.length - 1 ? onAnimationComplete : undefined
            }
            style={{ display: "inline-block", willChange: "transform, filter, opacity" }}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < segments.length - 1 && "\u00A0"}
          </motion.span>
        );
      })}
    </Tag>
  );
}
