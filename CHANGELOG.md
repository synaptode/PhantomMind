# Changelog

All notable changes to this project will be documented in this file.

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
