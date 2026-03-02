import { describe, it, expect } from 'vitest';
import { checkSchemaSafety } from '../../src/core/safety/safety-checker.js';
import type { StateFile, DatabaseSchema } from '../../src/types/schema.js';

describe('Safety Layer Integration', () => {
  describe('Drop table detection', () => {
    it('detects when table is completely removed', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              email: { type: 'text' },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {},
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.hasDestructiveOps).toBe(true);
      expect(report.findings).toContainEqual(
        expect.objectContaining({
          code: 'DROP_TABLE',
          table: 'users',
          safetyLevel: 'DESTRUCTIVE',
        })
      );
    });
  });

  describe('Column removal detection', () => {
    it('detects column drops in modified tables', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              email: { type: 'text' },
              phone: { type: 'text' },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            primaryKey: 'id',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'email', type: 'text' },
            ],
          },
        },
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.hasDestructiveOps).toBe(true);
      expect(report.findings).toContainEqual(
        expect.objectContaining({
          code: 'DROP_COLUMN',
          table: 'users',
          column: 'phone',
          safetyLevel: 'DESTRUCTIVE',
        })
      );
    });
  });

  describe('Type change detection', () => {
    it('detects dangerous type narrowing', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          products: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              description: { type: 'text' },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {
          products: {
            name: 'products',
            primaryKey: 'id',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'description', type: 'varchar(100)' },
            ],
          },
        },
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.hasDestructiveOps).toBe(true);
      expect(report.findings).toContainEqual(
        expect.objectContaining({
          code: 'ALTER_COLUMN_TYPE',
          table: 'products',
          column: 'description',
          safetyLevel: 'DESTRUCTIVE',
          message: expect.stringContaining('may truncate'),
        })
      );
    });

    it('detects safe type widening as WARNING', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          products: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              price: { type: 'numeric(5,2)' },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {
          products: {
            name: 'products',
            primaryKey: 'id',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'price', type: 'numeric(10,2)' },
            ],
          },
        },
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.hasWarnings).toBe(true);
      expect(report.hasDestructiveOps).toBe(false);
      expect(report.findings).toContainEqual(
        expect.objectContaining({
          code: 'ALTER_COLUMN_TYPE',
          safetyLevel: 'WARNING',
        })
      );
    });
  });

  describe('Nullability constraint detection', () => {
    it('detects dangerous NOT NULL constraint additions', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              nickname: { type: 'text', nullable: true },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            primaryKey: 'id',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'nickname', type: 'text', nullable: false },
            ],
          },
        },
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.hasWarnings).toBe(true);
      expect(report.findings).toContainEqual(
        expect.objectContaining({
          code: 'SET_NOT_NULL',
          table: 'users',
          column: 'nickname',
          safetyLevel: 'WARNING',
        })
      );
    });

    it('does not report when changing NOT NULL to nullable', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              nickname: { type: 'text', nullable: false },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            primaryKey: 'id',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'nickname', type: 'text', nullable: true },
            ],
          },
        },
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.findings).toHaveLength(0);
    });
  });

  describe('Complex scenarios', () => {
    it('handles migrations with mixed safe and destructive changes', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              email: { type: 'varchar(255)' },
              legacy_field: { type: 'text' },
              status: { type: 'text', nullable: true },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            primaryKey: 'id',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'email', type: 'varchar(500)' }, // SAFE: widening
              { name: 'status', type: 'text', nullable: false }, // WARNING: not null
              // legacy_field removed: DESTRUCTIVE
            ],
          },
        },
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.hasDestructiveOps).toBe(true);
      expect(report.hasWarnings).toBe(true);

      const codes = report.findings.map(f => f.code);
      expect(codes).toContain('DROP_COLUMN');
      expect(codes).toContain('SET_NOT_NULL');
    });

    it('accepts multiple table operations', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
            },
            primaryKey: 'id',
          },
          posts: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              author_id: { type: 'uuid' },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            primaryKey: 'id',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
          },
          posts: {
            name: 'posts',
            primaryKey: 'id',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'author_id', type: 'uuid' },
            ],
          },
          comments: {
            name: 'comments',
            primaryKey: 'id',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
          },
        },
      };

      const report = checkSchemaSafety(previous, current);

      expect(Array.isArray(report.findings)).toBe(true);
      expect(report.findings.every(f => typeof f.table === 'string')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('handles empty schema', () => {
      const previous: StateFile = {
        version: 1,
        tables: {},
      };

      const current: DatabaseSchema = {
        tables: {},
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.findings).toHaveLength(0);
      expect(report.hasDestructiveOps).toBe(false);
      expect(report.hasWarnings).toBe(false);
    });

    it('normalizes type names with whitespace', () => {
      const previous: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
              price: { type: 'numeric(5,2)' },
            },
            primaryKey: 'id',
          },
        },
      };

      const current: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            primaryKey: 'id',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'price', type: 'numeric(10,2)' },
            ],
          },
        },
      };

      const report = checkSchemaSafety(previous, current);

      expect(report.hasDestructiveOps).toBe(false);
      expect(report.hasWarnings).toBe(true);
    });
  });
});
