/**
 * PhantomMindAI — Schema Registry
 * Manages JSON Schema definitions for structured AI output validation.
 * Supports prebuilt schemas and custom user schemas.
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { z } from 'zod';

export interface SchemaDefinition {
  name: string;
  description: string;
  version: string;
  schema: Record<string, unknown>;
  examples?: unknown[];
  tags?: string[];
}

export class SchemaRegistry {
  private schemas = new Map<string, SchemaDefinition>();
  private projectRoot: string;
  private customSchemaDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.customSchemaDir = join(projectRoot, '.phantomind', 'schemas');
    this.loadPrebuilt();
  }

  /**
   * Load prebuilt schemas
   */
  private loadPrebuilt(): void {
    for (const [name, schema] of Object.entries(PREBUILT_SCHEMAS)) {
      this.schemas.set(name, schema);
    }
  }

  /**
   * Load custom schemas from project directory
   */
  async loadCustomSchemas(): Promise<number> {
    if (!existsSync(this.customSchemaDir)) return 0;

    let loaded = 0;
    const files = await readdir(this.customSchemaDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(this.customSchemaDir, file), 'utf-8');
        const schema = JSON.parse(content) as SchemaDefinition;
        if (schema.name && schema.schema) {
          this.schemas.set(schema.name, schema);
          loaded++;
        }
      } catch {
        // Skip invalid schemas
      }
    }

    return loaded;
  }

  /**
   * Register a schema
   */
  register(schema: SchemaDefinition): void {
    this.schemas.set(schema.name, schema);
  }

  /**
   * Get a schema by name
   */
  get(name: string): SchemaDefinition | undefined {
    return this.schemas.get(name);
  }

  /**
   * List all available schemas
   */
  list(): SchemaDefinition[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Search schemas by name or tag
   */
  search(query: string): SchemaDefinition[] {
    const q = query.toLowerCase();
    return this.list().filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags?.some(t => t.toLowerCase().includes(q)),
    );
  }

  /**
   * Validate data against a schema
   */
  validate(schemaName: string, data: unknown): { valid: boolean; errors: string[] } {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      return { valid: false, errors: [`Schema '${schemaName}' not found`] };
    }

    const errors: string[] = [];
    this.validateValue(data, schema.schema, '', errors);
    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate a prompt instruction for structured output
   */
  getPromptInstruction(schemaName: string): string {
    const schema = this.schemas.get(schemaName);
    if (!schema) return '';

    const lines = [
      `Respond with valid JSON matching this schema:`,
      '```json',
      JSON.stringify(schema.schema, null, 2),
      '```',
    ];

    if (schema.examples && schema.examples.length > 0) {
      lines.push('', 'Example output:');
      lines.push('```json');
      lines.push(JSON.stringify(schema.examples[0], null, 2));
      lines.push('```');
    }

    return lines.join('\n');
  }

  /**
   * Save a custom schema to disk
   */
  async saveSchema(schema: SchemaDefinition): Promise<void> {
    if (!existsSync(this.customSchemaDir)) {
      await mkdir(this.customSchemaDir, { recursive: true });
    }

    const filename = `${schema.name.replace(/[^a-z0-9-]/gi, '-')}.json`;
    await writeFile(
      join(this.customSchemaDir, filename),
      JSON.stringify(schema, null, 2),
    );
    this.schemas.set(schema.name, schema);
  }

  /**
   * Remove a schema
   */
  remove(name: string): boolean {
    return this.schemas.delete(name);
  }

  /**
   * Convert a Zod schema to JSON Schema (basic)
   */
  static fromZod(name: string, description: string, zodSchema: z.ZodType): SchemaDefinition {
    // Basic Zod-to-JSON-Schema conversion for common types
    const schema = zodToJsonSchema(zodSchema);
    return { name, description, version: '1.0.0', schema };
  }

  /**
   * Basic recursive JSON Schema validation
   */
  private validateValue(
    data: unknown,
    schema: Record<string, unknown>,
    path: string,
    errors: string[],
  ): void {
    const type = schema.type as string;

    if (type === 'object') {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        errors.push(`${path || 'root'}: expected object`);
        return;
      }

      const required = (schema.required ?? []) as string[];
      for (const req of required) {
        if (!(req in (data as Record<string, unknown>))) {
          errors.push(`${path}.${req}: required field missing`);
        }
      }

      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in (data as Record<string, unknown>)) {
          this.validateValue(
            (data as Record<string, unknown>)[key],
            propSchema,
            path ? `${path}.${key}` : key,
            errors,
          );
        }
      }
    } else if (type === 'array') {
      if (!Array.isArray(data)) {
        errors.push(`${path || 'root'}: expected array`);
        return;
      }
      const items = schema.items as Record<string, unknown> | undefined;
      if (items) {
        for (let i = 0; i < data.length; i++) {
          this.validateValue(data[i], items, `${path}[${i}]`, errors);
        }
      }
    } else if (type === 'string') {
      if (typeof data !== 'string') errors.push(`${path || 'root'}: expected string`);
    } else if (type === 'number' || type === 'integer') {
      if (typeof data !== 'number') errors.push(`${path || 'root'}: expected number`);
    } else if (type === 'boolean') {
      if (typeof data !== 'boolean') errors.push(`${path || 'root'}: expected boolean`);
    }
  }
}

/**
 * Basic Zod to JSON Schema converter
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema(schema.element) };
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema.options };
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(schema.removeDefault());
    return { ...inner, default: schema._def.defaultValue() };
  }

  return {};
}

/**
 * Prebuilt schema definitions for common AI output formats.
 */
