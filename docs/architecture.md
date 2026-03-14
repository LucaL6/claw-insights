# Architecture

## Overview

Claw Insights is a monorepo with three packages:

```
claw-insights/
├── packages/
│   ├── server/     Express + GraphQL Yoga + SQLite + Satori
│   ├── web/        React 19 + Vite + Tailwind + ECharts + urql
│   └── shared/     TypeScript types (codegen)
├── codegen.ts      GraphQL codegen → 3 targets
└── scripts/        Build + release tooling
```

## Data Pipeline

```
OpenClaw Gateway
    │
    ├── Log files (/tmp/openclaw/)
    │       │
    │       ▼
    │   collectors/log/tailer.ts ──► parse + classify ──► SQLite
    │
    ├── CLI / RPC (openclaw status --json)
    │       │
    │       ▼
    │   gateway-cli.ts ──► sessions, gateway status
    │
    └── sessions.json
            │
            ▼
        readers/session-reader.ts ──► session tree with sub-agents

SQLite ◄── collectors/metrics/collector.ts (periodic aggregation)
  │
  ▼
GraphQL Resolvers ──► GraphQL Yoga ──► Express
  │                                       │
  ▼                                       ▼
SSE Subscriptions                    REST endpoints
  │                                  (/api/snapshot, /health)
  ▼
urql + graphql-sse (Server-Sent Events)
  │
  ▼
React 19 Dashboard (ECharts, Tailwind)
```

## Server Architecture

### Directory Structure

```
packages/server/src/
├── routes/          HTTP entry points (Express)
│   ├── graphql.ts           GraphQL Yoga endpoint (/graphql)
│   ├── snapshot.ts          Screenshot API mount (POST /api/snapshot)
│   ├── snapshot-handler.ts  Screenshot request handler
│   ├── health.ts            Health check (GET /health)
│   ├── local-only.ts        Local-only access guard
│   └── spa-fallback.ts      SPA fallback for web UI
├── schema/          GraphQL schema + resolvers
│   ├── schema.graphql       Type definitions
│   ├── source/              Source-centric resolvers + adapters
│   └── resolvers/           Subscription resolvers
├── services/        Business logic (snapshot pipeline)
│   ├── snapshot-service.ts    Assemble snapshot data
│   ├── snapshot-engine.ts     Render orchestration + timeouts
│   ├── snapshot-types.ts      Request parsing + validation
│   ├── snapshot-formatters.ts Data formatting helpers
│   └── snapshot-sources.ts    Source data collection
├── sources/         Data adapters (external I/O)
│   ├── gateway-cli.ts              OpenClaw CLI wrapper
│   ├── aggregator.ts               Metrics aggregation
│   ├── companion-days.ts           Companion days calculator
│   ├── data-retention.ts           Hourly aggregation + cleanup
│   ├── data-validator.ts           Outlier detection
│   ├── system-info.ts              System resource info
│   ├── readers/                    File-based readers
│   │   ├── session-reader.ts       Session file parser
│   │   ├── cron-reader.ts          Cron jobs file reader
│   │   ├── transcript-reader.ts    Transcript file reader
│   │   └── spawn-tracker.ts        Sub-agent spawn tracker
│   └── collectors/                 Active data collectors
│       ├── log/tailer.ts           Log file tail + parse
│       ├── metrics/collector.ts    Periodic metrics collection
│       └── transcript/             Transcript processing pipeline
├── renderer/        Screenshot rendering (Satori)
│   ├── satori-renderer.ts     SVG → PNG pipeline
│   ├── fonts.ts               Font loading + cache
│   └── markup/                Satori JSX builders
│       ├── header.ts, footer.ts, token-usage.ts
│       ├── sessions.ts, charts.ts, errors.ts
│       ├── status-strip.ts, colors.ts, helpers.ts
│       └── index.ts           Assembles all sections
├── db/              SQLite database
│   ├── init.ts                Schema creation
│   ├── migrate.ts             Migration runner
│   ├── sqlite-provider.ts     SQLite connection provider
│   ├── event-queries.ts       Event query functions
│   ├── token-queries.ts       Token query functions
│   ├── message-queries.ts     Message query functions
│   └── scan-state-queries.ts  Scan state persistence
├── adapters/        Port adapters (bridge sources → GraphQL)
├── ports/           Port interfaces (dependency inversion)
├── pipeline/        Data processing pipeline orchestration
├── platforms/       OS-specific adapters (darwin/linux)
├── logging/         Layered logging system (pino)
├── auth/            Token auth + session rotation
├── middleware/      Express middleware (auth, access control)
├── cli/             CLI entry point + argument parsing
├── config.ts        Configuration loader
├── context.ts       GraphQL context factory
├── events.ts        Event bus (dataBus)
├── logger.ts        Structured logger (pino)
├── index.ts         Server entry point
└── __tests__/       Test files
```

### Key Design Decisions

