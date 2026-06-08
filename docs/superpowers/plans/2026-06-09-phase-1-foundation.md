# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable foundation for the family stock research app: project skeleton, family pool domain model, basic decision model, and a first dashboard screen.

**Architecture:** Start with a static local React/Vite/TypeScript app and pure TypeScript domain functions. Keep data local and deterministic in Phase 1 so the UI and tests stabilize before wiring live data sync.

**Tech Stack:** React, Vite, TypeScript, Vitest, Testing Library, local JSON seed data.

---

### Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Scaffold Vite React TypeScript files**

Create the minimal app shell with scripts:

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: dependency install succeeds and creates `package-lock.json`.

- [ ] **Step 3: Verify app compiles**

Run:

```bash
npm run build
```

Expected: Vite build succeeds.

### Task 2: Family Pool Domain Model

**Files:**
- Create: `src/domain/familyPool.ts`
- Create: `src/domain/familyPool.test.ts`

- [ ] **Step 1: Write failing tests**

Test ticker normalization, deduplication, status defaults, and tag merging.

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- src/domain/familyPool.test.ts
```

Expected: fails because module does not exist.

- [ ] **Step 3: Implement minimal domain functions**

Implement `normalizeTicker`, `createFamilyPoolItem`, and `mergeFamilyPoolItems`.

- [ ] **Step 4: Run tests and confirm pass**

Run:

```bash
npm test -- src/domain/familyPool.test.ts
```

Expected: tests pass.

### Task 3: Decision Domain Model

**Files:**
- Create: `src/domain/decision.ts`
- Create: `src/domain/decision.test.ts`

- [ ] **Step 1: Write failing tests**

Test data-health-first, risk veto, positive opportunity, and wait states.

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- src/domain/decision.test.ts
```

Expected: fails because module does not exist.

- [ ] **Step 3: Implement minimal decision engine**

Implement deterministic `deriveDecision` with Phase 1 labels:
`数据不足，暂不下结论`, `风险复盘`, `只观察不加仓`, `可继续持有`, `等待二买确认`, `可小仓试探`.

- [ ] **Step 4: Run tests and confirm pass**

Run:

```bash
npm test -- src/domain/decision.test.ts
```

Expected: tests pass.

### Task 4: First Dashboard Screen

**Files:**
- Create: `src/data/seedFamilyPool.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Test that the app renders title, family pool cards, status tags, data health, and decision labels.

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: fails because rendered UI is not implemented.

- [ ] **Step 3: Implement first screen**

Build a restrained dashboard: header, family pool list, selected stock analysis card, and data-health summary.

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests and build pass.

### Task 5: Commit and Push

**Files:**
- All project files.

- [ ] **Step 1: Check status**

Run:

```bash
git status --short
```

- [ ] **Step 2: Commit**

Run:

```bash
git add .
git commit -m "feat: scaffold phase 1 foundation"
```

- [ ] **Step 3: Push**

Run:

```bash
git push
```

