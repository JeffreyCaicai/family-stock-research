# AGENTS.md

This document is the handoff guide for agents working on the Family Stock Research project.

## Project Mission

This project is a practical, A-share-first family stock research dashboard.

The product goal is to help the family analyze a focused stock pool with real market data, technical structure, risk review, and clear next actions. It is not an automatic trading system and must not make trades for the user.

The desired experience is:

- Enter or maintain a family stock pool.
- Sync real A-share market data when available.
- Show whether each conclusion is based on real data, cached data, sample data, or missing data.
- Generate an explainable single-stock conclusion.
- Highlight risks, buy-point candidates, key levels, and next manual review steps.

## Current Product Shape

The app currently supports:

- A React + Vite + TypeScript dashboard.
- A local family stock pool API.
- LocalStorage fallback for browser-only use.
- Python market sync pipeline with fixture, AKShare, BaoStock fallback hooks.
- Last-good market snapshot cache in the API.
- Data sync status and data reliability labels in the UI.
- Basic decision labels:
  - `数据不足，暂不下结论`
  - `风险复盘`
  - `只观察不加仓`
  - `可继续持有`
  - `等待二买确认`
  - `可小仓试探`
- Early technical structure layer:
  - daily / weekly / 60-minute coverage
  - center range approximation
  - second-buy candidate / confirmation
  - risk sell candidate

Important: the current Chan theory implementation is still a first practical approximation. It is not yet a full recursive Chanlun engine with complete fractals, strokes, segments, centers, divergence, consolidation divergence, first/second/third buy, and multi-level confirmation.

## Repository Layout

- `src/App.tsx`  
  Main dashboard UI: family pool list, selected stock analysis panel, refresh action, operation plan.

- `src/styles.css`  
  Main responsive styling. Be careful with layout width. The user previously flagged cramped and strange layouts.

- `src/domain/`  
  Pure domain logic. Prefer adding or changing logic here before changing UI directly.
  - `decision.ts`: final conclusion labels.
  - `dataSync.ts`: sync status and data reliability summaries.
  - `familyPool.ts`: ticker/status/tag normalization.
  - `operationPlan.ts`: action, trigger, invalidation, position discipline.
  - `technicalStructure.ts`: early structure-analysis rules.

- `src/data/`  
  Browser/API repositories and market snapshot overlay logic.

- `scripts/family_pool_api.mjs`  
  Local API for family pool read/write and one-stock market sync.
  Also caches the last good market snapshot in `data/market-cache.json`.

- `scripts/sync_market_data.py`  
  Python market sync pipeline. Supports fixture, AKShare, BaoStock, and auto fallback flow.

- `data/family-pool.json`  
  Local user data for the family stock pool. Treat this as private/local runtime data.

- `data/family-pool.example.json`  
  Safe example data.

- `data/market-sync-fixture.json`  
  Fixture data for offline sync and tests.

- `src/data/generated/marketSnapshots.json`  
  Generated snapshot file used by the frontend seed/overlay flow.

- `docs/product-design.md`  
  Product design and long-term direction.

- `docs/phase-1-plan.md`  
  Phase 1 implementation plan.

## Local Development

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Default frontend URL:

```text
http://localhost:5173/
```

Start the local API:

```bash
npm run api
```

Default API URL:

```text
http://localhost:8787
```

The frontend may also be opened through:

```text
http://127.0.0.1:5173/
```

The API CORS rules currently allow both `localhost:5173` and `127.0.0.1:5173`.

## Data Source Strategy

Free data sources are used first:

1. AKShare
2. BaoStock
3. Fixture data for offline validation

The current direction is practical reliability, not purity. If a source fails:

- The sync result should expose the failure reason.
- The API may return the last good cached snapshot when available.
- The UI must clearly label cached data as `缓存回退`.
- Cached data can be used for reference, but not as the latest real-time basis for an operation decision.

Never hide data source uncertainty. It is a core part of the product.

## Runtime Data Rules

Do not casually commit user runtime data.

Important files:

