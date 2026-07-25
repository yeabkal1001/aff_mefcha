---
name: ui-library-or-component-batch-integration
description: Workflow command scaffold for ui-library-or-component-batch-integration in aff_mefcha.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /ui-library-or-component-batch-integration

Use this workflow when working on **ui-library-or-component-batch-integration** in `aff_mefcha`.

## Goal

Integrates a new UI library or batch of shared UI components, updating package.json, adding multiple files to client/components/ui/, and updating global styles or config.

## Common Files

- `client/components/ui/*.tsx`
- `client/package.json`
- `client/app/globals.css`
- `client/components.json`
- `pnpm-lock.yaml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add new UI component files to client/components/ui/
- Update or add entries in client/package.json
- Update global styles in client/app/globals.css if needed
- Update or add to client/components.json or similar registry
- Update lockfile (pnpm-lock.yaml) if dependencies change

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.