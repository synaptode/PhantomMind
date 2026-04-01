# Changelog

All notable changes to this project will be documented in this file.

## [0.1.7] - 2026-04-01

### Added
- 7 new test files covering previously untested modules:
  - `providers/router.test.ts` (19 tests) — fallback chain, budget management, events
  - `providers/base.test.ts` (12 tests) — config redaction, message building, cost estimation
  - `quality/secret-scanner.test.ts` (20 tests) — 11 secret pattern types, redaction, custom patterns
  - `quality/hallucination-guard.test.ts` (13 tests) — import/file validation, language-aware detection
  - `schemas/registry.test.ts` (34 tests) — CRUD, validation, search, Zod conversion, persistence
  - `agent/retry.test.ts` (16 tests) — 5 retry strategies, selection logic, max retries
  - `adapters/adapters.test.ts` (12 tests) — all 4 adapter formats and content generation

### Fixed
- **Hallucination guard language detection bug** — `import numpy` in Python files was incorrectly flagged as an unknown Swift module. Added file-extension-based language detection (`getLanguage()`) so Python imports are checked first for `.py` files and Swift imports are scoped to `.swift` files.

### Stats
- **Test files:** 19 | **Tests:** 154 (up from 12 files / 28 tests — 450% increase)

## [0.1.6] - 2026-04-01

### Fixed
- Fixed npm README not rendering on npmjs.com website — added missing LICENSE files to packages, re-published to force npm CDN cache refresh

## [0.1.5] - 2026-03-31

### Added
- GitHub Actions CI workflow — runs build + tests on Node 18/20/22 for every push and PR to `develop`/`main`
- GitHub Actions Release workflow — auto-publishes `@phantomind/contracts` and `@phantomind/core` to npm on version tag push
- `vitest.config.ts` with V8 code coverage (`npm run test:coverage`)
- `test:coverage` npm script
- Test for `statsCommand` CLI
- Test for `dashboardCommand` CLI
- `CHANGELOG.md`

### Stats
- **Test files:** 12 | **Tests:** 29+

## [0.1.4] - 2026-03-31

### Added
- `@phantomind/contracts@0.1.0` — shared TypeScript domain contracts (`DashboardMetrics`, `CostReport`, `AuditEntry`, `CostPeriod`)
- `@phantomind/dashboard` — Angular 21 observability dashboard UI (private)
  - Standalone components with Angular Signals
  - `DashboardStore`, `DashboardAuthService`, `MetricCardComponent`
  - Period selector, auto-refresh, proxy config
- `ObservabilityService` — aggregated facade over `AuditTrail` + `CostTracker`
- `DashboardServer` — Node.js HTTP server (`/api/health`, `/api/metrics`, `/api/costs`, `/api/audit`) with bearer auth, CORS, SPA static serving
- `phantomind dashboard` CLI command
- `observability-service.test.ts` (6 tests) and `dashboard-server.test.ts` (8 tests)
- Root build script now builds `contracts` → `core` in sequence

### Stats
- **Test files:** 10 | **Tests:** 26

## [0.1.3] - 2026-03-31

### Added
- Tests for CLI commands: `init`, `compare`, `context`, `diff`
- Fixed npm metadata (repo URL, homepage, bugs URL)
- Updated README docs for all commands including `dashboard`

### Fixed
- Observability TypeScript errors: internalized `CostPeriod` and `DashboardMetrics` types from `@phantomind/contracts` into `src/types.ts`
- `dashboard-server.ts` type errors for `handleRequest` options

## [0.1.2] - 2026-03-31

### Added
- Tests for config loader, project template detection, rules generator, template engine
- Automated test infrastructure with Vitest

### Stats
- **Test files:** 4 | **Tests:** 8

## [0.1.1] - 2026-03-31

### Added
- `phantomind init` simplification with auto-detect
- Auto-generated `RULES.md`
- Enhanced pattern detection in learner
- `phantomind diff`, `context`, `compare`, `watch`, `hooks` CLI commands
- Template engine inline template support
- Config loader backward compatibility

## [0.1.0] - 2026-03-30

### Added
- Initial release of `@phantomind/core`
- Context engine with layer-based prioritization
- Provider router with multi-model support (OpenAI, Anthropic, Gemini, Ollama)
- Agent executor with task decomposition, retry intelligence, memory
- Quality gates: secret scanner, hallucination guard, consistency enforcer
- Observability: audit trail, cost tracker, analytics dashboard
- MCP server integration
- Schema registry for structured output
- Adapter sync for Copilot and Cursor
- `phantomind init`, `learn`, `sync`, `serve`, `eval`, `validate`, `audit`, `stats`, `agent`, `schema` commands
