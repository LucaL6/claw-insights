# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

_Nothing yet._

## [0.1.0] - 2026-02-23

### Added
- Real-time monitoring dashboard for OpenClaw gateway
- Live session viewer with sub-agent tree, token usage, and context progress
- Metrics charts: sessions, tokens (per-model), errors, uptime over 1h/6h/12h/24h
- Structured event log viewer with density heatmap, type filtering, and search
- Gateway control operations: restart, diagnostics (Doctor), update
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
