import { describe, it, expect } from 'vitest';
import { checkOperationSafety, checkSchemaSafety } from '../../src/core/safety/safety-checker.js';
import type { Operation, StateFile, DatabaseSchema } from '../../src/types/schema.js';

describe('checkOperationSafety', () => {
  describe('DROP_TABLE operation', () => {
    it('returns Finding for drop_table operation', () => {
      const operation: Operation = {
        kind: 'drop_table',
        tableName: 'users',
      };

      const result = checkOperationSafety(operation);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        safetyLevel: 'DESTRUCTIVE',
        code: 'DROP_TABLE',
        table: 'users',
        message: 'Table removed',
        operationKind: 'drop_table',
      });
    });
  });

  describe('DROP_COLUMN operation', () => {
    it('returns Finding for drop_column operation', () => {
      const operation: Operation = {
        kind: 'drop_column',
        tableName: 'users',
        columnName: 'email',
      };

      const result = checkOperationSafety(operation);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        safetyLevel: 'DESTRUCTIVE',
        code: 'DROP_COLUMN',
        table: 'users',
        column: 'email',
        message: 'Column removed',
        operationKind: 'drop_column',
      });
    });
  });

  describe('ALTER_COLUMN_TYPE operation', () => {
    it('returns Finding for UUID type change (DESTRUCTIVE)', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'id',
        fromType: 'uuid',
        toType: 'text',
      };

      const result = checkOperationSafety(operation);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        safetyLevel: 'DESTRUCTIVE',
        code: 'ALTER_COLUMN_TYPE',
        table: 'users',
        column: 'id',
        from: 'uuid',
        to: 'text',
        message: 'Type changed from uuid to text (likely incompatible cast)',
        operationKind: 'column_type_changed',
      });
    });

    it('returns Finding for int narrowing (DESTRUCTIVE)', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'products',
        columnName: 'quantity',
        fromType: 'bigint',
        toType: 'int',
      };

      const result = checkOperationSafety(operation);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        safetyLevel: 'DESTRUCTIVE',
        code: 'ALTER_COLUMN_TYPE',
        table: 'products',
        column: 'quantity',
        message: 'Type narrowed from bigint to int (likely incompatible cast)',
      });
    });

    it('returns Finding for int widening (WARNING)', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'products',
        columnName: 'quantity',
        fromType: 'int',
        toType: 'bigint',
      };

      const result = checkOperationSafety(operation);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        safetyLevel: 'WARNING',
        code: 'ALTER_COLUMN_TYPE',
        message: 'Type widened from int to bigint',
      });
    });

    it('returns Finding for text to varchar truncation (DESTRUCTIVE)', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'posts',
        columnName: 'content',
        fromType: 'text',
        toType: 'varchar(50)',
      };

      const result = checkOperationSafety(operation);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        safetyLevel: 'DESTRUCTIVE',
        message: 'Type changed from text to varchar(50) (may truncate existing values)',
      });
    });

    it('returns Finding for varchar to text widening (WARNING)', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'posts',
        columnName: 'content',
        fromType: 'varchar(100)',
        toType: 'text',
      };

      const result = checkOperationSafety(operation);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        safetyLevel: 'WARNING',
        message: 'Type widened from varchar(100) to text',
      });
    });
  });

  describe('SET_NOT_NULL operation', () => {
    it('returns Finding when changing nullable to not null (WARNING)', () => {
      const operation: Operation = {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'email',
        from: true,
        to: false,
      };

      const result = checkOperationSafety(operation);

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        safetyLevel: 'WARNING',
        code: 'SET_NOT_NULL',
        table: 'users',
        column: 'email',
        message: 'Column changed to NOT NULL (may fail if data contains NULLs)',
        operationKind: 'column_nullability_changed',
      });
    });

    it('returns null when changing not null to nullable (SAFE)', () => {
      const operation: Operation = {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'email',
        from: false,
        to: true,
      };

      const result = checkOperationSafety(operation);

      expect(result).toBeNull();
    });
  });

  describe('SAFE operations', () => {
    it('returns null for create_table', () => {
      const operation: Operation = {
        kind: 'create_table',
        table: { name: 'new_table', columns: [] },
      };

      expect(checkOperationSafety(operation)).toBeNull();
    });

    it('returns null for add_column', () => {
      const operation: Operation = {
        kind: 'add_column',
        tableName: 'users',
        column: { name: 'email', type: 'text' },
      };

      expect(checkOperationSafety(operation)).toBeNull();
    });

    it('returns null for column_default_changed', () => {
      const operation: Operation = {
        kind: 'column_default_changed',
        tableName: 'users',
        columnName: 'created_at',
        fromDefault: null,
        toDefault: 'now()',
      };

      expect(checkOperationSafety(operation)).toBeNull();
    });

    it('returns null for column_unique_changed', () => {
      const operation: Operation = {
        kind: 'column_unique_changed',
        tableName: 'users',
        columnName: 'email',
        from: false,
        to: true,
      };

      expect(checkOperationSafety(operation)).toBeNull();
    });

    it('returns null for add_primary_key_constraint', () => {
      const operation: Operation = {
        kind: 'add_primary_key_constraint',
        tableName: 'users',
        columnName: 'id',
      };

      expect(checkOperationSafety(operation)).toBeNull();
    });
  });
});

