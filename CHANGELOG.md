# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- 30-minute time range option for snapshots (`?range=30m`)
- Per-model token usage breakdown with stacked progress bar in snapshot
- Session turn count display (`💬 N turns`) from persistent message event tracking
- Token usage trend indicator (`↑/↓ N%` vs previous period, `⚠️` for spikes >100%)
- `message_events` table for persistent per-message tracking (DB migration v8)
- `MessageEventBus` for message event pipeline (mirrors `TokenEventBus` pattern)

### Changed

- **Snapshot Visual Rework (V2 Glassmorphism)**
  - New Inter font (replacing IBM Plex Sans) with 5 weights (400–800)
  - Unified 390px viewport for all detail levels (mobile-first)
  - Indigo/violet color scheme with gradient progress bars
  - Glass card styling (`backdrop-filter` inspired, Satori-compatible)
  - Merged gateway banner + metrics into compact status strip
  - Header: OpenClaw brand with companion time (`陪伴 N 天`) and online/offline status
  - Footer: version left, full datetime right (removed uptime display)
  - Default snapshot range changed from 6h to 24h
  - New data fields: `companionDays`, `hostname`, `totalConversations`
- Snapshot metrics section condensed from 4-card grid to single-line summary
- Snapshot charts (sparklines, uptime bar) replaced with stacked token usage bar
- Snapshot errors section now hidden when error count is 0
- Token usage in snapshot now shows per-model breakdown with colored legend

## [0.1.0] - 2026-02-23

### Added

- Real-time monitoring dashboard for OpenClaw gateway
- Live session viewer with sub-agent tree, token usage, and context progress
- Metrics charts: sessions, tokens (per-model), errors, uptime over 1h/6h/12h/24h
- Structured event log viewer with density heatmap, type filtering, and search
- Gateway control operations: restart, update
- Screenshot API: `POST /api/snapshot` — capture dashboard as PNG
  - Detail levels: compact, standard, full
  - Themes: dark, light
  - Languages: en, zh
  - Server-side rendering via Satori + resvg (zero browser dependency)
- GraphQL API with subscriptions for real-time data
- Token-based authentication (auto-generated, URL-based like Jupyter)
- Dark / Light theme with CSS variable theming
- English and Chinese (中文) i18n
- SQLite-based metrics storage with configurable retention
- Health endpoint: `GET /health`
- Docker smoke test suite (25 checks across 5 phases)
- Comprehensive test suite: 1370+ tests across server and web packages

### Security

- Auth enabled by default in production (auto-generated token)
- API token minimum 32 characters enforced
- Cookie-based session with 7-day expiry
- No-auth mode requires explicit opt-in
