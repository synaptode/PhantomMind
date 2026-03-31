/**
 * PhantomMindAI — Core Type Definitions
 */

import { z } from 'zod';

// ─── Provider Types ─────────────────────────────────────────

export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'mistral'
  | 'ollama'
  | 'deepseek'
  | 'openrouter';

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface ProviderRouting {
  primary: ProviderConfig;
  fallback?: ProviderConfig;
  budget?: ProviderConfig;
  local?: ProviderConfig;
}

export interface CompletionRequest {
  prompt: string;
  systemPrompt?: string;
  context?: 'project' | 'file' | 'none' | ContextOptions;
  schema?: string | Record<string, unknown>;
  role?: AgentRole | string;
  verify?: boolean;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  messages?: ChatMessage[];
}

export interface CompletionResponse {
  content: string;
  model: string;
  provider: ProviderName;
  usage: TokenUsage;
  duration: number;
  verified?: boolean;
  verificationResult?: VerificationResult;
  cached?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: TokenUsage;
}

// ─── Context Types ──────────────────────────────────────────

export interface ContextOptions {
  file?: string;
  maxTokens?: number;
  includeSkills?: boolean;
  includeRules?: boolean;
  includeSchema?: boolean;
  includePrd?: string;
  semanticRank?: boolean;
}

export interface ContextLayer {
  type: 'skills' | 'rules' | 'schema' | 'prd' | 'decision' | 'codebase';
  content: string;
  relevanceScore: number;
  tokenCount: number;
  source: string;
}

export interface ContextResult {
  layers: ContextLayer[];
  totalTokens: number;
  truncated: boolean;
}

export interface ContextVersionEntry {
  hash: string;
  timestamp: string;
  author: string;
  message: string;
  files: string[];
}

// ─── Adapter Types ──────────────────────────────────────────

export type AdapterName =
  | 'copilot'
  | 'cursor'
  | 'cline'
  | 'continue'
  | 'windsurf'
  | 'zed'
  | 'aider'
  | 'claude-code'
  | 'codex';

export interface AdapterConfig {
  name: AdapterName;
  outputPath: string;
  format: 'markdown' | 'json' | 'yaml' | 'text';
  enabled: boolean;
}

export interface SyncResult {
  adapter: AdapterName;
  outputPath: string;
  success: boolean;
  created: boolean;
  changed: boolean;
  diff?: string;
  error?: string;
}

// ─── MCP Types ──────────────────────────────────────────────

export interface MCPServerConfig {
  enabled: boolean;
  port: number;
  autoStart: boolean;
}

export interface MCPToolResult {
  content: string | Record<string, unknown>;
  isError?: boolean;
}

// ─── Agent Types ────────────────────────────────────────────

export type AgentRole =
  | 'architect'
  | 'implementer'
  | 'securityReviewer'
  | 'documentWriter'
  | 'testWriter';

export interface AgentConfig {
  role?: AgentRole | string;
  tools?: string[];
  maxSteps?: number;
  humanCheckpoint?: HumanCheckpointConfig;
  sandbox?: SandboxConfig;
  memory?: MemoryConfig;
}

export interface HumanCheckpointConfig {
  before?: string[];
  after?: string[];
  onError?: boolean;
  onAnomalyDetected?: boolean;
}

export interface SandboxConfig {
  allowedCommands?: string[];
  networkAccess?: boolean;
  maxFileSize?: number;
  allowedPaths?: string[];
}

export interface MemoryConfig {
  type: 'persistent' | 'session' | 'none';
  path?: string;
}

export interface AgentTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  role?: AgentRole | string;
  steps: AgentStep[];
  result?: AgentResult;
  createdAt: string;
  updatedAt: string;
  parentTaskId?: string;
}

export interface AgentStep {
  id: string;
  action: string;
  input: Record<string, unknown>;
  output?: unknown;
  status: 'pending' | 'running' | 'checkpoint' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  tokenUsage?: TokenUsage;
  reasoning?: string;
}

export interface AgentResult {
  success: boolean;
  summary: string;
  filesChanged: string[];
  decisionLog: DecisionEntry[];
  totalTokenUsage: TokenUsage;
  duration: number;
}