describe('checkSchemaSafety', () => {
  it('returns empty findings for identical schemas', () => {
    const previous: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
            email: { type: 'text', unique: true },
          },
          primaryKey: 'id',
        },
      },
    };

    const current = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'text', unique: true },
          ],
          primaryKey: 'id',
        },
      },
    };

    const report = checkSchemaSafety(previous, current as any);

    expect(report.findings).toHaveLength(0);
    expect(report.hasWarnings).toBe(false);
    expect(report.hasDestructiveOps).toBe(false);
  });

  it('detects multiple destructive operations', () => {
    const previous: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
            email: { type: 'text' },
            old_column: { type: 'text' },
          },
          primaryKey: 'id',
        },
      },
    };

    const current = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'text' },
          ],
          primaryKey: 'id',
        },
      },
    };

    const report = checkSchemaSafety(previous, current as any);

    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.hasDestructiveOps).toBe(true);
    expect(report.findings.some(f => f.code === 'DROP_COLUMN')).toBe(true);
  });

  it('aggregates warnings and destructive operations', () => {
    const previous: StateFile = {
      version: 1,
      tables: {
        products: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
            quantity: { type: 'int' },
            nullable_field: { type: 'text', nullable: true },
          },
          primaryKey: 'id',
        },
      },
    };

    const current = {
      tables: {
        products: {
          name: 'products',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'quantity', type: 'bigint' }, // WARNING: widening
            { name: 'nullable_field', type: 'text', nullable: false }, // WARNING: not null
          ],
          primaryKey: 'id',
        },
      },
    };

    const report = checkSchemaSafety(previous, current as any);

    expect(report.hasWarnings).toBe(true);
    expect(report.hasDestructiveOps).toBe(false);
    expect(report.findings.every(f => f.safetyLevel === 'WARNING')).toBe(true);
  });

  it('returns structured SafetyReport', () => {
    const previous: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
          },
          primaryKey: 'id',
        },
      },
    };

    const current = {
      tables: {
        // users table removed
      },
    };

    const report = checkSchemaSafety(previous, current as any);

    expect(report).toHaveProperty('findings');
    expect(report).toHaveProperty('hasSafeIssues');
    expect(report).toHaveProperty('hasWarnings');
    expect(report).toHaveProperty('hasDestructiveOps');
    expect(Array.isArray(report.findings)).toBe(true);
    expect(typeof report.hasSafeIssues).toBe('boolean');
    expect(typeof report.hasWarnings).toBe('boolean');
    expect(typeof report.hasDestructiveOps).toBe('boolean');
  });

  it('includes operationKind in findings', () => {
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

    const current = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
          ],
          primaryKey: 'id',
        },
      },
    };

    const report = checkSchemaSafety(previous, current as any);

    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.every(f => f.operationKind)).toBe(true);
    expect(report.findings[0].operationKind).toBe('drop_column');
  });
});
