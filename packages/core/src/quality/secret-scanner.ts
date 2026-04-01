/**
 * PhantomindAI — Secret Scanner
 * Detect and prevent secrets, credentials, and sensitive data in code.
 */

import type { SecretMatch } from '../types.js';

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  replacement: (match: string) => string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // API Keys
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/g,
    severity: 'critical',
    replacement: () => 'process.env.ANTHROPIC_API_KEY',
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-proj-[a-zA-Z0-9_-]{20,}/g,
    severity: 'critical',
    replacement: () => 'process.env.OPENAI_API_KEY',
  },
  {
    name: 'OpenAI Legacy Key',
    pattern: /sk-[a-zA-Z0-9]{32,}/g,
    severity: 'critical',
    replacement: () => 'process.env.OPENAI_API_KEY',
  },
  {
    name: 'Google API Key',
    pattern: /AIza[a-zA-Z0-9_-]{35}/g,
    severity: 'critical',
    replacement: () => 'process.env.GOOGLE_API_KEY',
  },
  {
    name: 'Groq API Key',
    pattern: /gsk_[a-zA-Z0-9]{20,}/g,
    severity: 'critical',
    replacement: () => 'process.env.GROQ_API_KEY',
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[A-Z0-9]{16}/g,
    severity: 'critical',
    replacement: () => 'process.env.AWS_ACCESS_KEY_ID',
  },
  {
    name: 'AWS Secret Key',
    pattern: /(?:aws_secret_access_key|secret_key)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    severity: 'critical',
    replacement: () => 'process.env.AWS_SECRET_ACCESS_KEY',
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    severity: 'critical',
    replacement: () => 'process.env.GITHUB_TOKEN',
  },
  {
    name: 'Stripe API Key',
    pattern: /(?:sk|rk)_(?:test|live)_[a-zA-Z0-9]{24,}/g,
    severity: 'critical',
    replacement: () => 'process.env.STRIPE_SECRET_KEY',
  },
  {
    name: 'Slack Token',
    pattern: /xox[bporas]-[0-9]{12}-[0-9]{12,}-[a-zA-Z0-9]{24,}/g,
    severity: 'critical',
    replacement: () => 'process.env.SLACK_TOKEN',
  },
  // Private Keys
  {
    name: 'RSA Private Key',
    pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g,
    severity: 'critical',
    replacement: () => 'process.env.PRIVATE_KEY_PATH',
  },
  {
    name: 'SSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: 'critical',
    replacement: () => 'process.env.SSH_PRIVATE_KEY_PATH',
  },
  // Connection Strings
  {
    name: 'Database Connection URL',
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s"']+:[^\s"']+@[^\s"']+/gi,
    severity: 'high',
    replacement: () => 'process.env.DATABASE_URL',
  },
  // Passwords
  {
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
    severity: 'high',
    replacement: () => 'process.env.PASSWORD',
  },
  // JWT
  {
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    severity: 'high',
    replacement: () => 'process.env.JWT_TOKEN',
  },
  // Generic secrets
  {
    name: 'Generic API Key Pattern',
    pattern: /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[=:]\s*['"][a-zA-Z0-9_-]{16,}['"]/gi,
    severity: 'medium',
    replacement: () => 'process.env.API_KEY',
  },
];

export class SecretScanner {
  private patterns: SecretPattern[];

  constructor(customPatterns?: SecretPattern[]) {
    this.patterns = [...SECRET_PATTERNS, ...(customPatterns ?? [])];
  }

  /**
   * Scan content for secrets
   */
  scan(content: string, fileName = 'unknown'): SecretMatch[] {
    const matches: SecretMatch[] = [];
    const lines = content.split('\n');

    for (const pattern of this.patterns) {
      // Reset regex state
      pattern.pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.pattern.exec(content)) !== null) {
        const beforeMatch = content.slice(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        const lineStart = beforeMatch.lastIndexOf('\n') + 1;
        const column = match.index - lineStart;

        matches.push({
          pattern: pattern.name,
          file: fileName,
          line: lineNumber,
          column,
          value: this.redactValue(match[0]),
          replacement: pattern.replacement(match[0]),
          severity: pattern.severity,
        });
      }
    }

    return matches;
  }

  /**
   * Scan content and return cleaned version
   */
  scanAndReplace(content: string, fileName = 'unknown'): { cleaned: string; matches: SecretMatch[] } {
    let cleaned = content;
    const matches = this.scan(content, fileName);

    // Sort by position descending to replace from end to start (preserves positions)
    const sortedMatches = [...matches].sort((a, b) => {
      if (a.line !== b.line) return b.line - a.line;
      return b.column - a.column;
    });

    for (const m of sortedMatches) {
      // Find the original match in the cleaned content
      for (const pattern of this.patterns) {
        if (pattern.name === m.pattern) {
          cleaned = cleaned.replace(pattern.pattern, pattern.replacement(''));
          pattern.pattern.lastIndex = 0;
          break;
        }
      }
    }

    return { cleaned, matches };
  }

  /**
   * Quick check if content contains any secrets
   */
  hasSecrets(content: string): boolean {
    for (const pattern of this.patterns) {
      pattern.pattern.lastIndex = 0;
      if (pattern.pattern.test(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Redact a secret value for display (show first/last chars only)
   */
  private redactValue(value: string): string {
    if (value.length <= 8) return '***REDACTED***';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
}
