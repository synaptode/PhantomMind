# @phantomind/contracts

Shared TypeScript domain contracts for PhantomMindAI.

This package provides the public type definitions used across the PhantomMindAI ecosystem — consumed by `@phantomind/core` and the Angular observability dashboard.

## Install

```bash
npm install @phantomind/contracts
```

## Types

### `DashboardMetrics`

Aggregated metrics returned by the `/api/metrics` endpoint.

```ts
import type { DashboardMetrics } from '@phantomind/contracts';
```

| Field | Description |
|---|---|
| `overview` | Total requests, cost, tokens, active providers |
| `performance` | Avg response time, success rate, error count |
| `quality` | Secrets detected, hallucinations, consistency issues |
| `agents` | Tasks completed/failed, avg steps per task |

### `CostReport`

Cost breakdown for a given period returned by `/api/costs`.

```ts
import type { CostReport, CostPeriod } from '@phantomind/contracts';
```

`CostPeriod` is one of `'today' | 'week' | 'month' | 'all'`.

### `AuditEntry`

A single audit log entry from `/api/audit`.

```ts
import type { AuditEntry } from '@phantomind/contracts';
```

## License

MIT
