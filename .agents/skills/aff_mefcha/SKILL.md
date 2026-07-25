```markdown
# aff_mefcha Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill covers the core development patterns and workflows used in the `aff_mefcha` TypeScript codebase. The repository is structured for modular feature development, with a focus on React components, hooks, and onboarding flows. It documents conventions for file naming, imports/exports, and provides step-by-step guides for common workflows such as adding features, extending onboarding, integrating UI libraries, and enhancing documentation.

## Coding Conventions

### File Naming

- **Files and folders** use **kebab-case**.
  - Example: `mock-data.ts`, `use-onboarding-draft.ts`, `practice-header.tsx`

### Import Style

- **Alias imports** are used for modules.
  - Example:
    ```typescript
    import { PracticeHeader } from '@/components/practice/practice-header';
    import useOnboardingDraft from '@/hooks/use-onboarding-draft';
    ```

### Export Style

- **Mixed exports**: Both default and named exports are present.
  - Example:
    ```typescript
    // Named export
    export function usePractice() { ... }

    // Default export
    export default PracticeHeader;
    ```

### Component Organization

- Components are grouped by feature under `client/components/[feature]/`.
- Shared UI components live in `client/components/ui/`.

### Mock Data

- Mock data is centralized in `client/lib/mock-data.ts`.

### Styles

- Global styles are managed in `client/app/globals.css`.

## Workflows

### Feature Development with Component and Hook Integration

**Trigger:** When adding a new interactive feature or screen (e.g., practice, onboarding).

**Command:** `/new-feature`

1. **Create or update React components** in `client/components/[feature]/`.
2. **Create or update hooks** in `client/hooks/`.
3. **Update or create page files** in `client/app/[feature]/page.tsx`.
4. **Update mock data** in `client/lib/mock-data.ts`.
5. **Update global styles** in `client/app/globals.css` if needed.
6. **Update main layout or sidebar** in `client/app/layout.tsx` or `client/components/sidebar/`.
7. **Update documentation** in `client/README.md` as needed.

**Example:**
```typescript
// client/components/practice/practice-header.tsx
export default function PracticeHeader() {
  return <header>Practice</header>;
}

// client/hooks/use-practice.ts
export function usePractice() {
  // custom hook logic
}
```

---

### Onboarding Flow Extension or Refactor

**Trigger:** When adding new steps, profile dimensions, or refactoring onboarding.

**Command:** `/extend-onboarding`

1. **Add or update step components** in `client/components/onboarding/steps/`.
2. **Update onboarding logic** in `client/hooks/use-onboarding-draft.ts` and/or `client/lib/onboarding.ts`.
3. **Update onboarding page** at `client/app/onboarding/page.tsx`.
4. **Expand mock data** in `client/lib/mock-data.ts`.
5. **Update documentation** in `docs/product/onboarding.md` and `client/README.md`.

**Example:**
```typescript
// client/components/onboarding/steps/new-step.tsx
export function NewStep() {
  return <div>New onboarding step</div>;
}
```

---

### UI Library or Component Batch Integration

**Trigger:** When adding a new UI library or reusable UI components.

**Command:** `/add-ui-library`

1. **Add new UI component files** to `client/components/ui/`.
2. **Update or add entries** in `client/package.json`.
3. **Update global styles** in `client/app/globals.css` if needed.
4. **Update or add to** `client/components.json` or similar registry.
5. **Update lockfile** (`pnpm-lock.yaml`) if dependencies change.

**Example:**
```typescript
// client/components/ui/button.tsx
export function Button({ children, ...props }) {
  return <button {...props}>{children}</button>;
}
```

---

### Feature Enhancement and Documentation Update

**Trigger:** When improving an existing feature and updating documentation.

**Command:** `/enhance-feature`

1. **Update or refactor existing components** in `client/components/[feature]/`.
2. **Update or refactor hooks** in `client/hooks/`.
3. **Update or refactor page files** in `client/app/[feature]/page.tsx`.
4. **Expand mock data** in `client/lib/mock-data.ts`.
5. **Update related documentation** in `docs/` and `client/README.md`.

**Example:**
```typescript
// client/components/practice/practice-header.tsx
export function PracticeHeader({ title }) {
  return <header>{title}</header>;
}
```

## Testing Patterns

- **Test files** follow the pattern `*.test.*` (e.g., `practice-header.test.tsx`).
- **Testing framework** is not explicitly detected; check test files for specifics.
- Place tests alongside their respective modules or in a `__tests__` directory.

**Example:**
```typescript
// client/components/practice/practice-header.test.tsx
import { render } from '@testing-library/react';
import PracticeHeader from './practice-header';

test('renders practice header', () => {
  render(<PracticeHeader />);
  // assertions here
});
```

## Commands

| Command            | Purpose                                                        |
|--------------------|----------------------------------------------------------------|
| /new-feature       | Start a new feature or screen with components and hooks        |
| /extend-onboarding | Add or refactor onboarding steps and logic                     |
| /add-ui-library    | Integrate a UI library or batch of reusable UI components      |
| /enhance-feature   | Enhance an existing feature and update related documentation   |
```