- **No ORM** — Raw SQL via `node:sqlite` (Node.js built-in). Simple, fast, zero dependencies.
- **Satori for screenshots** — Server-side rendering without browser. Converts JSX-like objects → SVG → PNG via resvg.
- **SSE subscriptions** — `dataChanged` signal via Server-Sent Events (graphql-sse) triggers selective client refetch (debounced), not full data push.
- **Codegen** — Single `schema.graphql` generates typed resolvers (server), typed operations (web), and shared types.

## Web Architecture

### Directory Structure

```
packages/web/src/
├── components/      UI components
├── hooks/           Custom hooks (useSnapshot, useLogPageData, etc.)
├── graphql/         GraphQL operations (queries, subscriptions)
├── generated/       GraphQL codegen output (do not edit)
├── context/         React context providers
├── i18n/            Internationalization (en/zh)
├── theme/           Theme system (dark/light)
├── styles/          Global styles
├── lib/             Utility libraries (urql client, connection health)
├── utils/           Helper functions (format, groupByPrefix)
├── App.tsx          Root component
├── main.tsx         Entry point
├── index.css        Base styles
├── test/            Test utilities (setup, mocks)
└── __tests__/       Test files
```

### Tech Stack

- **React 19** with function components + hooks
- **urql** for GraphQL (queries + subscriptions)
- **ECharts** for metrics visualization
- **Tailwind CSS** with CSS variable theming (dark/light)
- **Vite** for dev server + production build
- **i18n** — Runtime language switching (en/zh) via React context

## Real-time Updates

1. Server detects data change (new log entry, session update, metric bucket)
2. Publishes `dataChanged` subscription signal with source identifier
3. Client receives signal, refetches only affected queries (debounced 500ms)
4. React components re-render with new data

This approach minimizes subscription payload while keeping the UI responsive.

## Session Hierarchy Authority

- **Single source of truth:** `~/.openclaw/agents/main/sessions/sessions.json` → `spawnedBy`
- `SessionReader.reload()` deterministically rebuilds parent/child hierarchy from `spawnedBy`
- Log-derived spawn events are **non-authoritative** for hierarchy correctness
- `SpawnTracker` is retained for diagnostics/telemetry and optional analysis workflows

This avoids split-brain behavior between session list and drawer, and makes hierarchy reproducible across reloads.

## Screenshot API

`POST /api/snapshot` renders the dashboard server-side:

1. `snapshot-service.ts` assembles `SnapshotData` from all sources
2. `markup/index.ts` builds Satori JSX tree (header → metrics → sessions → charts → errors → footer)
3. `satori-renderer.ts` converts JSX → SVG (via satori) → PNG (via @resvg/resvg-js)
4. Response: PNG binary with `Content-Disposition` + `X-Filename` headers

No browser required. Rendering takes ~200ms.

---

## Development

### Prerequisites

- Node.js ≥22.5 (use `nvm use` to auto-select from `.nvmrc`)
- npm ≥10
- Git
- OpenClaw gateway (for live data; optional for tests)

### Running

```bash
npm run dev              # Start codegen (watch) + server + web concurrently
npm run dev:server       # Server only (GraphQL API on :41041)
npm run dev:web          # Web only (Vite dev on :41042, proxies to :41041)
```

The web dev server proxies `/graphql` and `/api` to the server port.

Auth is **disabled** in development (`NODE_ENV=development`).

### Testing

```bash
# All tests
npm test

# Server tests (vitest)
npm run test:server
cd packages/server && npx vitest run              # All server
cd packages/server && npx vitest run src/routes/   # Specific directory
cd packages/server && npx vitest run --watch       # Watch mode

# Web tests (vitest)
npm run test:web

# E2E tests (Playwright)
npm run test:e2e

# Coverage
npm run test:coverage
```

#### Test conventions

- Test files: `__tests__/*.test.ts` next to source
- Use `vitest` + `vi.mock()` for unit tests
- TDD encouraged: write failing test → implement → pass

### GraphQL Codegen

The schema is the source of truth:

```bash
npm run codegen          # Generate types from schema.graphql
npm run codegen:watch    # Watch mode
```

**Generated files (do not edit manually):**

- `packages/shared/src/generated/` — Shared types
- `packages/web/src/generated/` — Client operations + typed hooks
- `packages/server/src/schema/generated/` — Resolver types

After changing `schema.graphql`, run codegen before testing.

### Code Style

- **TypeScript** strict mode, no `any` in production code
- **Prettier** for formatting: `npm run format`
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `perf:`

```bash
npm run format           # Auto-format all files
npm run format:check     # Check without modifying
```

### Building

```bash
npm run build            # Build all packages

# Release build (tarball)
bash scripts/build-release.sh 0.1.0
```

### Docker Smoke Test

Validates the full install → start → query → screenshot lifecycle:

```bash
bash sandbox/run-smoke.sh
```

Runs 25 checks across 5 phases in a clean Docker container.
