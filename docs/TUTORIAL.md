# 🔮 PhantomMindAI — Tutorial Lengkap

Panduan langkah demi langkah untuk menggunakan PhantomMindAI dari nol hingga mahir.

---

## Daftar Isi

1. [Persiapan & Instalasi](#1-persiapan--instalasi)
2. [Inisialisasi Project Pertama](#2-inisialisasi-project-pertama)
3. [Memahami Struktur File](#3-memahami-struktur-file)
4. [Konfigurasi Provider LLM](#4-konfigurasi-provider-llm)
5. [Sync ke AI Assistant](#5-sync-ke-ai-assistant)
6. [Menggunakan CLI](#6-menggunakan-cli)
7. [Penggunaan Programmatic API](#7-penggunaan-programmatic-api)
8. [Sistem Agent](#8-sistem-agent)
9. [MCP Server](#9-mcp-server)
10. [Quality Validation](#10-quality-validation)
11. [Observability & Cost Tracking](#11-observability--cost-tracking)
12. [Schema Registry](#12-schema-registry)
13. [Workflow Tim](#13-workflow-tim)
14. [Tips & Trik](#14-tips--trik)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Persiapan & Instalasi

### Prasyarat

```bash
# Cek versi Node.js (butuh >= 18)
node --version
# v18.0.0 atau lebih baru

# Cek npm
npm --version
```

### Instalasi

> **⚠️ Penting:** `@phantomind/core` **belum dipublish ke npm registry**. Gunakan salah satu cara di bawah ini.

**Cara 1 — Clone & build dari source (direkomendasikan):**

```bash
git clone https://github.com/your-username/PhantomMindAI
cd PhantomMindAI
npm install
npm run build

# Daftarkan ke sistem secara global menggunakan npm link
cd packages/core
npm link

# Verifikasi instalasi
phantomind --version
```

**Cara 2 — Install dari path lokal ke project Anda:**

```bash
cd your-project/
npm install -D /path/to/PhantomMindAI/packages/core
```

Kemudian gunakan via `npx phantomind` atau langsung `phantomind` (jika sudah di-link secara global).

**Cara 3 — Jalankan langsung dari source tanpa install (via tsx):**

```bash
cd PhantomMindAI
npx tsx packages/core/src/cli/index.ts --help
```

---

## 2. Inisialisasi Project Pertama

### Langkah 1 — Jalankan `init`

Masuk ke root project Anda dan jalankan:

```bash
npx phantomind init
```

Anda akan melihat wizard interaktif:

```
🔮 PhantomMindAI — Initialize Project

✔ Project name: my-app
✔ Primary LLM provider: anthropic
✔ Which AI assistants do you use?
  ◉ GitHub Copilot
  ◉ Cursor
  ◉ Cline
  ◯ Continue
  ◯ Windsurf
  ◉ Claude Code CLI
  ◉ OpenAI Codex CLI

Creating .phantomind/ directory...
✓ config.yaml created
✓ SKILLS.md created
✓ RULES.md created
✓ schema.json created
✓ .env.example created

✅ PhantomMindAI initialized successfully!

Next steps:
  1. Add your API key to .env
  2. Edit .phantomind/SKILLS.md with your project details
  3. Run: npx phantomind sync
```

### Langkah 2 — Tambahkan API Key

Buat file `.env` di root project:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx

# Opsional — provider alternatif
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **Penting:** Tambahkan `.env` ke `.gitignore` agar API key tidak ter-commit!

```bash
echo ".env" >> .gitignore
```

### Mode Tanpa API Key (Passive Mode)

PhantomMindAI tetap bisa digunakan sebagai context sync (tanpa memanggil LLM) tanpa API key apapun. `phantomind init` dan `phantomind sync` berjalan sepenuhnya offline:

```bash
# Berjalan tanpa API key
npx phantomind init --yes
npx phantomind sync
```

---

## 3. Memahami Struktur File

Setelah `init`, akan terbentuk struktur berikut:

```
your-project/
├── .phantomind/              ← Source of truth utama
│   ├── config.yaml           ← Konfigurasi utama
│   ├── SKILLS.md             ← Keahlian & pola project Anda
│   ├── RULES.md              ← Aturan perilaku AI
│   ├── schema.json           ← Kontrak input/output
│   ├── audit/                ← Log audit (auto-generated)
│   │   ├── audit.jsonl
│   │   └── costs.json
│   └── memory/               ← Memori agent (auto-generated)
│
├── .env                      ← API keys (jangan di-commit!)
└── package.json
```

### File yang Penting untuk Diedit

#### `.phantomind/SKILLS.md`

File ini menjelaskan keahlian dan pola project Anda kepada AI:

```markdown
# Project Skills

## Tech Stack
- Runtime: Node.js 20 + TypeScript 5.8
- Framework: Express.js dengan clean architecture
- Database: PostgreSQL dengan Prisma ORM
- Testing: Vitest + Supertest

## Arsitektur
Project menggunakan layered architecture:
- `src/routes/` — HTTP route handlers
- `src/services/` — Business logic
- `src/repositories/` — Data access layer
- `src/types/` — TypeScript interfaces

## Pola Kode
- Selalu gunakan async/await, bukan callbacks
- Error handling dengan custom AppError class
- Validasi input menggunakan Zod schemas
- Repository pattern untuk database access

## Konvensi Penamaan
- File: kebab-case (user-service.ts)
- Class: PascalCase (UserService)
- Fungsi: camelCase (getUserById)
- Konstanta: UPPER_SNAKE_CASE (MAX_RETRY_COUNT)
```

#### `.phantomind/RULES.md`

File ini mendefinisikan apa saja yang BOLEH dan TIDAK BOLEH dilakukan AI:

```markdown
# AI Rules

## HARUS dilakukan
- Selalu tulis unit test untuk setiap fungsi baru
- Gunakan TypeScript strict mode
- Validasi semua input dari user
- Log error dengan context yang cukup

## JANGAN dilakukan
- Jangan gunakan `any` type kecuali ada alasan kuat
- Jangan commit secrets atau API keys
- Jangan bypass error handling dengan try-catch kosong
- Jangan gunakan synchronous file operations di production

## Security Rules
- Selalu sanitize input sebelum query database
- Gunakan parameterized queries, bukan string concatenation
- Hash password dengan bcrypt (cost factor >= 12)
- Rate limit semua public endpoints
```

---

## 4. Konfigurasi Provider LLM

Edit `.phantomind/config.yaml`:

### Konfigurasi Minimal (Satu Provider)

```yaml
# .phantomind/config.yaml
providers:
  primary:
    name: anthropic
    model: claude-sonnet-4-20250514
    apiKey: ${ANTHROPIC_API_KEY}
    maxTokens: 8096
    temperature: 0.2

adapters:
  - copilot
  - cursor
  - claude-code   # untuk Claude Code CLI
  - codex         # untuk OpenAI Codex CLI
```

### Konfigurasi Lengkap dengan Fallback

```yaml
providers:
  # Provider utama — kualitas terbaik
  primary:
    name: anthropic
    model: claude-opus-4-5
    apiKey: ${ANTHROPIC_API_KEY}
    maxTokens: 16000
    temperature: 0.2

  # Fallback — jika primary gagal/tidak tersedia
  fallback:
    name: openai
    model: gpt-4o
    apiKey: ${OPENAI_API_KEY}
    maxTokens: 8000

  # Budget provider — otomatis dipakai saat budget harian hampir habis
  budget:
    name: groq
    model: llama-3.3-70b-versatile
    apiKey: ${GROQ_API_KEY}
    maxTokens: 4096

  # Local — untuk task sensitif tanpa internet
  local:
    name: ollama
    model: llama3.2
    baseUrl: http://localhost:11434
    maxTokens: 8096

adapters:
  - copilot
  - cursor
  - cline
  - continue
  - claude-code
  - codex

mcp:
  enabled: true
  port: 3741

budget:
  maxCostPerDay: 5.00        # Maksimum $5/hari
  warningAt: 80              # Warning di 80% budget
  fallbackOnBudget: budget   # Pakai provider budget saat limit hampir tercapai

agent:
  maxSteps: 30
  memory:
    enabled: true

quality:
  secretScanner: true
  hallucinationDetection: true
```

### Menggunakan Provider Ollama (Lokal, Gratis)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull model
ollama pull llama3.2
ollama pull codellama
```

```yaml
# config.yaml
providers:
  primary:
    name: ollama
    model: codellama
    baseUrl: http://localhost:11434
```

```bash
# Test koneksi
npx phantomind eval
```

---

## 5. Sync ke AI Assistant

### Sync Semua Adapter

```bash
npx phantomind sync
```

Output:

```
🔄 PhantomMindAI — Sync Adapters

  ✓ copilot      → .github/copilot-instructions.md (created)
  ✓ cursor       → .cursorrules (changed)
  ✓ cline        → .clinerules (created)
  ✓ continue     → .continue/config.json (created)
  ✓ claude-code  → .claude/CLAUDE.md (created)
  ✓ codex        → AGENTS.md (created)

✅ Synced 6/6 adapters successfully
```

### Dry Run (Preview Tanpa Menulis)

```bash
npx phantomind sync --dry-run --verbose
```

Output menampilkan diff tanpa mengubah file apapun.

### Sync Adapter Tertentu Saja

```bash
npx phantomind sync --adapters copilot,cursor
```

### Otomatisasi dengan Git Hook

Tambahkan ke `.git/hooks/pre-commit`:

```bash
#!/bin/sh
npx phantomind sync --dry-run
```

Atau gunakan **husky**:

```bash
npm install -D husky
npx husky init
echo "npx phantomind sync" > .husky/pre-commit
```

### Apa yang Dihasilkan?

**`.github/copilot-instructions.md`** (untuk GitHub Copilot):
```markdown
# GitHub Copilot Instructions

## Project Context
Tech Stack: Node.js 20, TypeScript 5.8, Express.js
...

## Rules
- Selalu tulis unit test untuk setiap fungsi baru
- Gunakan TypeScript strict mode
...
```

**`.cursorrules`** (untuk Cursor):
```
You are an expert developer working on this project.

Tech Stack: Node.js 20, TypeScript 5.8, Express.js

Rules:
- Always write unit tests for every new function
...
```

**`.claude/CLAUDE.md`** (untuk Claude Code CLI):
```markdown
<!-- Generated by PhantomMindAI -->

## Project Knowledge

Tech Stack: Node.js 20, TypeScript 5.8, Express.js
...

## Rules & Constraints

- Selalu tulis unit test untuk setiap fungsi baru
- Gunakan TypeScript strict mode
...
```

**`AGENTS.md`** (untuk OpenAI Codex CLI):
```markdown
<!-- Generated by PhantomMindAI -->

## Project Knowledge

Tech Stack: Node.js 20, TypeScript 5.8, Express.js
...

## Coding Guidelines

- Always write unit tests for every new function
- Use TypeScript strict mode
...
```

---

### Menggunakan Claude Code CLI

**Claude Code** adalah CLI coding agent dari Anthropic. PhantomMindAI meng-generate `.claude/CLAUDE.md` yang otomatis dibaca oleh Claude Code saat dijalankan di dalam project.

```bash
# Aktifkan adapter claude-code di config.yaml
# adapters:
#   - claude-code

npx phantomind sync

# Jalankan Claude Code — konteks project sudah ter-inject otomatis
claude
```

> **Catatan:** Claude Code membaca `.claude/CLAUDE.md` dari direktori project saat memulai sesi. PhantomMindAI memastikan file ini selalu sinkron dengan `SKILLS.md` dan `RULES.md`.

### Menggunakan OpenAI Codex CLI

**Codex CLI** adalah coding agent dari OpenAI. PhantomMindAI meng-generate `AGENTS.md` di root project yang dibaca oleh Codex saat startup.

```bash
# Aktifkan adapter codex di config.yaml
# adapters:
#   - codex

npx phantomind sync

# Jalankan Codex CLI — konteks dari AGENTS.md otomatis dipakai
codex "Implementasikan endpoint GET /users dengan pagination"
```

> **Catatan:** Codex CLI juga membaca `AGENTS.md` dari subdirektori. Jika project Anda memiliki modul terpisah (misalnya `src/api/`, `src/services/`), Anda bisa membuat `AGENTS.md` lebih granular dengan melakukan sync per subdirektori.

### Sync Semua Adapter Sekaligus (Termasuk Claude Code & Codex)

```bash
# Aktifkan semua adapter yang ingin digunakan
npx phantomind sync --adapters copilot,cursor,claude-code,codex
```

---

## 6. Menggunakan CLI

### `phantomind eval` — Test Koneksi Provider

```bash
# Test provider default
npx phantomind eval

# Test provider tertentu
npx phantomind eval --provider openai

# Test dengan prompt custom
npx phantomind eval --provider groq --prompt "Tulis fungsi fibonacci dalam TypeScript"
```

Output:

```
🧪 PhantomMindAI — Provider Evaluation

✓ Connected to anthropic

  Provider: anthropic
  Model:    claude-sonnet-4-20250514
  Prompt:   Say "PhantomMindAI is ready!" in one short sentence.

Response:
  PhantomMindAI is ready to enhance your AI development workflow!

──────────────────────────────────────────────────
  Model:    claude-sonnet-4-20250514
  Provider: anthropic
  Tokens:   45 in / 18 out
  Cost:     $0.000026
  Duration: 1243ms
```

### `phantomind stats` — Statistik Project

```bash
# Tampilkan statistik
npx phantomind stats

# Dengan learning patterns
npx phantomind stats --learn
```

Output:

```
📈 PhantomMindAI — Project Stats

Project Context:
  Layers:        4
  Total Tokens:  ~8,240

  ─ skills      (relevance: 0.95, ~2100 tokens)
  ─ rules       (relevance: 0.90, ~1800 tokens)
  ─ schema      (relevance: 0.85, ~1200 tokens)
  ─ codebase    (relevance: 0.75, ~3140 tokens)

Codebase Index:
  Status: built

Configuration:
  Primary Provider: anthropic
  Adapters:         copilot, cursor, cline, claude-code, codex
  MCP Server:       enabled
  Budget (daily):   $5
```

### `phantomind validate` — Validasi Kualitas Kode

```bash
# Validasi semua file TypeScript
npx phantomind validate

# Validasi file tertentu
npx phantomind validate src/auth/login.ts src/api/users.ts

# Hanya cek secrets
npx phantomind validate --no-hallucinations --no-consistency

# Auto-fix secrets yang ditemukan
npx phantomind validate --fix
```

Output:

```
🔍 PhantomMindAI — Code Validation

  SECRET src/config/database.ts:14 aws-access-key [critical]
    → Redacted automatically (--fix)

  ✓ No hallucinations detected

  CONSISTENCY src/services/user-service.ts, src/services/auth-service.ts
    Inconsistent async patterns: mixing callbacks and async/await

──────────────────────────────────────────────────
⚠️  Total: 2 issue(s) found
```

---

## 7. Penggunaan Programmatic API

### Setup Dasar

```typescript
// script.ts
import { phantom } from '@phantomind/core';

async function main() {
  // Inisialisasi (load config, connect providers)
  await phantom.init();

  // Siap digunakan!
}

main();
```

### Completion dengan Context Otomatis

PhantomMindAI secara otomatis menyertakan context project ke setiap completion:

```typescript
import { phantom } from '@phantomind/core';

await phantom.init();

// Context project otomatis disertakan
const response = await phantom.complete(
  'Bagaimana cara mengimplementasikan rate limiting yang baik untuk Express.js?'
);

console.log(response.content);
console.log(`Cost: $${response.usage.estimatedCost.toFixed(6)}`);
console.log(`Provider: ${response.provider} | Model: ${response.model}`);
```

### Completion dengan Retry Otomatis

```typescript
// Jika gagal, akan coba strategi lain (decompose, switch provider, dll)
const result = await phantom.completeWithRetry(
  'Implementasikan JWT refresh token rotation',
  { maxTokens: 3000, temperature: 0.2 }
);

console.log(result.content);
```

### Semantic Search di Codebase

```typescript
// Cari kode yang relevan secara semantik
const matches = await phantom.search('database connection pooling', 5);

for (const match of matches) {
  console.log(`${match.path} (score: ${match.score.toFixed(2)})`);
  console.log(match.snippet);
  console.log('---');
}
```

### Validasi Kode

```typescript
import { readFile } from 'node:fs/promises';

const code = await readFile('src/auth/login.ts', 'utf-8');
const { secrets, hallucinations } = await phantom.validate(code, 'src/auth/login.ts');

if (secrets.length > 0) {
  console.error('⚠️ Secrets ditemukan:');
  for (const s of secrets) {
    console.error(`  Line ${s.line}: ${s.pattern} [${s.severity}]`);
  }
}

if (hallucinations.length > 0) {
  console.warn('⚠️ Potensi hallucination:');
  for (const h of hallucinations) {
    console.warn(`  Line ${h.line}: [${h.type}] ${h.reference} — tidak ditemukan`);
    if (h.suggestions?.length) {
      console.warn(`  Saran: ${h.suggestions.join(', ')}`);
    }
  }
}
```

### Menggunakan Berbagai Provider

```typescript
import { createProvider } from '@phantomind/core';
import type { ProviderConfig } from '@phantomind/core';

// Buat provider secara manual
const claude = createProvider({
  name: 'anthropic',
  model: 'claude-opus-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const gpt = createProvider({
  name: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

// Cek ketersediaan
const isAvailable = await claude.isAvailable();
console.log(`Claude tersedia: ${isAvailable}`);

// List model yang tersedia
const models = await gpt.listModels();
console.log('Model GPT tersedia:', models.slice(0, 5));

// Completion langsung
const response = await claude.complete({
  prompt: 'Jelaskan konsep dependency injection',
  maxTokens: 500,
  temperature: 0.3,
});
```

### Cost Report & Dashboard

```typescript
// Laporan biaya hari ini
const todayCosts = phantom.costs('today');
console.log(`Total hari ini: $${todayCosts.totalCost.toFixed(4)}`);
console.log(`Total request: ${todayCosts.requestCount}`);

// Laporan per provider
if (todayCosts.byProvider) {
  for (const [provider, cost] of Object.entries(todayCosts.byProvider)) {
    console.log(`  ${provider}: $${cost.toFixed(4)}`);
  }
}

// Dashboard analytics terminal
const dashboard = phantom.dashboard();
console.log(dashboard.formatTerminal());

// Export sebagai markdown
const markdown = dashboard.formatMarkdown();
await writeFile('REPORT.md', markdown);

// Simpan state ke disk
await phantom.save();
```

---

## 8. Sistem Agent

### Single Agent — Satu Role

Agent menjalankan task secara iteratif dengan loop plan → act → verify:

```bash
# Via CLI
npx phantomind agent "Tambahkan input validation ke endpoint POST /users" \
  --role implementer \
  --max-steps 20

# Via Makefile
make agent TASK="Tambahkan rate limiting ke API" ROLE=securityReviewer
```

**Peran yang tersedia:**

| Role | Keahlian |
|------|---------|
| `architect` | Desain sistem, keputusan arsitektur, dependency planning |
| `implementer` | Menulis kode, refactoring, implementasi fitur |
| `securityReviewer` | Audit keamanan, threat modeling, secure coding |
| `testWriter` | Unit test, integration test, edge cases |
| `documenter` | API docs, README, komentar inline |

**Via programmatic API:**

```typescript
import { phantom } from '@phantomind/core';

await phantom.init();

// Jalankan agent dengan role tertentu
const result = await phantom.agent(
  'Refactor PaymentService untuk menggunakan dependency injection',
  {
    role: 'implementer',
    maxSteps: 25,
  }
);

console.log(`Status: ${result.success ? '✅ Sukses' : '❌ Gagal'}`);
console.log(`Ringkasan: ${result.summary}`);
console.log(`Durasi: ${(result.duration / 1000).toFixed(1)}s`);
console.log(`Cost: $${result.totalTokenUsage.estimatedCost.toFixed(4)}`);

if (result.filesChanged.length > 0) {
  console.log('File yang diubah:');
  for (const f of result.filesChanged) {
    console.log(`  - ${f}`);
  }
}
```

### Multi-Agent Orchestration

Beberapa agent dengan role berbeda bekerja secara berurutan, output satu phase menjadi input phase berikutnya:

```bash
# Via CLI
npx phantomind agent "Implementasikan fitur OAuth2 Google login" \
  --orchestrate \
  --roles architect,implementer,securityReviewer,testWriter

# Via Makefile
make orchestrate \
  TASK="Buat sistem notifikasi real-time dengan WebSocket" \
  ROLES="architect,implementer,testWriter"
```

**Via programmatic API:**

```typescript
const result = await phantom.orchestrate(
  'Bangun user authentication system lengkap',
  ['architect', 'implementer', 'securityReviewer', 'testWriter'],
);

console.log(`Sukses: ${result.success}`);
console.log(`Total phases: ${result.phases.length}`);
console.log(`Total cost: $${result.totalUsage.estimatedCost.toFixed(4)}`);

for (const phase of result.phases) {
  console.log(`\n📋 Phase: ${phase.name}`);
  console.log(phase.aggregatedOutput.slice(0, 300) + '...');
}
```

### Task Decomposer

Untuk task kompleks, bisa dipecah dulu sebelum dieksekusi:

```typescript
import { phantom } from '@phantomind/core';
await phantom.init();

const decomposition = await phantom.decompose(
  'Migrasi sistem dari MongoDB ke PostgreSQL'
);

console.log(`Task utama dipecah menjadi ${decomposition.subtasks.length} subtask:`);
for (const subtask of decomposition.subtasks) {
  console.log(`  [${subtask.phase}] ${subtask.description}`);
  console.log(`    Estimasi tokens: ${subtask.estimatedTokens}`);
}
console.log(`Total estimasi tokens: ${decomposition.totalEstimatedTokens}`);
```

### Task Queue dengan Priority

```typescript
import { phantom } from '@phantomind/core';
await phantom.init();

// Tambahkan task ke queue
phantom.enqueue('Analisis arsitektur saat ini', { role: 'architect', priority: 'high' });
phantom.enqueue('Tulis dokumentasi API', { role: 'documenter', priority: 'normal' });
phantom.enqueue('Tambahkan logging ke semua services', { role: 'implementer', priority: 'low' });

// Task akan dieksekusi secara berurutan sesuai priority
```

---

## 9. MCP Server

### Jalankan MCP Server

```bash
npx phantomind serve
```

MCP Server menyediakan 9 tools yang bisa digunakan oleh AI assistant yang kompatibel (Cursor, Continue, Claude Desktop, dll).

### Konfigurasi di Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Konfigurasi di Continue (VS Code)

Edit `.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "PhantomMindAI",
      "command": "npx phantomind serve",
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Tools yang Tersedia via MCP

Setelah MCP server berjalan, AI assistant Anda bisa memanggil:

| Tool | Kapan Digunakan |
|------|----------------|
| `get_project_context` | Dapatkan context lengkap project (skills, rules, schema) |
| `search_codebase` | Cari kode relevan secara semantik |
| `validate_code` | Scan secret + hallucination |
| `get_schema` | Ambil schema berdasarkan nama |
| `list_schemas` | Lihat semua schema yang terdaftar |
| `complete` | Completion via provider router |
| `run_agent` | Eksekusi agentic task |
| `get_cost_report` | Laporan biaya saat ini |
| `get_audit_log` | Log audit terbaru |

Di dalam Cursor/Continue, Anda bisa bertanya:
> *"Gunakan PhantomMindAI untuk mencari kode authentication di project ini"*

---

## 10. Quality Validation

### Secret Scanning

```bash
# Scan semua file
npx phantomind validate --no-hallucinations --no-consistency

# Scan dan auto-fix
npx phantomind validate --fix
```

Pattern yang dideteksi (20+ jenis):
- AWS Access Key & Secret
- GitHub Personal Access Token
- OpenAI / Anthropic API Key
- Stripe Secret Key
- Database connection string dengan password
- JWT secret
- PEM private key
- Generic Bearer token

### Hallucination Detection

Mendeteksi kode AI yang mereferensikan hal yang tidak ada:

```bash
npx phantomind validate src/ --no-secrets --no-consistency
```

Yang dideteksi:
- `import` dari package yang tidak terinstall
- Referensi ke file yang tidak ada di project
- Penggunaan type/class yang tidak didefinisikan

### Consistency Checking

```bash
npx phantomind validate --no-secrets --no-hallucinations
```

Yang dideteksi:
- Perbedaan konvensi penamaan antar file
- Mixed async patterns (callbacks vs async/await)
- Pelanggaran arsitektur (misalnya route memanggil repository langsung)

### Validasi di CI/CD Pipeline

Tambahkan ke `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install
      - run: npm run build

      - name: Validate code quality
        run: npx phantomind validate src/
        # Exit code 1 jika ada issues → CI gagal
```

---

## 11. Observability & Cost Tracking

### Lihat Dashboard

```bash
# Dashboard terminal
npx phantomind audit

# Biaya hari ini
npx phantomind audit --type costs

# Log aktivitas
npx phantomind audit --type actions

# Laporan minggu ini dalam format markdown
npx phantomind audit --period week --format markdown > COST_REPORT.md
```

### Dashboard Output

```
┌────────────────────────────────────────────────────────┐
│  PhantomMindAI Dashboard                               │
├────────────────────────────────────────────────────────┤
│  OVERVIEW                                              │
│  Requests: 47                                          │
│  Cost:     $0.2341                                     │
│  Tokens:   89,234                                      │
│  Providers: anthropic, groq                            │
├────────────────────────────────────────────────────────┤
│  PERFORMANCE                                           │
│  Avg Response: 1.24s                                   │
│  Success Rate: 97.9%                                   │
│  Errors:       1                                       │
├────────────────────────────────────────────────────────┤
│  QUALITY                                               │
│  Secrets Found:      2                                 │
│  Hallucinations:     0                                 │
│  Consistency Issues: 3                                 │
├────────────────────────────────────────────────────────┤
│  AGENTS                                                │
│  Completed: 5                                          │
│  Failed:    1                                          │
└────────────────────────────────────────────────────────┘
```

### Cost Report Programmatic

```typescript
const costs = phantom.costs('week');

console.log(`Total minggu ini: $${costs.totalCost.toFixed(4)}`);
console.log(`Total request: ${costs.requestCount}`);
console.log(`Sisa budget hari ini: $${costs.budgetRemaining?.toFixed(4) ?? 'unlimited'}`);

// Per provider
if (costs.byProvider) {
  console.log('\nPer provider:');
  for (const [provider, cost] of Object.entries(costs.byProvider)) {
    console.log(`  ${provider}: $${cost.toFixed(4)}`);
  }
}

// Per model
if (costs.byModel) {
  console.log('\nPer model:');
  for (const [model, cost] of Object.entries(costs.byModel)) {
    console.log(`  ${model}: $${cost.toFixed(4)}`);
  }
}
```

### Audit Trail

Semua aksi tersimpan di `.phantomind/audit/audit.jsonl`. Contoh entry:

```json
{
  "id": "audit_1717000000000_abc123",
  "timestamp": "2026-03-31T10:30:00.000Z",
  "action": "provider:request",
  "agent": "system",
  "details": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "inputTokens": 1240,
    "outputTokens": 340,
    "cost": 0.000042,
    "duration": 1243,
    "success": true
  }
}
```

---

## 12. Schema Registry

Schema registry memungkinkan Anda mendefinisikan kontrak data yang bisa digunakan agent untuk menghasilkan output terstruktur.

### Lihat Schema Tersedia

```bash
# List semua schema
npx phantomind schema

# Lihat schema tertentu
npx phantomind schema api-response
```

### 7 Schema Bawaan

| Schema | Kegunaan |
|--------|---------|
| `api-response` | Standard API response envelope |
| `error-response` | Error response dengan kode & pesan |
| `paginated-list` | Response dengan pagination |
| `agent-task` | Format task untuk agent |
| `code-review` | Hasil code review |
| `test-suite` | Definisi test suite |
| `config-file` | Format file konfigurasi |

### Menggunakan Schema di Completion

```typescript
import { phantom } from '@phantomind/core';
await phantom.init();

// Minta agent menghasilkan output sesuai schema
const response = await phantom.complete(
  'Generate unit test suite untuk UserService.createUser()',
  {
    schema: 'test-suite',  // gunakan schema bawaan
    temperature: 0.1,
  }
);

// Output sudah terstruktur sesuai schema
const testSuite = JSON.parse(response.content);
```

### Registrasi Schema Custom

```typescript
import { SchemaRegistry } from '@phantomind/core';
import { z } from 'zod';

const registry = new SchemaRegistry(process.cwd());

// Definisi schema dengan Zod
registry.register({
  name: 'user-profile',
  description: 'Schema untuk profil user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(2).max(100),
    email: z.string().email(),
    role: z.enum(['admin', 'user', 'guest']),
    createdAt: z.string().datetime(),
  }),
});
```

---

## 13. Workflow Tim

### Onboarding Anggota Tim Baru

Cukup clone repository — semua konteks AI langsung tersedia:

```bash
git clone https://github.com/your-org/your-project
cd your-project
npm install
cp .env.example .env
# Isi API key di .env

# Sync ke AI assistant lokal mereka
npx phantomind sync
```

Anggota baru langsung mendapatkan konteks project yang sama di AI assistant mereka.

### Workflow Git yang Direkomendasikan

```
.phantomind/SKILLS.md    ← Commit & push (knowledge base tim)
.phantomind/RULES.md     ← Commit & push (aturan tim)
.phantomind/config.yaml  ← Commit & push (konfigurasi, tanpa API key)
.phantomind/schema.json  ← Commit & push

.env                     ← JANGAN commit (secrets)
.phantomind/audit/       ← Opsional (history lokal)
.phantomind/memory/      ← Opsional (memori agent lokal)
```

### `.gitignore` yang Direkomendasikan

```gitignore
# PhantomMindAI
.env
.env.local
.phantomind/audit/
.phantomind/memory/

# AI assistant files (auto-generated, bisa commit atau tidak)
# .github/copilot-instructions.md
# .cursorrules
# .clinerules
```

### Pull Request Workflow

Tambahkan `phantomind validate` ke PR check:

```yaml
# .github/workflows/pr-check.yml
name: PR Quality Check

on: pull_request

jobs:
  phantomind-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      - run: npm install

      - name: 🔍 Secret scan (changed files only)
        run: |
          CHANGED=$(git diff --name-only origin/main...HEAD | grep -E '\.(ts|js|py|go)$' || true)
          if [ -n "$CHANGED" ]; then
            npx phantomind validate $CHANGED --no-hallucinations --no-consistency
          fi

      - name: 🔄 Sync check (ensure adapters are up to date)
        run: npx phantomind sync --dry-run
```

---

## 14. Tips & Trik

### Tips Menulis SKILLS.md yang Efektif

✅ **Lakukan:**
```markdown
## Pola Error Handling
Gunakan custom AppError class yang extend Error:
\`\`\`typescript
throw new AppError('User not found', 404, 'USER_NOT_FOUND');
\`\`\`
Semua handler di routes harus catch AppError dan return response konsisten.
```

❌ **Hindari:**
```markdown
## Error Handling
Tangani error dengan baik.
```

Semakin spesifik SKILLS.md, semakin akurat output AI.

### Optimalkan Budget dengan Provider Routing

```yaml
providers:
  primary:
    name: anthropic
    model: claude-haiku-3-5   # Model ringan untuk task sederhana
  budget:
    name: groq
    model: llama-3.3-70b-versatile   # Gratis/murah untuk draft

budget:
  maxCostPerDay: 2.00
  warningAt: 70
  fallbackOnBudget: budget
```

### Gunakan `--dry-run` Sebelum Sync

```bash
# Selalu preview dulu sebelum sync jika sedang development aktif
npx phantomind sync --dry-run --verbose
```

### Simpan State Secara Berkala

```typescript
// Di script atau cron job
import { phantom } from '@phantomind/core';
await phantom.init();

// ... lakukan berbagai operasi ...

// Simpan costs & memory ke disk
await phantom.save();
```

### Debug dengan `--format json`

```bash
# Export data audit dalam format JSON untuk debugging
npx phantomind audit --format json | jq '.entries | last(5)'
```

---

## 15. Troubleshooting

### ❌ `Error: Provider anthropic is not available`

**Penyebab:** API key tidak diset atau tidak valid.

```bash
# Cek apakah .env sudah ada
cat .env | grep ANTHROPIC

# Test koneksi
npx phantomind eval --provider anthropic
```

**Solusi:**
1. Pastikan `.env` ada dan berisi `ANTHROPIC_API_KEY=sk-ant-...`
2. Pastikan API key valid di console provider
3. Jika ingin pakai Ollama (tanpa API key): set `primary.name: ollama` di config.yaml

---

### ❌ `Cannot find module '@phantomind/core'`

**Penyebab:** Package belum terinstall atau build belum dijalankan.

```bash
# Jika menggunakan dari repo source
make build

# Jika menggunakan dari npm
npm install -D @phantomind/core
```

---

### ❌ `config.yaml: validation error`

**Penyebab:** Format config.yaml tidak valid.

```bash
# Cek error detail
npx phantomind stats 2>&1
```

Pastikan format YAML benar — indent menggunakan spasi (bukan tab), dan field sesuai schema.

**Config minimal yang pasti valid:**

```yaml
providers:
  primary:
    name: anthropic
    model: claude-haiku-3-5

adapters:
  - copilot
```

---

### ❌ Agent berhenti di tengah jalan

**Penyebab:** Melebihi `maxSteps` atau budget habis.

```bash
# Tambah max steps
npx phantomind agent "task" --max-steps 50

# Cek sisa budget
npx phantomind audit --type costs
```

---

### ❌ Adapter sync gagal untuk satu adapter

```bash
# Sync hanya adapter yang bermasalah dengan verbose
npx phantomind sync --adapters cursor --verbose
```

**Penyebab umum:**
- Direktori tidak bisa ditulis (permission)
- Path output sudah ada sebagai direktori bukan file

```bash
# Cek permission
ls -la .cursorrules

# Fix permission
chmod 644 .cursorrules
```

---

### 🐛 Lihat Log Debug Lengkap

```bash
DEBUG=phantomind:* npx phantomind sync --verbose
```

---

## Referensi Cepat

```bash
# Inisialisasi project baru
npx phantomind init

# Sync semua adapter
npx phantomind sync

# Test provider
npx phantomind eval

# Statistik project
npx phantomind stats --learn

# Validasi kode
npx phantomind validate src/

# Audit & costs
npx phantomind audit --type dashboard
npx phantomind audit --type costs --period week

# Jalankan agent
npx phantomind agent "Deskripsi task Anda di sini" --role implementer

# Multi-agent orchestration
npx phantomind agent "Task kompleks" --orchestrate \
  --roles architect,implementer,securityReviewer,testWriter

# Start MCP server
npx phantomind serve

# Via Makefile (dari repo source)
make init
make sync
make eval
make stats-learn
make agent TASK="deskripsi task" ROLE=implementer
make orchestrate TASK="task kompleks" ROLES="architect,implementer"
make audit PERIOD=week TYPE=costs
```

---

*Dokumentasi lengkap: [README.md](../README.md) | PRD: [PhantomMindAI_PRD.md](PhantomMindAI_PRD.md)*
