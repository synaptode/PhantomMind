import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from './registry.js';
import { z } from 'zod';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('SchemaRegistry', () => {
  let tmpDir: string;
  let registry: SchemaRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pm-schema-test-'));
    registry = new SchemaRegistry(tmpDir);
  });

  describe('prebuilt schemas', () => {
    it('loads prebuilt schemas on construction', () => {
      const list = registry.list();
      expect(list.length).toBeGreaterThan(0);
    });

    it('includes code-review schema', () => {
      const schema = registry.get('code-review');
      expect(schema).toBeDefined();
      expect(schema!.name).toBe('code-review');
      expect(schema!.schema).toHaveProperty('type', 'object');
    });

    it('includes api-endpoint schema', () => {
      expect(registry.get('api-endpoint')).toBeDefined();
    });

    it('includes test-plan schema', () => {
      expect(registry.get('test-plan')).toBeDefined();
    });

    it('includes migration-plan schema', () => {
      expect(registry.get('migration-plan')).toBeDefined();
    });
  });

  describe('register() / get()', () => {
    it('registers and retrieves a custom schema', () => {
      registry.register({
        name: 'test-schema',
        description: 'A test schema',
        version: '1.0.0',
        schema: { type: 'object', properties: { name: { type: 'string' } } },
      });

      const schema = registry.get('test-schema');
      expect(schema).toBeDefined();
      expect(schema!.name).toBe('test-schema');
    });

    it('returns undefined for nonexistent schema', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('search()', () => {
    it('searches by name', () => {
      const results = registry.search('code-review');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('code-review');
    });

    it('searches by tag', () => {
      const results = registry.search('quality');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('searches by description', () => {
      const results = registry.search('endpoint');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for no match', () => {
      expect(registry.search('zzz-no-match')).toHaveLength(0);
    });
  });

  describe('validate()', () => {
    it('validates valid data against code-review schema', () => {
      const result = registry.validate('code-review', {
        summary: 'Good code',
        issues: [],
        suggestions: ['Use const'],
        rating: 8,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects data missing required fields', () => {
      const result = registry.validate('code-review', {
        summary: 'Good code',
        // missing issues, suggestions, rating
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid field types', () => {
      const result = registry.validate('code-review', {
        summary: 123, // should be string
        issues: [],
        suggestions: [],
        rating: 8,
      });
      expect(result.valid).toBe(false);
    });

    it('validates nested objects', () => {
      const result = registry.validate('test-plan', {
        feature: 'Auth',
        testCases: [
          { name: 'login test', type: 'unit', steps: ['click login'], expected: 'success' },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('returns error for nonexistent schema', () => {
      const result = registry.validate('nonexistent', {});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    it('validates arrays correctly', () => {
      const result = registry.validate('code-review', {
        summary: 'Ok',
        issues: 'not-an-array', // should be array
        suggestions: [],
        rating: 5,
      });
      expect(result.valid).toBe(false);
    });

    it('validates boolean types', () => {
      registry.register({
        name: 'bool-test',
        description: 'test',
        version: '1.0.0',
        schema: { type: 'object', properties: { flag: { type: 'boolean' } }, required: ['flag'] },
      });

      expect(registry.validate('bool-test', { flag: true }).valid).toBe(true);
      expect(registry.validate('bool-test', { flag: 'yes' }).valid).toBe(false);
    });
  });

  describe('remove()', () => {
    it('removes a registered schema', () => {
      registry.register({ name: 'temp', description: 't', version: '1.0.0', schema: {} });
      expect(registry.get('temp')).toBeDefined();
      expect(registry.remove('temp')).toBe(true);
      expect(registry.get('temp')).toBeUndefined();
    });

    it('returns false for nonexistent schema', () => {
      expect(registry.remove('nonexistent')).toBe(false);
    });
  });

  describe('getPromptInstruction()', () => {
    it('generates instruction with schema JSON', () => {
      const instruction = registry.getPromptInstruction('code-review');
      expect(instruction).toContain('Respond with valid JSON');
      expect(instruction).toContain('"type"');
    });

    it('includes examples when available', () => {
      const instruction = registry.getPromptInstruction('code-review');
      expect(instruction).toContain('Example output');
    });

    it('returns empty for nonexistent schema', () => {
      expect(registry.getPromptInstruction('nonexistent')).toBe('');
    });
  });

  describe('loadCustomSchemas()', () => {
    it('returns 0 when schema directory does not exist', async () => {
      const count = await registry.loadCustomSchemas();
      expect(count).toBe(0);
    });

    it('loads custom schemas from disk', async () => {
      const schemaDir = join(tmpDir, '.phantomind', 'schemas');
      await mkdir(schemaDir, { recursive: true });
      await writeFile(
        join(schemaDir, 'custom.json'),
        JSON.stringify({
          name: 'custom-schema',
          description: 'A custom schema',
          version: '1.0.0',
          schema: { type: 'object' },
        }),
      );

      const count = await registry.loadCustomSchemas();
      expect(count).toBe(1);
      expect(registry.get('custom-schema')).toBeDefined();
    });

    it('skips invalid JSON files', async () => {
      const schemaDir = join(tmpDir, '.phantomind', 'schemas');
      await mkdir(schemaDir, { recursive: true });
      await writeFile(join(schemaDir, 'bad.json'), 'not valid json');

      const count = await registry.loadCustomSchemas();
      expect(count).toBe(0);
    });
  });

  describe('saveSchema()', () => {
    it('saves schema to disk and registers it', async () => {
      const schema = {
        name: 'saved-schema',
        description: 'Saved',
        version: '1.0.0',
        schema: { type: 'string' },
      };
      await registry.saveSchema(schema);
      expect(registry.get('saved-schema')).toBeDefined();
    });
  });

  describe('fromZod()', () => {
    it('converts Zod string to JSON Schema', () => {
      const result = SchemaRegistry.fromZod('str', 'string schema', z.string());
      expect(result.schema).toEqual({ type: 'string' });
    });

    it('converts Zod number to JSON Schema', () => {
      const result = SchemaRegistry.fromZod('num', 'number schema', z.number());
      expect(result.schema).toEqual({ type: 'number' });
    });

    it('converts Zod boolean to JSON Schema', () => {
      const result = SchemaRegistry.fromZod('bool', 'boolean schema', z.boolean());
      expect(result.schema).toEqual({ type: 'boolean' });
    });

    it('converts Zod object to JSON Schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const result = SchemaRegistry.fromZod('obj', 'object schema', zodSchema);
      expect(result.schema).toMatchObject({
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name', 'age'],
      });
    });

    it('converts Zod array to JSON Schema', () => {
      const result = SchemaRegistry.fromZod('arr', 'array schema', z.array(z.string()));
      expect(result.schema).toMatchObject({ type: 'array', items: { type: 'string' } });
    });

    it('handles Zod optional fields', () => {
      const zodSchema = z.object({
        name: z.string(),
        bio: z.string().optional(),
      });
      const result = SchemaRegistry.fromZod('opt', 'optional schema', zodSchema);
      expect((result.schema as any).required).toContain('name');
      expect((result.schema as any).required).not.toContain('bio');
    });

    it('converts Zod enum to JSON Schema', () => {
      const result = SchemaRegistry.fromZod('enum', 'enum schema', z.enum(['a', 'b', 'c']));
      expect(result.schema).toMatchObject({ type: 'string', enum: ['a', 'b', 'c'] });
    });
  });
});
