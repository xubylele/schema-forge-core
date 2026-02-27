import { describe, expect, it } from 'vitest';
import { diffSchemas } from '../src/core/diff';
import type { DatabaseSchema, StateFile } from '../src/types/schema';

describe('default value change detection', () => {
  it('detects default added (null -> now())', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            created_at: { type: 'timestamptz' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'created_at', type: 'timestamptz', default: 'now()' }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_default_changed',
        tableName: 'users',
        columnName: 'created_at',
        fromDefault: null,
        toDefault: 'now()',
      },
    ]);
  });

  it('detects default removed (now() -> null)', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            created_at: { type: 'timestamptz', default: 'now()' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'created_at', type: 'timestamptz' }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_default_changed',
        tableName: 'users',
        columnName: 'created_at',
        fromDefault: 'now()',
        toDefault: null,
      },
    ]);
  });

  it('detects default modified (now() -> timezone(\'utc\', now()))', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            created_at: { type: 'timestamptz', default: 'now()' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            {
              name: 'created_at',
              type: 'timestamptz',
              default: "timezone('utc', now())",
            },
          ],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_default_changed',
        tableName: 'users',
        columnName: 'created_at',
        fromDefault: 'now()',
        toDefault: "timezone('utc', now())",
      },
    ]);
  });

  it('does not detect changes for equivalent case (NOW() -> now())', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            created_at: { type: 'timestamptz', default: 'NOW()' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [{ name: 'created_at', type: 'timestamptz', default: 'now()' }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([]);
  });

  it('does not detect changes for whitespace-only differences', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            created_at: {
              type: 'timestamptz',
              default: "timezone(  'utc'  ,    now()   )",
            },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            {
              name: 'created_at',
              type: 'timestamptz',
              default: "timezone('utc', now())",
            },
          ],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([]);
  });

  it('detects multiple default changes across tables deterministically', () => {
    const oldState: StateFile = {
      version: 1,
      tables: {
        audit_logs: {
          columns: {
            created_at: { type: 'timestamptz', default: 'now()' },
          },
        },
        users: {
          columns: {
            active: { type: 'boolean' },
          },
        },
      },
    };

    const newSchema: DatabaseSchema = {
      tables: {
        audit_logs: {
          name: 'audit_logs',
          columns: [{ name: 'created_at', type: 'timestamptz' }],
        },
        users: {
          name: 'users',
          columns: [{ name: 'active', type: 'boolean', default: 'false' }],
        },
      },
    };

    const result = diffSchemas(oldState, newSchema);

    expect(result.operations).toEqual([
      {
        kind: 'column_default_changed',
        tableName: 'audit_logs',
        columnName: 'created_at',
        fromDefault: 'now()',
        toDefault: null,
      },
      {
        kind: 'column_default_changed',
        tableName: 'users',
        columnName: 'active',
        fromDefault: null,
        toDefault: 'false',
      },
    ]);
  });
});