- `data/family-pool.json`: local family stock pool. Do not commit changes unless the user explicitly asks.
- `data/market-cache.json`: runtime cache. It is ignored by Git and should not be committed.
- `src/data/generated/marketSnapshots.json`: generated market snapshot output. Commit only when intentionally updating fixture-like generated state.

Current local user pool may include tickers such as:

- `002916`
- `600519`
- `688041`
- `688630`

Treat the exact list as local user state, not product seed data.

## Testing And Verification

Run focused tests first, then full verification.

Frontend/domain tests:

```bash
npm test
```

Python sync tests:

```bash
npm run test:sync
```

Local API tests:

```bash
npm run test:api
```

Production build:

```bash
npm run build
```

Dependency audit:

```bash
npm audit --omit=dev
```

In the Codex sandbox, `npm test`, `npm run build`, `npm run test:api`, and `npm audit` may require escalation because they write Vite/TypeScript temp files, listen on localhost, or access the npm registry.

## Development Principles

Use TDD for behavior changes:

1. Add or update a focused failing test.
2. Run it and confirm it fails for the expected reason.
3. Implement the smallest useful change.
4. Run the focused test.
5. Run full verification before committing.

Prefer pure domain logic before UI logic:

- If changing a conclusion, update `src/domain/decision.ts` and tests.
- If changing sync/reliability wording, update `src/domain/dataSync.ts` and tests.
- If changing family pool normalization, update `src/domain/familyPool.ts` and tests.
- If changing operation advice, update `src/domain/operationPlan.ts` and tests.

Keep the UI practical:

- The app is a research workbench, not a marketing landing page.
- Avoid decorative UI that hides data.
- Avoid wide cards that create horizontal overflow.
- Keep the selected stock analysis readable on desktop and mobile.
- Make risk and data uncertainty visible near the conclusion.

## Financial And Product Boundaries

Do not present output as guaranteed investment advice.

The system should support:

- research prioritization
- evidence gathering
- risk review
- scenario planning
- manual decision support

The system should not:

- auto-trade
- claim certainty
- hide stale data
- turn cached/sample data into a real-data conclusion
- produce a buy/sell command without conditions, invalidation, and risk notes

## Current Important Concepts

### Family Stock Pool

The system now uses one unified family stock pool. Do not split into separate "my stocks" and "dad's stocks" unless the user explicitly reopens that design.

### Data Reliability

The UI has a dedicated `行情依据` layer:

- `真实同步`: real source data is available.
- `缓存回退`: last good snapshot is being used because current sync failed.
- `数据不可用`: no valid basis for operation decisions.
- `等待同步`: ticker is known but market data is missing.
- `样例验证`: sample data only.

### Final Conclusion Layer

The conclusion should remain simple and actionable, but conditional:

- What is the current label?
- Why?
- What data supports it?
- What would invalidate it?
- What should the family manually check next?

### Chanlun / Technical Structure

Current implementation is intentionally conservative. Future work should improve:

- fractal detection
- stroke construction
- segment construction
- center recursion
- divergence / consolidation divergence
- first-buy / second-buy / third-buy distinction
- weekly / daily / 60-minute linked confirmation

Do not overstate the current technical signal quality.

## Recommended Next Steps

Highest-value next development work:

1. Strengthen real K-line sync:
   - stable daily K
   - weekly aggregation
   - 60-minute K
   - source attempts and timestamps

2. Improve single-stock conclusion depth:
   - key levels
   - scenario path
   - invalidation condition
   - risk-first operation plan

3. Make data freshness explicit:
   - last synced time
   - stale data warning
   - per-source failure reason
   - one-click resync result history

4. Improve Chanlun structure carefully:
   - first build reliable intermediate structures
   - test each structure layer independently
   - do not jump directly to final buy/sell labels

5. Add research notes:
   - manual notes per ticker
   - thesis / risk / next review date
   - event log

## Git Hygiene

Before committing:

```bash
git status --short
```

Do not stage `data/family-pool.json` unless explicitly requested.

Preferred commit style:

```text
feat: ...
fix: ...
test: ...
docs: ...
refactor: ...
```

When pushing, confirm only intended source/docs/test files are staged.

## Current Known Local State

The project may have local uncommitted changes in:

```text
data/family-pool.json
```

This is expected. Preserve it.