const PREBUILT_SCHEMAS: Record<string, SchemaDefinition> = {
  'code-review': {
    name: 'code-review',
    description: 'Structured code review output',
    version: '1.0.0',
    tags: ['review', 'quality'],
    schema: {
      type: 'object',
      required: ['summary', 'issues', 'suggestions', 'rating'],
      properties: {
        summary: { type: 'string', description: 'Overall review summary' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            required: ['severity', 'file', 'line', 'description'],
            properties: {
              severity: { type: 'string', enum: ['critical', 'major', 'minor', 'info'] },
              file: { type: 'string' },
              line: { type: 'number' },
              description: { type: 'string' },
              suggestion: { type: 'string' },
            },
          },
        },
        suggestions: { type: 'array', items: { type: 'string' } },
        rating: { type: 'number', minimum: 1, maximum: 10 },
      },
    },
    examples: [{
      summary: 'Generally well-structured code with minor improvements needed',
      issues: [
        { severity: 'minor', file: 'src/utils.ts', line: 42, description: 'Consider using const instead of let', suggestion: 'const result = ...' },
      ],
      suggestions: ['Add error handling for edge cases', 'Consider extracting helper function'],
      rating: 8,
    }],
  },

  'api-endpoint': {
    name: 'api-endpoint',
    description: 'API endpoint specification',
    version: '1.0.0',
    tags: ['api', 'specification'],
    schema: {
      type: 'object',
      required: ['method', 'path', 'description', 'request', 'response'],
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        path: { type: 'string' },
        description: { type: 'string' },
        parameters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              in: { type: 'string', enum: ['path', 'query', 'header'] },
              type: { type: 'string' },
              required: { type: 'boolean' },
            },
          },
        },
        request: {
          type: 'object',
          properties: {
            contentType: { type: 'string' },
            body: { type: 'object' },
          },
        },
        response: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            contentType: { type: 'string' },
            body: { type: 'object' },
          },
        },
      },
    },
  },

  'test-plan': {
    name: 'test-plan',
    description: 'Test plan specification',
    version: '1.0.0',
    tags: ['testing', 'quality'],
    schema: {
      type: 'object',
      required: ['feature', 'testCases'],
      properties: {
        feature: { type: 'string' },
        testCases: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'type', 'steps', 'expected'],
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['unit', 'integration', 'e2e'] },
              steps: { type: 'array', items: { type: 'string' } },
              expected: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
          },
        },
        coverage: {
          type: 'object',
          properties: {
            happyPath: { type: 'boolean' },
            edgeCases: { type: 'boolean' },
            errorHandling: { type: 'boolean' },
          },
        },
      },
    },
  },

  'migration-plan': {
    name: 'migration-plan',
    description: 'Database or code migration plan',
    version: '1.0.0',
    tags: ['migration', 'database'],
    schema: {
      type: 'object',
      required: ['name', 'steps', 'rollbackPlan'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            required: ['order', 'action', 'description'],
            properties: {
              order: { type: 'number' },
              action: { type: 'string' },
              description: { type: 'string' },
              sql: { type: 'string' },
              reversible: { type: 'boolean' },
            },
          },
        },
        rollbackPlan: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              order: { type: 'number' },
              action: { type: 'string' },
            },
          },
        },
        risks: { type: 'array', items: { type: 'string' } },
      },
    },
  },

  'refactoring-plan': {
    name: 'refactoring-plan',
    description: 'Code refactoring plan',
    version: '1.0.0',
    tags: ['refactoring', 'code-quality'],
    schema: {
      type: 'object',
      required: ['reason', 'changes', 'impact'],
      properties: {
        reason: { type: 'string' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['file', 'description', 'type'],
            properties: {
              file: { type: 'string' },
              description: { type: 'string' },
              type: { type: 'string', enum: ['rename', 'move', 'extract', 'inline', 'restructure'] },
              before: { type: 'string' },
              after: { type: 'string' },
            },
          },
        },
        impact: {
          type: 'object',
          properties: {
            filesAffected: { type: 'number' },
            breakingChanges: { type: 'boolean' },
            testsNeeded: { type: 'boolean' },
          },
        },
      },
    },
  },

  'architecture-decision': {
    name: 'architecture-decision',
    description: 'Architecture Decision Record (ADR)',
    version: '1.0.0',
    tags: ['architecture', 'decision'],
    schema: {
      type: 'object',
      required: ['title', 'status', 'context', 'decision', 'consequences'],
      properties: {
        title: { type: 'string' },
        status: { type: 'string', enum: ['proposed', 'accepted', 'deprecated', 'superseded'] },
        context: { type: 'string' },
        decision: { type: 'string' },
        alternatives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              pros: { type: 'array', items: { type: 'string' } },
              cons: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        consequences: {
          type: 'object',
          properties: {
            positive: { type: 'array', items: { type: 'string' } },
            negative: { type: 'array', items: { type: 'string' } },
            neutral: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },

  'error-analysis': {
    name: 'error-analysis',
    description: 'Error/bug analysis report',
    version: '1.0.0',
    tags: ['debugging', 'error'],
    schema: {
      type: 'object',
      required: ['error', 'rootCause', 'fix'],
      properties: {
        error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            stack: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
          },
        },
        rootCause: { type: 'string' },
        fix: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            code: { type: 'string' },
            file: { type: 'string' },
          },
        },
        prevention: { type: 'string' },
        relatedIssues: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};
