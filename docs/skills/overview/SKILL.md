---
name: overview
description: Claw Insights project architecture, directory structure, tech stack, and data flow. Use when navigating the codebase, understanding how components connect, or explaining the system design.
---

# Claw Insights — Project Overview

Claw Insights is a monitoring dashboard for OpenClaw AI agents. It tracks sessions, tokens, metrics, errors, and system resources via a GraphQL API + React web UI.

## Quick Reference

```
claw-insights/
├── packages/server/     Express + GraphQL Yoga + SQLite + Satori
├── packages/web/        React 19 + Vite + Tailwind + ECharts + urql
└── packages/shared/     TypeScript types (codegen output)
```

**Data pipeline:** OpenClaw logs + CLI → log-tailer/gateway-cli/session-reader → SQLite → GraphQL resolvers → React dashboard

| Layer | Technology |
|-------|-----------|
| Server | Express, GraphQL Yoga, node:sqlite, Satori + resvg |
| Web | React 19, urql, ECharts, Tailwind CSS, Vite |
| Shared | GraphQL Codegen → TypeScript types |
| Schema | Single `schema.graphql` → typed resolvers + client ops + shared types |

## Details

For full documentation, see:
- [Architecture](../../architecture.md) — data flow, directory structure, design decisions, development workflow