export interface DecisionEntry {
  title: string;
  timestamp: string;
  agent: string;
  task: string;
  filesAffected: string[];
  reasoning: string;
  alternativesConsidered: string[];
  contextBasis: string;
}

// ─── Quality Types ──────────────────────────────────────────

export interface SecretMatch {
  pattern: string;
  file: string;
  line: number;
  column: number;
  value: string;
  replacement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface HallucinationCheck {
  type: 'import' | 'class' | 'method' | 'file' | 'package';
  reference: string;
  exists: boolean;
  suggestions?: string[];
  file: string;
  line: number;
}

export interface VerificationResult {
  approved: boolean;
  provider: ProviderName;
  model: string;
  issues: VerificationIssue[];
  duration: number;
  cost: TokenUsage;
}

export interface VerificationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'convention' | 'security' | 'edge-case' | 'performance' | 'correctness';
  description: string;
  suggestion?: string;
  line?: number;
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  scannedFiles: number;
  duration: number;
}

export interface ConsistencyIssue {
  type: 'naming' | 'pattern' | 'architecture' | 'deprecated' | 'async';
  severity?: 'error' | 'warning' | 'info';
  description: string;
  files: string[];
  suggestion: string;
  autoFixable: boolean;
}

export interface RegressionReport {
  hasRegression: boolean;
  testsBefore: number;
  testsAfter: number;
  testsBroken: number;
  schemaViolations: number;
  architectureViolations: number;
  fileChanges: FileChange[];
}

export interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  diff?: string;
}

export interface AnomalyReport {
  detected: boolean;
  type?: 'stuck-loop' | 'no-progress' | 'high-error-rate' | 'token-spike';
  description?: string;
  metrics: AnomalyMetrics;
}

export interface AnomalyMetrics {
  fileAccessCounts: Record<string, number>;
  stepsWithoutProgress: number;
  errorRate: number;
  tokenUsageHistory: number[];
  averageTokenUsage: number;
}

// ─── Observability Types ────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  provider?: ProviderName;
  model?: string;
  agent?: string;
  file?: string;
  reasoning?: string;
  tokenUsage?: TokenUsage;
  duration?: number;
  success?: boolean;
  error?: string;
  taskId?: string;
  details?: Record<string, unknown>;
}

export interface CostReport {
  period: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  providers?: ProviderCostBreakdown[];
  byProvider?: Record<string, number>;
  byModel?: Record<string, number>;
  totalTokens?: TokenUsage;
  requestCount?: number;
  budgetRemaining?: number;
  qualityMetrics?: QualityMetrics;
  performanceMetrics?: PerformanceMetrics;
}

export type CostPeriod = 'today' | 'week' | 'month' | 'all';

export interface DashboardMetrics {
  overview: {
    totalRequests: number;
    totalCost: number;
    avgCostPerRequest: number;
    totalTokens: number;
    activeProviders: string[];
  };
  performance: {
    avgResponseTime: number;
    successRate: number;
    errorCount: number;
  };
  quality: {
    secretsDetected: number;
    hallucinationsDetected: number;
    consistencyIssues: number;
  };
  agents: {
    tasksCompleted: number;
    tasksFailed: number;
    avgStepsPerTask: number;
  };
}

export interface ProviderCostBreakdown {
  provider: ProviderName;
  model: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  label?: string;
}

export interface QualityMetrics {
  schemaValidationPassRate: number;
  hallucinationDetections: number;
  dualVerificationRejections: number;
  anomaliesDetected: number;
  regressionsCaught: number;
}

export interface PerformanceMetrics {
  avgResponseTime: Record<ProviderName, number>;
  taskCompletionRate: number;
  avgStepsPerTask: number;
}

// ─── Configuration Types ────────────────────────────────────

export interface PhantomConfig {
  version: string;
  providers: ProviderRouting;
  context: ContextConfig;
  adapters: AdapterName[];
  mcp: MCPServerConfig;
  quality: QualityConfig;
  agent: AgentGlobalConfig;
  budget: BudgetConfig;
  environments?: Record<string, Partial<PhantomConfig>>;
  git: GitConfig;
  team: TeamConfig;
}

export interface ContextConfig {
  skills: string;
  rules: string;
  schema: string;
  prds: string;
  decisions: string;
}

