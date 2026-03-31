# 🔮 PhantomMindAI

**Universal AI Development Enhancement Layer**

> *"You already pay for Copilot, Cursor, or Claude. PhantomMindAI makes what you already have 10x more effective."*

[![npm version](https://img.shields.io/npm/v/@phantomind/core.svg)](https://www.npmjs.com/package/@phantomind/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

---

## What is PhantomMindAI?

PhantomMindAI solves the **context amnesia problem**: AI assistants forget everything about your project every session, every context switch, and every time a new team member onboards.

PhantomMindAI provides:

- **Persistent context layer** — one source of truth (`SKILLS.md`, `RULES.md`, `schema.json`) synced to every AI assistant automatically
- **Universal LLM abstraction** — one API for Anthropic, OpenAI, Gemini, Groq, Mistral, Ollama, DeepSeek, and OpenRouter, with automatic fallback and budget routing
- **Agentic task execution** — multi-role agent orchestration with human-in-the-loop checkpoints
- **AI output quality enforcement** — secret scanning, hallucination detection, dual-model verification, consistency checking
- **MCP Server** — expose project intelligence as a Model Context Protocol server for Cursor, Continue, Claude Code, and more
- **Full observability** — cost tracking, audit trails, and analytics dashboard

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Tutorial Lengkap](#tutorial-lengkap)
- [CLI Reference](#cli-reference)
- [Configuration](#configuration)
- [Supported AI Assistants](#supported-ai-assistants)
- [Supported LLM Providers](#supported-llm-providers)
- [Programmatic API](#programmatic-api)
- [MCP Server](#mcp-server)
- [Agent System](#agent-system)
- [Quality Layer](#quality-layer)
- [Observability](#observability)
- [Architecture](#architecture)
- [Development](#development)

---

## Installation

```bash
# Install globally (recommended — enables `phantomind` CLI)
npm install -g @phantomind/core

# Or install as a project dependency
npm install @phantomind/core

# Verify
phantomind --version
```

**Requirements:** Node.js ≥ 18

---

## Quick Start

### 1. Initialize in your project

```bash
npx phantomind init
```

This creates:

```
.phantomind/
  SKILLS.md       ← Auto-learned project patterns
  RULES.md        ← AI behavior rules
  schema.json     ← Output contracts
  config.yaml     ← PhantomMindAI configuration
```

### 2. Sync to your AI tools

```bash
npx phantomind sync
```

Generated adapter files (auto-updated, never edit directly):

```
.github/copilot-instructions.md   ← GitHub Copilot
.cursorrules                      ← Cursor
.clinerules                       ← Cline
.continue/config.json             ← Continue
.windsurfrules                    ← Windsurf
.zed/settings.json                ← Zed
.aider.conf.yml                   ← Aider
.claude/CLAUDE.md                 ← Claude Code CLI
AGENTS.md                         ← OpenAI Codex CLI
```

### 3. Use the programmatic API (optional)

```typescript
import { phantom } from '@phantomind/core';

await phantom.init();

// Complete with auto-routing across providers
const response = await phantom.complete('Refactor this function to use async/await');

// Run an agentic task
const result = await phantom.agent('Add input validation to the user registration endpoint');

// Semantic search across codebase
const matches = await phantom.search('authentication middleware');
```

---

## CLI Reference

```
phantomind [command] [options]
```

| Command | Description |
|---------|-------------|
| `phantomind init` | Initialize PhantomMindAI in the current project |
| `phantomind learn` | Scan codebase and regenerate learned project context |
| `phantomind sync` | Sync context to all configured AI assistant adapters |
| `phantomind diff` | Preview adapter output diffs without writing files |
| `phantomind context` | Preview ranked context or search context sections |
| `phantomind compare` | Compare generated adapter payloads |
| `phantomind watch` | Watch project files and refresh context automatically |
| `phantomind hooks` | Install git hooks to keep context in sync |
| `phantomind serve` | Start the MCP server (stdio or HTTP transport) |
| `phantomind dashboard` | Start the observability dashboard server |
| `phantomind eval` | Test and benchmark LLM provider connections |
| `phantomind validate [files...]` | Scan code for secrets, hallucinations, and consistency issues |
| `phantomind audit` | View cost reports and audit trail |
| `phantomind dashboard` | Start the observability dashboard server |
| `phantomind stats` | Display project context statistics |
| `phantomind agent <task>` | Execute an agentic task from the CLI |
| `phantomind schema [name]` | List or display schema definitions |

### `phantomind init`

```bash
phantomind init [options]

Options:
  --provider <name>   Optional LLM provider for agent/eval workflows
  --adapters <list>   Space-separated adapter list (e.g. copilot cursor cline)
  --template <name>   auto|default|node-library|node-cli|react-app|nextjs-app
  --yes               Skip interactive prompts
```

### `phantomind learn`

```bash
phantomind learn [options]

Options:
  --sync              Run adapter sync after learning
  --verbose           Show detailed output
```

### `phantomind sync`

```bash
phantomind sync [options]

Options:
  --adapters <list>   Only sync specific adapters
  --dry-run           Preview changes without writing files
  --verbose           Show per-file diff
```

### `phantomind diff`

```bash
phantomind diff [options]

Options:
  --adapters <list>   Only diff specific adapters
  --verbose           Show full diff output
```

### `phantomind context`

```bash
phantomind context [options]

Options:
  --file <path>       Rank context for a specific file
  --search <query>    Search across context sections
  --max-tokens <n>    Token budget for preview output
  --json              Emit raw JSON
```

### `phantomind compare`

```bash
phantomind compare [options]

Options:
  --adapters <list>   Only compare specific adapters
  --preview           Show generated content preview
```

### `phantomind watch`

```bash
phantomind watch [options]

Options:
  --sync              Run sync after each refresh
```

### `phantomind hooks`

```bash
phantomind hooks [options]

Options:
  --force             Overwrite existing git hooks
```

### `phantomind dashboard`

```bash
phantomind dashboard [options]

Options:
  --port <n>          Server port (default: 3101)
  --host <host>       Server host (default: 127.0.0.1)
  --ui <path>         Path to built dashboard assets
  --cors              Enable CORS for local development
  --token <token>     Require token for API access
  --token-env <name>  Env var containing dashboard token
  --token-query <q>   Optional query parameter name for token auth
```

### `phantomind validate`

```bash
phantomind validate [files...] [options]

Options:
  --no-secrets         Skip secret scanning
  --no-hallucinations  Skip hallucination detection
  --no-consistency     Skip consistency checking
  --fix                Auto-fix detected secrets (redaction)
```

### `phantomind audit`

```bash
phantomind audit [options]

Options:
  --period <p>   today|week|month|all (default: today)
  --type <t>     dashboard|costs|actions (default: dashboard)
  --format <f>   terminal|markdown|json
```

### `phantomind dashboard`

```bash
phantomind dashboard [options]

Options:
  --port <port>   Server port (default: 3101)
  --host <host>   Server host (default: 127.0.0.1)
  --ui <path>     Path to built dashboard assets
  --cors          Enable CORS for local dev
  --token <token> Require token for API access
  --token-env <n> Env var containing API token (default: PHANTOMIND_DASHBOARD_TOKEN)
  --token-query <n> Optional query param name for token
```

### `phantomind agent`

```bash
phantomind agent <task> [options]

Options:
  --role <role>          architect|implementer|securityReviewer|testWriter|documenter
  --orchestrate          Use multi-role orchestration
  --roles <list>         Roles for orchestration (e.g. architect,implementer,testWriter)
  --max-steps <n>        Maximum agent steps (default: 30)
```

---

## Configuration

PhantomMindAI is configured via `.phantomind/config.yaml`:

```yaml
# .phantomind/config.yaml

providers:
  primary:
    name: anthropic
    model: claude-opus-4-5
    apiKey: ${ANTHROPIC_API_KEY}
  fallback:
    name: openai
    model: gpt-4o
    apiKey: ${OPENAI_API_KEY}
  budget:
    name: groq
    model: llama-3.3-70b-versatile
    apiKey: ${GROQ_API_KEY}

adapters:
  - copilot
  - cursor
  - cline
  - continue

mcp:
  enabled: true
  port: 3333

budget:
  maxCostPerDay: 5.00
  warningAt: 0.80
  fallbackOnBudget: budget

agent:
  maxSteps: 30
  memory:
    enabled: true
    maxEntries: 200

quality:
  secretScanning: true
  hallucinationDetection: true
  dualVerification: false
```

### Environment Variables

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `OPENAI_API_KEY` | OpenAI (GPT) |
| `GEMINI_API_KEY` | Google Gemini |
| `GROQ_API_KEY` | Groq |
| `MISTRAL_API_KEY` | Mistral |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `OPENROUTER_API_KEY` | OpenRouter |

Provider-backed commands load `.phantomind/.env` when present. Core flows like `init`, `learn`, `sync`, `diff`, and `context` do not require API keys.

### Dashboard UI

If you build the optional Angular dashboard package, PhantomMindAI can serve both the API and the static UI:

```bash
npm run dashboard:build
phantomind dashboard
```

Without a built UI, `phantomind dashboard` still starts an API-only observability server.

---

## Supported AI Assistants

| Adapter | File Generated | Status |
|---------|---------------|--------|
| GitHub Copilot | `.github/copilot-instructions.md` | ✅ |
| Cursor | `.cursorrules` | ✅ |
| Cline | `.clinerules` | ✅ |
| Continue | `.continue/config.json` | ✅ |
| Windsurf | `.windsurfrules` | ✅ |
| Zed | `.zed/settings.json` | ✅ |
| Aider | `.aider.conf.yml` | ✅ |
| Claude Code | `.claude/CLAUDE.md` | ✅ |
| OpenAI Codex | `AGENTS.md` | ✅ |

---

## Supported LLM Providers

| Provider | Models | Notes |
|----------|--------|-------|
| **Anthropic** | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5 | Recommended primary |
| **OpenAI** | gpt-4o, gpt-4o-mini, o3, o4-mini | Excellent fallback |
| **Google Gemini** | gemini-2.0-flash, gemini-2.5-pro | Best for large context |
| **Groq** | llama-3.3-70b, mixtral-8x7b | Best budget option |
| **Mistral** | mistral-large-latest, codestral | Strong for code |
| **Ollama** | any local model | No API key, fully local |
| **DeepSeek** | deepseek-chat, deepseek-reasoner | Cost-efficient |
| **OpenRouter** | 200+ models | Meta-provider |

### Provider Routing

```yaml
providers:
  primary:   # Highest quality — used by default
    name: anthropic
    model: claude-opus-4-5
  fallback:  # Used if primary fails
    name: openai
    model: gpt-4o
  budget:    # Used when daily cost threshold exceeded
    name: groq
    model: llama-3.3-70b-versatile
  local:     # Used for offline/sensitive tasks
    name: ollama
    model: llama3.2
```

---

## Programmatic API

```typescript
import { phantom } from '@phantomind/core';

// Initialize (loads config, connects providers)
await phantom.init();

// Get project context (intelligent multi-layer Context)
const ctx = await phantom.ctx({ maxTokens: 4000 });

// Complete with context injection and auto-routing
const response = await phantom.complete('Explain the auth module', {
  maxTokens: 1000,
  temperature: 0.3,
});

// Complete with intelligent retry on failure
const result = await phantom.completeWithRetry('Implement JWT refresh logic');

// Run an agentic task (single role)
const agentResult = await phantom.agent('Refactor the payment service to use dependency injection', {
  role: 'implementer',
  maxSteps: 25,
});

// Multi-agent orchestration
const orchestrated = await phantom.orchestrate(
  'Build a rate limiting middleware',
  ['architect', 'implementer', 'securityReviewer', 'testWriter'],
);

// Semantic search across codebase
const matches = await phantom.search('database connection pooling', 5);
// returns: Array<{ path, score, snippet }>

// Sync adapters
await phantom.sync(['copilot', 'cursor'], /* dryRun */ false);

// Validate code
const { secrets, hallucinations } = await phantom.validate(code, 'auth.ts');

// Cost report
const costs = phantom.costs('today'); // 'today' | 'week' | 'month' | 'all'

// Analytics dashboard
const dashboard = phantom.dashboard();
console.log(dashboard.formatTerminal());

// Learn project patterns
const skills = await phantom.learn();

// Save state
await phantom.save();
```

---

## MCP Server

PhantomMindAI exposes a [Model Context Protocol](https://modelcontextprotocol.io) server providing 9 tools to any MCP-compatible AI assistant:

```bash
phantomind serve
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `get_project_context` | Full project context (skills, rules, schema) |
| `search_codebase` | Semantic search across indexed files |
| `validate_code` | Secret + hallucination scan |
| `get_schema` | Retrieve a named JSON/Zod schema |
| `list_schemas` | List all registered schemas |
| `complete` | LLM completion via provider router |
| `run_agent` | Execute an agentic task |
| `get_cost_report` | Current cost breakdown |
| `get_audit_log` | Recent audit entries |

### MCP Configuration (Claude Desktop / Continue)

```json
{
  "mcpServers": {
    "phantomind": {
      "command": "npx",
      "args": ["phantomind", "serve"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

---

## Agent System

### Roles

| Role | Specialization |
|------|---------------|
| `architect` | System design, architecture decisions, dependency planning |
| `implementer` | Feature implementation, code generation, refactoring |
| `securityReviewer` | Vulnerability scanning, threat modeling, secure coding |
| `testWriter` | Unit tests, integration tests, edge cases, mocks |
| `documenter` | API docs, README, inline comments, changelogs |

### Single-Agent Execution

```bash
phantomind agent "Add rate limiting to the API" --role implementer --max-steps 20
```

### Multi-Agent Orchestration

```bash
phantomind agent "Build OAuth2 integration" --orchestrate \
  --roles architect,implementer,securityReviewer,testWriter
```

Orchestration phases run sequentially with output aggregation between phases.

### Task Queue (Programmatic)

```typescript
import { phantom } from '@phantomind/core';

await phantom.init();

// Enqueue tasks
phantom.enqueue('Refactor database layer', { role: 'implementer', priority: 'high' });
phantom.enqueue('Write migration tests', { role: 'testWriter', priority: 'normal' });
```

---

## Quality Layer

### Secret Scanning

Detects and redacts API keys, tokens, passwords, and credentials:

```bash
phantomind validate src/ --secrets
```

Detects: AWS keys, GitHub tokens, Stripe keys, OpenAI keys, JWT secrets, PEM certificates, database connection strings, and 20+ other patterns.

### Hallucination Detection

Checks AI-generated code for:
- `import` statements referencing non-existent packages
- References to files that don't exist in the project
- Usage of type names not defined in the codebase

### Consistency Checking

Identifies inconsistencies across the codebase:
- Naming convention violations (camelCase vs snake_case drift)
- Mixed async patterns (callbacks vs promises vs async/await)
- Architectural boundary violations

### Dual-Model Verification

For critical outputs, a second model independently verifies correctness before acceptance.

---

## Observability

### Cost Tracking

```bash
phantomind audit --type costs --period week
```

Tracks cost per provider, per model, per day with budget alerts.

### Audit Trail

All agent actions are logged to `.phantomind/audit/audit.jsonl`:

```bash
phantomind audit --type actions
```

### Analytics Dashboard

```bash
phantomind audit --type dashboard
```

Displays: request count, total cost, success rate, response time, quality events, agent task completion.

---

## Architecture

```
packages/core/src/
├── types.ts              ← All shared TypeScript interfaces
├── index.ts              ← PhantomMind class + phantom singleton
│
├── config/               ← Config loading (cosmiconfig, .env, deep-merge)
├── providers/            ← LLM provider abstractions + router
│   ├── anthropic.ts
│   ├── openai.ts
│   ├── gemini.ts
│   ├── groq.ts
│   ├── mistral.ts
│   ├── ollama.ts
│   ├── deepseek.ts
│   ├── openrouter.ts
│   └── router.ts         ← Budget routing + fallback + EventEmitter
│
├── context/              ← Project context management
│   ├── engine.ts         ← Context orchestration
│   ├── embedder.ts       ← TF-IDF codebase indexer + semantic search
│   ├── learner.ts        ← Pattern learning → SKILLS.md generation
│   └── versioning.ts     ← SHA-256 change tracking
│
├── adapters/             ← AI assistant adapter sync
│   ├── base.ts
│   ├── copilot.ts, cursor.ts, cline.ts, continue.ts
│   ├── windsurf.ts, zed.ts, aider.ts, claude-code.ts, codex.ts
│   └── index.ts          ← syncAllAdapters()
│
├── mcp/                  ← MCP Server (9 tools)
│   └── server.ts
│
├── agent/                ← Agentic execution engine
│   ├── executor.ts       ← Single-agent loop (plan→act→verify)
│   ├── orchestrator.ts   ← Multi-agent orchestration
│   ├── decomposer.ts     ← Task decomposition (4 phases)
│   ├── roles.ts          ← Role system prompts
│   ├── memory.ts         ← Cross-session persistent memory
│   ├── retry.ts          ← 5 retry strategies
│   ├── queue.ts          ← Priority queue + cron scheduler
│   └── index.ts
│
├── quality/              ← Output quality enforcement
│   ├── secret-scanner.ts
│   ├── hallucination-guard.ts
│   ├── consistency.ts
│   ├── dual-verifier.ts
│   ├── regression.ts
│   └── anomaly.ts
│
├── schemas/              ← Schema registry (Zod + JSON Schema)
│   ├── registry.ts
│   └── index.ts          ← 7 prebuilt schemas
│
├── templates/            ← SKILLS.md + RULES.md templates
│   ├── SKILLS.template.md
│   ├── RULES.template.md
│   └── engine.ts
│
├── observability/        ← Audit, cost, dashboard
│   ├── audit.ts
│   ├── cost-tracker.ts
│   └── dashboard.ts
│
└── cli/                  ← CLI commands (Commander.js)
    ├── main.ts
    ├── init.ts, sync.ts, serve.ts, eval.ts
    ├── validate.ts, audit.ts, stats.ts, agent.ts
    └── index.ts
```

---

## Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Setup

```bash
git clone https://github.com/your-username/PhantomMindAI
cd PhantomMindAI
npm install
```

### Commands

```bash
# Build TypeScript
make build

# Watch mode (rebuild on changes)
make dev

# Run CLI locally (without building)
make run CMD="init"

# Run tests
make test

# Clean build artifacts
make clean

# Full rebuild
make rebuild

# Check types without emitting
make typecheck
```

### Project Structure

```
PhantomMindAI/
├── packages/
│   └── core/           ← @phantomind/core package
│       ├── src/
│       ├── dist/       ← Built output (gitignored)
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   └── PhantomMindAI_PRD.md
├── package.json         ← Monorepo root
├── tsconfig.json
├── Makefile
└── README.md
```

---

## Tutorial Lengkap

Panduan komprehensif langkah demi langkah tersedia di **[docs/TUTORIAL.md](docs/TUTORIAL.md)**, mencakup:

| # | Topik |
|---|-------|
| 1 | [Persiapan & Instalasi](docs/TUTORIAL.md#1-persiapan--instalasi) |
| 2 | [Inisialisasi Project Pertama](docs/TUTORIAL.md#2-inisialisasi-project-pertama) |
| 3 | [Memahami Struktur File](docs/TUTORIAL.md#3-memahami-struktur-file) |
| 4 | [Konfigurasi Provider LLM](docs/TUTORIAL.md#4-konfigurasi-provider-llm) |
| 5 | [Sync ke AI Assistant](docs/TUTORIAL.md#5-sync-ke-ai-assistant) |
| 6 | [Menggunakan CLI](docs/TUTORIAL.md#6-menggunakan-cli) |
| 7 | [Penggunaan Programmatic API](docs/TUTORIAL.md#7-penggunaan-programmatic-api) |
| 8 | [Sistem Agent](docs/TUTORIAL.md#8-sistem-agent) |
| 9 | [MCP Server](docs/TUTORIAL.md#9-mcp-server) |
| 10 | [Quality Validation](docs/TUTORIAL.md#10-quality-validation) |
| 11 | [Observability & Cost Tracking](docs/TUTORIAL.md#11-observability--cost-tracking) |
| 12 | [Schema Registry](docs/TUTORIAL.md#12-schema-registry) |
| 13 | [Workflow Tim](docs/TUTORIAL.md#13-workflow-tim) |
| 14 | [Tips & Trik](docs/TUTORIAL.md#14-tips--trik) |
| 15 | [Troubleshooting](docs/TUTORIAL.md#15-troubleshooting) |

---

## Roadmap

| Version | Features |
|---------|---------|
| **v0.1** | Context sync, adapter generation, CLI init/sync |
| **v0.2** | Provider router, budget management, MCP server |
| **v0.3** | Agent executor, orchestrator, task queue |
| **v0.4** | Quality layer (secrets, hallucinations, consistency) |
| **v0.5** | Observability (audit, costs, dashboard) |
| **v1.0** | Schema registry, templates, stable API |
| **v1.x** | VS Code extension, Git hooks, CI/CD integration |

---

## License

MIT © Synaptode
