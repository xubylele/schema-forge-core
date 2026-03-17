import { describe, expect, it } from 'vitest';
import { diffSchemas } from '../src/core/diff';
import type { DatabaseSchema, StateFile } from '../src/types/schema';

describe('diffSchemas', () => {
  it('should generate ordered create/add/drop operations', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        alpha: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
            legacy: { type: 'text' },
          },
        },
        beta: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
            old_col: { type: 'text' },
            keep_col: { type: 'text' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        beta: {
          name: 'beta',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'keep_col', type: 'text' },
            { name: 'new_col', type: 'int' },
          ],
        },
        gamma: {
          name: 'gamma',
          columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toHaveLength(4);
    expect(result.operations[0]).toEqual({
      kind: 'create_table',
      table: newSchema.tables.gamma,
    });
    expect(result.operations[1]).toEqual({
      kind: 'add_column',
      tableName: 'beta',
      column: newSchema.tables.beta.columns[2],
    });
    expect(result.operations[2]).toEqual({
      kind: 'drop_column',
      tableName: 'beta',
      columnName: 'old_col',
    });
    expect(result.operations[3]).toEqual({
      kind: 'drop_table',
      tableName: 'alpha',
    });
  });

  it('should create table when old state is empty and new schema has users', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {},
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'varchar', unique: true },
            { name: 'name', type: 'text' },
          ],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toEqual({
      kind: 'create_table',
      table: newSchema.tables.users,
    });
  });

  it('should add column when users table exists without avatar but schema has it', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
            email: { type: 'varchar' },
            name: { type: 'text' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'varchar' },
            { name: 'name', type: 'text' },
            { name: 'avatar', type: 'varchar', nullable: true },
          ],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toEqual({
      kind: 'add_column',
      tableName: 'users',
      column: { name: 'avatar', type: 'varchar', nullable: true },
    });
  });

  it('should detect varchar to text type change', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'varchar' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'email', type: 'text' }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'email',
        fromType: 'varchar',
        toType: 'text',
      },
    ]);
  });

  it('should detect int to bigint type change', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            age: { type: 'int' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'age', type: 'bigint' }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'age',
        fromType: 'int',
        toType: 'bigint',
      },
    ]);
  });

  it('should detect numeric precision/scale changes', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        invoices: {
          columns: {
            total: { type: 'numeric(10,2)' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        invoices: {
          name: 'invoices',
          columns: [{ name: 'total', type: 'numeric(12,2)' }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_type_changed',
        tableName: 'invoices',
        columnName: 'total',
        fromType: 'numeric(10,2)',
        toType: 'numeric(12,2)',
      },
    ]);
  });

  it('should not emit type change when only casing differs', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'varchar' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'email', type: 'VARCHAR' as any }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([]);
  });

  it('should detect multiple type changes in same table', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'varchar' },
            age: { type: 'int' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'email', type: 'text' },
            { name: 'age', type: 'bigint' },
          ],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'email',
        fromType: 'varchar',
        toType: 'text',
      },
      {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'age',
        fromType: 'int',
        toType: 'bigint',
      },
    ]);
  });

  it('should emit type changes before add_column in same table', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'varchar' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'email', type: 'text' },
            { name: 'nickname', type: 'varchar' },
          ],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'email',
        fromType: 'varchar',
        toType: 'text',
      },
      {
        kind: 'add_column',
        tableName: 'users',
        column: { name: 'nickname', type: 'varchar' },
      },
    ]);
  });

  it('should detect unique false to true on existing column', () => {
    const oldState: StateFile = {
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

    const newSchema: DatabaseSchema = {
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

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_unique_changed',
        tableName: 'users',
        columnName: 'email',
        from: false,
        to: true,
      },
    ]);
  });

  it('should detect unique true to false on existing column', () => {
    const oldState: StateFile = {
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

    const newSchema: DatabaseSchema = {
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

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_unique_changed',
        tableName: 'users',
        columnName: 'email',
        from: true,
        to: false,
      },
    ]);
  });

  it('should not emit unique operation when unique flag does not change', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'text', unique: true },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'email', type: 'text', unique: true }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([]);
  });

  it('should detect nullable to not null change', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'text', nullable: true },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'email', type: 'text', nullable: false }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'email',
        from: true,
        to: false,
      },
    ]);
  });

  it('should detect not null to nullable change', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'text', nullable: false },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'email', type: 'text', nullable: true }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'email',
        from: false,
        to: true,
      },
    ]);
  });

  it('should not emit nullability change when nullability is unchanged', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'text', nullable: true },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'email', type: 'text', nullable: true }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([]);
  });

  it('should detect multiple nullability changes in same table', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'text', nullable: true },
            nickname: { type: 'varchar', nullable: false },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'email', type: 'text', nullable: false },
            { name: 'nickname', type: 'varchar', nullable: true },
          ],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'email',
        from: true,
        to: false,
      },
      {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'nickname',
        from: false,
        to: true,
      },
    ]);
  });

  it('should emit type change before nullability change for same column', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'varchar', nullable: true },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'email', type: 'text', nullable: false }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'column_type_changed',
        tableName: 'users',
        columnName: 'email',
        fromType: 'varchar',
        toType: 'text',
      },
      {
        kind: 'column_nullability_changed',
        tableName: 'users',
        columnName: 'email',
        from: true,
        to: false,
      },
    ]);
  });

  it('should detect primary key added', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
          primaryKey: 'id',
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'add_primary_key_constraint',
        tableName: 'users',
        columnName: 'id',
      },
    ]);
  });

  it('should detect primary key removed', () => {
    const oldState: StateFile = {
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

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'id', type: 'uuid' }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'drop_primary_key_constraint',
        tableName: 'users',
      },
    ]);
  });

  it('should detect primary key changed and order drop before add', () => {
    const oldState: StateFile = {
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

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'user_id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'text' },
          ],
          primaryKey: 'user_id',
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);
    expect(result.operations).toEqual([
      {
        kind: 'drop_primary_key_constraint',
        tableName: 'users',
      },
      {
        kind: 'add_column',
        tableName: 'users',
        column: { name: 'user_id', type: 'uuid', primaryKey: true },
      },
      {
        kind: 'add_primary_key_constraint',
        tableName: 'users',
        columnName: 'user_id',
      },
      {
        kind: 'drop_column',
        tableName: 'users',
        columnName: 'id',
      },
    ]);
  });

  it('should produce deterministic diff operation ordering', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
            email: { type: 'varchar' },
          },
          primaryKey: 'id',
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'email', type: 'text', unique: true },
            { name: 'user_id', type: 'uuid', primaryKey: true },
          ],
          primaryKey: 'user_id',
        },
      },
    };

    const firstRun = diffSchemas(oldState, newSchema);
    const secondRun = diffSchemas(oldState, newSchema);

    expect(firstRun.operations).toEqual(secondRun.operations);
  });

  describe('policy diff', () => {
    it('should detect new policy when state has no policies and schema has one', () => {
      const oldState: StateFile = {
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

      const newSchema: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            columns: [
              { name: 'id', type: 'uuid', primaryKey: true },
              { name: 'email', type: 'text' },
            ],
            primaryKey: 'id',
            policies: [
              {
                name: 'users_self_read',
                table: 'users',
                command: 'select',
                using: 'auth.uid() = id',
              },
            ],
          },
        },
      };

      const result = diffSchemas(oldState, newSchema);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toEqual({
        kind: 'create_policy',
        tableName: 'users',
        policy: {
          name: 'users_self_read',
          table: 'users',
          command: 'select',
          using: 'auth.uid() = id',
        },
      });
    });

    it('should detect removed policy when state has policy and schema does not', () => {
      const oldState: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
            },
            primaryKey: 'id',
            policies: {
              users_self_read: { command: 'select', using: 'auth.uid() = id' },
            },
          },
        },
      };

      const newSchema: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
            primaryKey: 'id',
          },
        },
      };

      const result = diffSchemas(oldState, newSchema);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toEqual({
        kind: 'drop_policy',
        tableName: 'users',
        policyName: 'users_self_read',
      });
    });

    it('should detect modified policy when command or expression changes', () => {
      const oldState: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: {
              id: { type: 'uuid', primaryKey: true },
            },
            primaryKey: 'id',
            policies: {
              users_self_read: { command: 'select', using: 'auth.uid() = id' },
            },
          },
        },
      };

      const newSchema: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
            primaryKey: 'id',
            policies: [
              {
                name: 'users_self_read',
                table: 'users',
                command: 'select',
                using: 'auth.uid() = id and true',
              },
            ],
          },
        },
      };

      const result = diffSchemas(oldState, newSchema);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({
        kind: 'modify_policy',
        tableName: 'users',
        policyName: 'users_self_read',
        policy: {
          name: 'users_self_read',
          table: 'users',
          command: 'select',
          using: 'auth.uid() = id and true',
        },
      });
    });

    it('should detect modified policy when to roles change', () => {
      const oldState: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: { id: { type: 'uuid', primaryKey: true } },
            primaryKey: 'id',
            policies: {
              users_self_read: { command: 'select', using: 'auth.uid() = id' },
            },
          },
        },
      };

      const newSchema: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
            primaryKey: 'id',
            policies: [
              {
                name: 'users_self_read',
                table: 'users',
                command: 'select',
                using: 'auth.uid() = id',
                to: ['authenticated'],
              },
            ],
          },
        },
      };

      const result = diffSchemas(oldState, newSchema);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({
        kind: 'modify_policy',
        tableName: 'users',
        policyName: 'users_self_read',
        policy: { to: ['authenticated'] },
      });
    });

    it('should not emit policy op when policies are unchanged', () => {
      const oldState: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: { id: { type: 'uuid', primaryKey: true } },
            primaryKey: 'id',
            policies: {
              users_self_read: { command: 'select', using: 'auth.uid() = id' },
            },
          },
        },
      };

      const newSchema: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
            primaryKey: 'id',
            policies: [
              {
                name: 'users_self_read',
                table: 'users',
                command: 'select',
                using: 'auth.uid() = id',
              },
            ],
          },
        },
      };

      const result = diffSchemas(oldState, newSchema);
      const policyOps = result.operations.filter(
        op => op.kind === 'create_policy' || op.kind === 'drop_policy' || op.kind === 'modify_policy'
      );
      expect(policyOps).toHaveLength(0);
    });

    it('should emit policy operations in deterministic order', () => {
      const oldState: StateFile = {
        version: 1,
        tables: {
          users: {
            columns: { id: { type: 'uuid', primaryKey: true } },
            primaryKey: 'id',
            policies: {
              alpha: { command: 'select' },
              zeta: { command: 'update', using: 'true' },
            },
          },
        },
      };

      const newSchema: DatabaseSchema = {
        tables: {
          users: {
            name: 'users',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
            primaryKey: 'id',
            policies: [
              { name: 'beta', table: 'users', command: 'insert' },
              { name: 'zeta', table: 'users', command: 'update', using: 'false' },
            ],
          },
        },
      };

      const first = diffSchemas(oldState, newSchema);
      const second = diffSchemas(oldState, newSchema);
      const policyOps = (r: typeof first) =>
        r.operations.filter(
          op =>
            op.kind === 'create_policy' || op.kind === 'drop_policy' || op.kind === 'modify_policy'
        );
      expect(policyOps(first)).toEqual(policyOps(second));
    });
  });
});
