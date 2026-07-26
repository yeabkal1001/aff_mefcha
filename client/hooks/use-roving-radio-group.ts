"use client";

import { useCallback, useRef } from "react";

/**
 * Keyboard behaviour for a group of custom radio cards.
 *
 * A `role="radiogroup"` of `role="radio"` buttons is a promise to a screen
 * reader that arrow keys work and that the group is one tab stop. Without the
 * roving tabindex it is neither: every option is its own stop, and the arrow
 * keys scroll the page. This is the difference between labelling something a
 * radiogroup and it being one.
 *
 * Two option groups in the product need it — the choice stimulus and the
 * onboarding steps — which is why it is a hook rather than a component: the
 * two look nothing alike and share only their behaviour.
 */
export function useRovingRadioGroup<T extends string | number>({
  values,
  value,
  onChange,
  isDisabled,
}: {
  values: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  /** Unselectable options — the planned Life Paths. Arrow keys skip them. */
  isDisabled?: (value: T) => boolean;
}) {
  const nodes = useRef(new Map<T, HTMLElement | null>());
  const enabled = values.filter((option) => !isDisabled?.(option));
  const first = enabled[0] ?? values[0];

  const focus = useCallback((next: T) => {
    nodes.current.get(next)?.focus();
  }, []);

  const select = useCallback(
    (next: T | undefined) => {
      if (next === undefined) return;
      onChange(next);
      focus(next);
    },
    [focus, onChange],
  );

  const move = useCallback(
    (from: T, step: 1 | -1) => {
      const index = enabled.indexOf(from);
      if (index === -1) return;
      // Wraps, which is what a radiogroup does.
      select(enabled[(index + step + enabled.length) % enabled.length]);
    },
    [enabled, select],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, current: T) => {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          move(current, 1);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          move(current, -1);
          break;
        case "Home":
          event.preventDefault();
          select(enabled[0]);
          break;
        case "End":
          event.preventDefault();
          select(enabled[enabled.length - 1]);
          break;
      }
    },
    [enabled, move, select],
  );

  return {
    groupProps: { role: "radiogroup" as const },

    /** Spread onto each option. `as const` keeps the ARIA roles literal. */
    getRadioProps: (option: T) => ({
      role: "radio" as const,
      "aria-checked": option === value,
      // One tab stop for the whole group: the chosen option, or the first
      // selectable one if nothing has been chosen yet.
      tabIndex: (value === null ? option === first : option === value) ? 0 : -1,
      ref: (node: HTMLElement | null) => {
        nodes.current.set(option, node);
      },
      onClick: () => onChange(option),
      onKeyDown: (event: React.KeyboardEvent) => onKeyDown(event, option),
    }),
  };
}
