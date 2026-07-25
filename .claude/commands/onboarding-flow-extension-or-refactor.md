---
name: onboarding-flow-extension-or-refactor
description: Workflow command scaffold for onboarding-flow-extension-or-refactor in aff_mefcha.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /onboarding-flow-extension-or-refactor

Use this workflow when working on **onboarding-flow-extension-or-refactor** in `aff_mefcha`.

## Goal

Extends or refactors the onboarding flow by adding new step components, updating onboarding logic/hooks, and adjusting related documentation and mock data.

## Common Files

- `client/components/onboarding/steps/*.ts*`
- `client/hooks/use-onboarding-draft.ts`
- `client/lib/onboarding.ts`
- `client/app/onboarding/page.tsx`
- `client/lib/mock-data.ts`
- `docs/product/onboarding.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update step components in client/components/onboarding/steps/
- Update onboarding logic in client/hooks/use-onboarding-draft.ts and/or client/lib/onboarding.ts
- Update onboarding page at client/app/onboarding/page.tsx
- Update or expand mock data in client/lib/mock-data.ts
- Update documentation in docs/product/onboarding.md and client/README.md

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.