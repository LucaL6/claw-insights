# Contributing to Claw Insights

Thank you for considering contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/LucaL6/claw-insights.git
cd claw-insights
npm install
npm run dev
# Starts 3 processes: codegen (watch) + server (41041) + web (41042)
```

Prerequisites: Node.js ≥22.5 (`nvm use` reads `.nvmrc`)

## Making Changes

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your changes with tests
3. Run the test suite: `npm test`
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation
   - `chore:` maintenance
   - `test:` test changes
   - `perf:` performance
5. Push and open a Pull Request

## Pull Request Guidelines

- Fill in the PR template
- Ensure CI passes (`npm test`)
- New features must include tests
- Breaking changes must be discussed in an Issue first
- One logical change per PR

## Code Style

- TypeScript strict mode, no `any`
- Prettier for formatting (`npm run format` / `npm run format:check`)
- Use existing patterns — check neighboring files

## Project Structure

```
packages/
├── server/   Express + GraphQL Yoga + SQLite + Satori renderer
├── web/      React 19 + Vite + Tailwind + ECharts + urql
└── shared/   Codegen TypeScript types (shared between server & web)
```

GraphQL schema lives in `packages/server/src/schema/schema.graphql`. After editing, run `npm run codegen` to regenerate types.

## Testing

```bash
npm test                    # All unit tests (server + web + scripts)
npm run test:server         # Server unit tests (vitest)
npm run test:web            # Web unit tests (vitest)
npm run test:integration    # Integration tests
npm run test:e2e            # E2E tests (Playwright)
npm run test:coverage       # Coverage report
```

## Reporting Bugs

Use the [Bug Report](https://github.com/LucaL6/claw-insights/issues/new?template=bug_report.md) template. Include:
- Environment (OS, Node version, OpenClaw version)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## Feature Requests

Open an [Issue](https://github.com/LucaL6/claw-insights/issues/new?template=feature_request.md) describing:
- Use case and motivation
- Proposed solution
- Alternatives considered

## Questions

Open a [Discussion](https://github.com/LucaL6/claw-insights/discussions) for usage questions.
