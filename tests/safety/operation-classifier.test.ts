import { describe, it, expect } from 'vitest';
import { classifyOperation } from '../../src/core/safety/operation-classifier.js';
import type { Operation } from '../../src/types/schema.js';

describe('classifyOperation', () => {
  describe('SAFE operations', () => {
    it('classifies create_table as SAFE', () => {
      const operation: Operation = {
        kind: 'create_table',
        table: {
          name: 'new_table',
          columns: [],
        },
      };

      expect(classifyOperation(operation)).toBe('SAFE');
    });

    it('classifies add_column as SAFE', () => {
      const operation: Operation = {
        kind: 'add_column',
        tableName: 'users',
        column: {
          name: 'email',
          type: 'text',
        },
      };

      expect(classifyOperation(operation)).toBe('SAFE');
    });

    it('classifies column_default_changed as SAFE', () => {
      const operation: Operation = {
        kind: 'column_default_changed',
        tableName: 'users',
        columnName: 'created_at',
        fromDefault: null,
        toDefault: 'now()',
      };

      expect(classifyOperation(operation)).toBe('SAFE');
    });

    it('classifies column_unique_changed as SAFE', () => {
      const operation: Operation = {
        kind: 'column_unique_changed',
        tableName: 'users',
        columnName: 'email',
        from: false,
        to: true,
      };

      expect(classifyOperation(operation)).toBe('SAFE');
    });

    it('classifies add_primary_key_constraint as SAFE', () => {
      const operation: Operation = {
        kind: 'add_primary_key_constraint',
        tableName: 'users',
        columnName: 'id',
      };

      expect(classifyOperation(operation)).toBe('SAFE');
    });

    it('classifies create_policy as SAFE', () => {
      const operation: Operation = {
        kind: 'create_policy',
        tableName: 'users',
        policy: {
          name: 'users_self_read',
          table: 'users',
          command: 'select',
          using: 'auth.uid() = id',
        },
      };

      expect(classifyOperation(operation)).toBe('SAFE');
    });

    it('classifies create_index as SAFE', () => {
      const operation: Operation = {
        kind: 'create_index',
        tableName: 'users',
        index: {
          name: 'idx_users_email',
          table: 'users',
          columns: ['email'],
          unique: false,
        },
      };

      expect(classifyOperation(operation)).toBe('SAFE');
    });

    it('classifies column_nullability_changed (not null to nullable) as SAFE', () => {
      const operation: Operation = {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'email',
        from: false,
        to: true,
      };

      expect(classifyOperation(operation)).toBe('SAFE');
    });
  });

  describe('DESTRUCTIVE operations', () => {
    it('classifies drop_table as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'drop_table',
        tableName: 'users',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });

    it('classifies drop_column as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'drop_column',
        tableName: 'users',
        columnName: 'email',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });

    it('classifies drop_primary_key_constraint as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'drop_primary_key_constraint',
        tableName: 'users',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });

    it('classifies drop_policy as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'drop_policy',
        tableName: 'users',
        policyName: 'users_self_read',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });

    it('classifies UUID type change as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'id',
        fromType: 'uuid',
        toType: 'text',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });

    it('classifies int narrowing to zero as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'products',
        columnName: 'quantity',
        fromType: 'bigint',
        toType: 'int',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });

    it('classifies text to varchar truncation as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'posts',
        columnName: 'content',
        fromType: 'text',
        toType: 'varchar(50)',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });

    it('classifies varchar narrowing as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'username',
        fromType: 'varchar(255)',
        toType: 'varchar(50)',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });

    it('classifies numeric narrowing with same scale as DESTRUCTIVE', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'products',
        columnName: 'price',
        fromType: 'numeric(10,2)',
        toType: 'numeric(5,2)',
      };

      expect(classifyOperation(operation)).toBe('DESTRUCTIVE');
    });
  });

  describe('WARNING operations', () => {
    it('classifies drop_index as WARNING', () => {
      const operation: Operation = {
        kind: 'drop_index',
        tableName: 'users',
        index: {
          name: 'idx_users_email',
          table: 'users',
          columns: ['email'],
          unique: false,
        },
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('classifies column_nullability_changed (nullable to not null) as WARNING', () => {
      const operation: Operation = {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'email',
        from: true,
        to: false,
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('classifies int to bigint widening as WARNING', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'products',
        columnName: 'quantity',
        fromType: 'int',
        toType: 'bigint',
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('classifies varchar to text as WARNING', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'posts',
        columnName: 'content',
        fromType: 'varchar(255)',
        toType: 'text',
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('classifies varchar widening as WARNING', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'username',
        fromType: 'varchar(50)',
        toType: 'varchar(255)',
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('classifies numeric widening with same scale as WARNING', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'products',
        columnName: 'price',
        fromType: 'numeric(5,2)',
        toType: 'numeric(10,2)',
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('classifies unknown type change as WARNING', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'data',
        columnName: 'value',
        fromType: 'text',
        toType: 'int',
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('classifies modify_policy as WARNING', () => {
      const operation: Operation = {
        kind: 'modify_policy',
        tableName: 'users',
        policyName: 'users_self_read',
        policy: {
          name: 'users_self_read',
          table: 'users',
          command: 'select',
          using: 'auth.uid() = id and true',
        },
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });
  });

  describe('Type change edge cases', () => {
    it('handles whitespace and case normalization', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'username',
        fromType: 'VARCHAR(50)',
        toType: 'varchar(255)',
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('handles varchar with extra spaces', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'username',
        fromType: 'VARCHAR ( 50 )',
        toType: 'varchar( 255 )',
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });

    it('handles numeric type with extra spaces', () => {
      const operation: Operation = {
        kind: 'column_type_changed',
        tableName: 'products',
        columnName: 'price',
        fromType: 'NUMERIC ( 5 , 2 )',
        toType: 'numeric(10,2)',
      };

      expect(classifyOperation(operation)).toBe('WARNING');
    });
  });
});
