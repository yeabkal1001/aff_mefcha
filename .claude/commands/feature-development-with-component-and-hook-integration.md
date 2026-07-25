---
name: feature-development-with-component-and-hook-integration
description: Workflow command scaffold for feature-development-with-component-and-hook-integration in aff_mefcha.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-component-and-hook-integration

Use this workflow when working on **feature-development-with-component-and-hook-integration** in `aff_mefcha`.

## Goal

Implements a new feature or screen by creating/updating React components, hooks, and mock data, often updating global styles and main layout/pages. Frequently involves session or onboarding flows.

## Common Files

- `client/app/[feature]/page.tsx`
- `client/components/[feature]/*.tsx`
- `client/hooks/*.ts`
- `client/lib/mock-data.ts`
- `client/app/globals.css`
- `client/app/layout.tsx`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update React components in client/components/[feature]/
- Create or update hooks in client/hooks/
- Update or create page files in client/app/[feature]/page.tsx
- Update mock data in client/lib/mock-data.ts
- Update global styles in client/app/globals.css if needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.