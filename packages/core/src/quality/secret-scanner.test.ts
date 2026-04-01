import { describe, it, expect, beforeEach } from 'vitest';
import { SecretScanner } from './secret-scanner.js';

describe('SecretScanner', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('scan()', () => {
    it('detects Anthropic API keys', () => {
      const content = `const key = "sk-ant-abcdefghijklmnopqrstuvwxyz1234567890";`;
      const matches = scanner.scan(content, 'test.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('Anthropic API Key');
      expect(matches[0].severity).toBe('critical');
      expect(matches[0].replacement).toBe('process.env.ANTHROPIC_API_KEY');
    });

    it('detects OpenAI API keys', () => {
      const content = `const key = "sk-proj-abcdefghijklmnopqrstuvwx1234567890";`;
      const matches = scanner.scan(content, 'test.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('OpenAI API Key');
    });

    it('detects Google API keys', () => {
      const content = `const key = "AIzaSyD-abcdefghij_klmnopqrstuvwxyz12345";`;
      const matches = scanner.scan(content, 'test.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('Google API Key');
    });

    it('detects AWS access keys', () => {
      const content = `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`;
      const matches = scanner.scan(content, '.env');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('AWS Access Key');
    });

    it('detects GitHub tokens', () => {
      const content = `const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";`;
      const matches = scanner.scan(content, 'config.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('GitHub Token');
    });

    it('detects Stripe API keys', () => {
      const content = `STRIPE_KEY="sk_test_abcdefghijklmnopqrstuvwxyz"`;
      const matches = scanner.scan(content, '.env');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('Stripe API Key');
    });

    it('detects RSA private keys', () => {
      const content = `-----BEGIN RSA PRIVATE KEY-----\nMIIE...`;
      const matches = scanner.scan(content, 'key.pem');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('RSA Private Key');
      expect(matches[0].severity).toBe('critical');
    });

    it('detects database connection strings with credentials', () => {
      const content = `const url = "postgres://admin:secretpassword@db.example.com:5432/mydb";`;
      const matches = scanner.scan(content, 'config.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('Database Connection URL');
    });

    it('detects hardcoded passwords', () => {
      const content = `password = "SuperSecret123!"`;
      const matches = scanner.scan(content, 'config.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('Hardcoded Password');
    });

    it('detects JWT tokens', () => {
      const content = `const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";`;
      const matches = scanner.scan(content, 'auth.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('JWT Token');
    });

    it('detects generic API key patterns', () => {
      const content = `api_key = "abcdef1234567890abcd"`;
      const matches = scanner.scan(content, 'config.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('Generic API Key Pattern');
    });

    it('reports correct line and column numbers', () => {
      const content = `line one\nline two\nconst key = "sk-ant-abcdefghijklmnopqrstuvwxyz1234567890";`;
      const matches = scanner.scan(content, 'test.ts');
      expect(matches).toHaveLength(1);
      expect(matches[0].line).toBe(3);
      expect(matches[0].column).toBeGreaterThan(0);
    });

    it('detects multiple secrets in one file', () => {
      const content = [
        `ANTHROPIC_KEY="sk-ant-abcdefghijklmnopqrstuvwxyz1234567890"`,
        `OPENAI_KEY="sk-proj-abcdefghijklmnopqrstuvwx1234567890"`,
        `password = "MySecret1234"`,
      ].join('\n');
      const matches = scanner.scan(content, '.env');
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('returns empty array for clean content', () => {
      const content = `const config = { host: 'localhost', port: 3000 };`;
      const matches = scanner.scan(content, 'test.ts');
      expect(matches).toHaveLength(0);
    });

    it('redacts secret values in output', () => {
      const content = `const key = "sk-ant-abcdefghijklmnopqrstuvwxyz1234567890";`;
      const matches = scanner.scan(content, 'test.ts');
      expect(matches[0].value).toContain('...');
      expect(matches[0].value).not.toBe(content);
    });
  });

  describe('hasSecrets()', () => {
    it('returns true when secrets are present', () => {
      expect(scanner.hasSecrets('const key = "sk-ant-abcdefghijklmnopqrstuvwxyz1234567890"')).toBe(true);
    });

    it('returns false for clean content', () => {
      expect(scanner.hasSecrets('const x = 42;')).toBe(false);
    });
  });

  describe('scanAndReplace()', () => {
    it('replaces secrets with environment variable references', () => {
      const content = `const key = "sk-ant-abcdefghijklmnopqrstuvwxyz1234567890";`;
      const { cleaned, matches } = scanner.scanAndReplace(content, 'test.ts');
      expect(matches).toHaveLength(1);
      expect(cleaned).toContain('process.env.ANTHROPIC_API_KEY');
      expect(cleaned).not.toContain('sk-ant-');
    });

    it('returns original content when no secrets found', () => {
      const content = `const x = 42;`;
      const { cleaned, matches } = scanner.scanAndReplace(content, 'test.ts');
      expect(cleaned).toBe(content);
      expect(matches).toHaveLength(0);
    });
  });

  describe('custom patterns', () => {
    it('supports custom secret patterns', () => {
      const custom = new SecretScanner([{
        name: 'Custom Token',
        pattern: /CUSTOM_[A-Z0-9]{20}/g,
        severity: 'high',
        replacement: () => 'process.env.CUSTOM_TOKEN',
      }]);

      const matches = custom.scan('token = "CUSTOM_ABCDEFGHIJ1234567890"', 'cfg.ts');
      expect(matches.some(m => m.pattern === 'Custom Token')).toBe(true);
    });
  });
});
