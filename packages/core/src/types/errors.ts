/**
 * PhantomindAI — Structured Error System
 * Provides detailed error context with diagnostic info and remediation steps.
 */

export type ErrorCategory = 'config' | 'provider' | 'adapter' | 'context' | 'validation' | 'filesystem' | 'network' | 'unknown';

export interface ErrorDiagnostic {
  category: ErrorCategory;
  code: string;
  message: string;
  details: string;
  remediation: string[];
  suggestions?: string[];
  source?: string;
  timestamp: string;
}

/**
 * Base PhantomindAI error with diagnostic capabilities
 */
export class PhantomindError extends Error {
  readonly diagnostic: ErrorDiagnostic;

  constructor(
    category: ErrorCategory,
    code: string,
    message: string,
    details: string,
    remediation: string[] = [],
    suggestions: string[] = [],
    source?: string,
  ) {
    super(message);
    this.name = 'PhantomindError';
    this.diagnostic = {
      category,
      code,
      message,
      details,
      remediation,
      suggestions,
      source,
      timestamp: new Date().toISOString(),
    };
  }

  toDiagnosticString(): string {
    const lines: string[] = [];
    const diag = this.diagnostic;
    lines.push(`\n❌ ${diag.code}: ${diag.message}`);
    lines.push(`   Category: ${diag.category}`);
    if (diag.details) {
      lines.push(`   Details: ${diag.details}`);
    }
    if (diag.remediation && diag.remediation.length > 0) {
      lines.push(`\n   🔧 How to fix:`);
      for (const step of diag.remediation) {
        lines.push(`      • ${step}`);
      }
    }
    if (diag.suggestions && diag.suggestions.length > 0) {
      lines.push(`\n   💡 Suggestions:`);
      for (const suggestion of diag.suggestions) {
        lines.push(`      • ${suggestion}`);
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.diagnostic.code,
      category: this.diagnostic.category,
      message: this.diagnostic.message,
      details: this.diagnostic.details,
      remediation: this.diagnostic.remediation,
      suggestions: this.diagnostic.suggestions,
      source: this.diagnostic.source,
      timestamp: this.diagnostic.timestamp,
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends PhantomindError {
  constructor(code: string, message: string, details: string, remediation: string[] = [], suggestions: string[] = []) {
    super('config', code, message, details, remediation, suggestions);
    this.name = 'ConfigError';
  }
}

/**
 * Provider (LLM API) related errors
 */
export class ProviderError extends PhantomindError {
  constructor(code: string, message: string, details: string, remediation: string[] = [], suggestions: string[] = []) {
    super('provider', code, message, details, remediation, suggestions);
    this.name = 'ProviderError';
  }
}

/**
 * Adapter-related errors
 */
export class AdapterError extends PhantomindError {
  constructor(code: string, message: string, details: string, remediation: string[] = [], suggestions: string[] = []) {
    super('adapter', code, message, details, remediation, suggestions);
    this.name = 'AdapterError';
  }
}

/**
 * Context/learning related errors
 */
export class ContextError extends PhantomindError {
  constructor(code: string, message: string, details: string, remediation: string[] = [], suggestions: string[] = []) {
    super('context', code, message, details, remediation, suggestions);
    this.name = 'ContextError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends PhantomindError {
  constructor(code: string, message: string, details: string, remediation: string[] = [], suggestions: string[] = []) {
    super('validation', code, message, details, remediation, suggestions);
    this.name = 'ValidationError';
  }
}

/**
 * Filesystem operation errors
 */
export class FilesystemError extends PhantomindError {
  constructor(code: string, message: string, details: string, remediation: string[] = [], suggestions: string[] = []) {
    super('filesystem', code, message, details, remediation, suggestions);
    this.name = 'FilesystemError';
  }
}

/**
 * Network/API errors
 */
export class NetworkError extends PhantomindError {
  constructor(code: string, message: string, details: string, remediation: string[] = [], suggestions: string[] = []) {
    super('network', code, message, details, remediation, suggestions);
    this.name = 'NetworkError';
  }
}
