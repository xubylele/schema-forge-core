import { describe, it, expect } from 'vitest';
import { createSnapshot } from '../src/state/snapshot';
import { diffSchemas } from '../src/diff/diff';
import { parseSchema } from '../src/parser/parser';
import { StateFile } from '../src/types/schema';

describe('diffSchemas', () => {
  it('creates a table when snapshot is empty', () => {
    const schema = `
      table users {
        id uuid pk
      }
    `;

    const ast = parseSchema(schema);
    const emptySnapshot: StateFile = { version: 1, tables: {} };

    const diff = diffSchemas(emptySnapshot, ast);

    expect(diff.operations).toHaveLength(1);
    expect(diff.operations[0].kind).toBe('create_table');
    expect(diff.operations[0]).toMatchObject({ table: { name: 'users' } });
  });

  it('adds a column when snapshot is missing it', () => {
    const initialSchema = `
      table users {
        id uuid pk
      }
    `;

    const nextSchema = `
      table users {
        id uuid pk
        email varchar unique
      }
    `;

    const initialAst = parseSchema(initialSchema);
    const nextAst = parseSchema(nextSchema);
    const snapshot = createSnapshot(initialAst);

    const diff = diffSchemas(snapshot, nextAst);

    expect(diff.operations).toHaveLength(1);
    expect(diff.operations[0]).toMatchObject({
      kind: 'add_column',
      tableName: 'users',
      column: { name: 'email', type: 'varchar', unique: true },
    });
  });
});