export interface QualityConfig {
  secretScanner: boolean;
  hallucinationGuard: boolean;
  dualVerification: boolean;
  dualVerificationProvider?: ProviderName;
}

export interface AgentGlobalConfig {
  maxSteps: number;
  humanCheckpoint: HumanCheckpointConfig;
  sandbox: SandboxConfig;
  memory: MemoryConfig;
}

export interface BudgetConfig {
  maxTokensPerTask: number;
  maxCostPerDay: number;
  warningAt: number;
  fallbackOnBudget: 'budget' | 'local' | 'stop';
}

export interface GitConfig {
  autoCommit: boolean;
  commitMessageFormat: 'conventional' | 'descriptive' | 'custom';
  requireApproval: boolean;
}

export interface TeamConfig {
  contextSync: boolean;
  remoteContext: string;
}

// ─── Queue Types ────────────────────────────────────────────

export interface QueueTask {
  id: string;
  description: string;
  role?: AgentRole | string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  dependencies?: string[];
  cron?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: AgentResult;
  error?: string;
}

// ─── Event Types ────────────────────────────────────────────

export type PhantomEvent =
  | 'agent:start'
  | 'agent:step'
  | 'agent:checkpoint'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:anomaly'
  | 'provider:request'
  | 'provider:response'
  | 'provider:fallback'
  | 'quality:secret-detected'
  | 'quality:hallucination-detected'
  | 'quality:verification-failed'
  | 'quality:regression-detected'
  | 'sync:start'
  | 'sync:complete'
  | 'context:updated'
  | 'budget:warning'
  | 'budget:exceeded';

export interface PhantomEventData {
  event: PhantomEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

// ─── Zod Schemas for validation ─────────────────────────────

export const ProviderConfigSchema = z.object({
  name: z.enum(['anthropic', 'openai', 'gemini', 'groq', 'mistral', 'ollama', 'deepseek', 'openrouter']),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeout: z.number().positive().optional(),
});

export const PhantomConfigSchema = z.object({
  version: z.string(),
  providers: z.object({
    primary: ProviderConfigSchema,
    fallback: ProviderConfigSchema.optional(),
    budget: ProviderConfigSchema.optional(),
    local: ProviderConfigSchema.optional(),
  }),
  context: z.object({
    skills: z.string(),
    rules: z.string(),
    schema: z.string(),
    prds: z.string(),
    decisions: z.string(),
  }),
  adapters: z.array(z.enum(['copilot', 'cursor', 'cline', 'continue', 'windsurf', 'zed', 'aider', 'claude-code', 'codex'])),
  mcp: z.object({
    enabled: z.boolean(),
    port: z.number(),
    autoStart: z.boolean(),
  }),
  quality: z.object({
    secretScanner: z.boolean(),
    hallucinationGuard: z.boolean(),
    dualVerification: z.boolean(),
    dualVerificationProvider: z.enum(['anthropic', 'openai', 'gemini', 'groq', 'mistral', 'ollama', 'deepseek', 'openrouter']).optional(),
  }),
  agent: z.object({
    maxSteps: z.number().positive(),
    humanCheckpoint: z.object({
      before: z.array(z.string()).optional(),
      after: z.array(z.string()).optional(),
      onError: z.boolean().optional(),
      onAnomalyDetected: z.boolean().optional(),
    }),
    sandbox: z.object({
      allowedCommands: z.array(z.string()).optional(),
      networkAccess: z.boolean().optional(),
    }),
    memory: z.object({
      type: z.enum(['persistent', 'session', 'none']),
      path: z.string().optional(),
    }),
  }),
  budget: z.object({
    maxTokensPerTask: z.number().positive(),
    maxCostPerDay: z.number().positive(),
    warningAt: z.number().min(0).max(100),
    fallbackOnBudget: z.enum(['budget', 'local', 'stop']),
  }),
  git: z.object({
    autoCommit: z.boolean(),
    commitMessageFormat: z.enum(['conventional', 'descriptive', 'custom']),
    requireApproval: z.boolean(),
  }),
  team: z.object({
    contextSync: z.boolean(),
    remoteContext: z.string(),
  }),
});
