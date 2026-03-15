# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Stabilize startup and isolate smoke tests:
  - Lazy asset loading with fallback to prevent startup crash on missing files
  - Node runtime policy wiring for daemon and foreground modes
  - Centralize data directory via `paths.ts` with `CLAW_INSIGHTS_HOME` env var override
  - Smoke script isolation: temp home dir, random ports, port-conflict abort guard
  - CI/release gates: tarball asset checks, runtime parity, smoke tests

## [0.1.0] - 2026-03-14

Initial release — full-featured observability dashboard for OpenClaw agents.

### Core Dashboard

- Real-time monitoring dashboard with two-panel layout (sessions + metrics)
- Collapsible sidebar with Dashboard / Logs navigation
- Responsive layout with mobile detection (`useIsBelowMd`)
- TopBar with gateway status, channels, CPU/MEM, and snapshot button
- Dark / Light theme with CSS variable theming and runtime toggle
- English and Chinese (中文) i18n with runtime switching and browser detection

### Session Management

- Live session viewer with sub-agent tree and token usage progress
- Session hierarchy with `spawnedBy` parent-child relationships
- Sub-agent status tags (Active / Idle / Done) with model badges
- Session Detail Drawer with full transcript replay
- TranscriptTimeline: role separation (user/assistant/tool), Markdown rendering, code highlighting
- Per-turn token tracking (in/out/cache) and model name display
- Cursor-based transcript pagination with server LRU cache
- TimelineScrubber for timeline navigation and jump-to-end
- SpawnPromptBox for sub-agent spawn prompt display
- Incremental transcript refresh (append-only, no full reload)

### Metrics & Charts

- Metrics charts: tokens (per-model stacked area), sessions (bar), errors (bar), uptime (strip)
- Time range selector: 30m / 1h / 6h / 12h / 24h
- Per-model token breakdown with colored legend and model selector
- ECharts-based chart system with custom dark/light theme
- Lifetime stats with background scanner

### Event Logs

- Structured event log viewer (LogPage) with type filtering and search
- Density heatmap strip (DensityStrip) for 24h event distribution
- Event counts summary (error / warning / restart)

### Snapshot API

- `POST /api/snapshot` — server-rendered status cards (zero browser dependency)
- `claw-insights snapshot` — CLI command for quick captures
- Output formats: PNG (Satori + resvg @2x), SVG, JSON
- Detail levels: compact, standard, full (auto-degradation on oversized output)
- Themes: dark, light | Languages: en, zh
- 30-minute time range option (`?range=30m`)
- Per-model token usage breakdown with stacked progress bar
- Session turn count display from persistent message event tracking
- Token usage trend indicator (↑/↓ % vs previous period, ⚠️ for spikes >100%)
- Companion days counter and total conversations
- V2 visual design: Inter font (5 weights), 390px mobile-first viewport, indigo/violet palette, glass card styling
- Rate limiting (token bucket) and request coalescing for identical params
- Render pool with concurrency control and queue management

### Data Pipeline

- `message_events` table for persistent per-message tracking (DB migration v8)
- `MessageEventBus` for message event pipeline
- Token usage event sourcing with delta aggregation (SUM)
- Incremental scanner with tiered startup (recent → full)
- TranscriptWatcher for real-time log observation
- Database init with dependency injection and migration compression

### Architecture

- Hexagonal port/adapter architecture (gateway, sessions, metrics, logs, cron, system)
- Source-centric GraphQL schema v2 with `AgentNamespace` / `DashboardNamespace`
- `SourceRegistry` + `SourceAdapter` pattern for extensible data sources
- `RequestMemo` (WeakMap) for per-request gateway snapshot deduplication
- Platform abstraction layer for cross-platform support

### API & Auth

- GraphQL API (graphql-yoga) with SSE subscriptions (`dataChanged`, `logs`)
- `useReactiveQuery` hook for subscription-driven auto-refresh
- Token-based authentication with auto-generated secrets
- Cookie-based session with 7-day expiry and auto-refresh on rotation
- Auth session rotation runner with configurable intervals
- Request access logging with endpoint classification and sampling
- Cookie exchange middleware (`?token=` → `claw_session`)
- Health endpoint: `GET /health`
- Local-only binding (`127.0.0.1`) with Host header validation

### CLI

- `claw-insights start` — daemon mode with background process management
- `claw-insights stop` / `restart` / `status` / `logs` — service management
- `claw-insights snapshot` — standalone snapshot without full server
- `claw-insights run` — foreground server mode
- `--open` flag for auto-opening browser on start
- CLI spinner during startup with ready detection
- Saved args persistence for restart without explicit flags
- Default ports: server 41041, web dev 41042

### Developer Experience

- Layered logging system (pino stages 1–3) with log page text selection
- Typography unification (IBM Plex Sans / Inter / JetBrains Mono)
- Project logo and model-specific color mapping
- Responsive chart layout with `@tanstack/react-virtual` for large lists
- GraphQL codegen with 3 targets (shared types, resolver types, web client preset)
- TypeScript strict mode, ESLint strictification (eqeqeq, curly, import-sort)
- Prettier formatting with format/format:check scripts
- Local CI simulation scripts

### AI Agent Integration

- `AGENTS.md` — structured skill index for AI agents
- `docs/skills/install/SKILL.md` — installation and configuration skill
- `docs/skills/snapshot/SKILL.md` — snapshot capture skill
- Skills aligned with three-pillar positioning (zero intrusion, full replay, shareable snapshots)

### Testing

- 2600+ test cases across 296 test files
- Server unit tests (vitest) with branch coverage 93%+
- Web unit tests (vitest + @testing-library/react + happy-dom)
- Integration tests for snapshot pipeline
- E2E tests (Playwright)
- Docker smoke test suite (25 checks across 5 phases)

### Documentation

- README with hero montage, three-pillar badges, and bilingual support (EN / 中文)
- `docs/configuration.md` — all env vars, config file, auth model
- `docs/architecture.md` — system design, data flow, directory structure
- `docs/api-reference.md` — GraphQL + REST endpoint signatures
- `CONTRIBUTING.md` — development setup, PR guidelines, code conventions
- `SECURITY.md` — vulnerability reporting and security model
- Issue templates (bug report, feature request) and PR template

### Security

- Auth enabled by default (auto-generated token, minimum 32 characters)
- No-auth mode requires explicit opt-in (`--no-auth`)
- Local-only API binding with loopback address enforcement
- Gitleaks integration for secret scanning
