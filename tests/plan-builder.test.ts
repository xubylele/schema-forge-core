import { describe, expect, it } from 'vitest';
import { diffSchemas } from '../src/core/diff';
import { buildMigrationPlan, formatMigrationPlanLines } from '../src/core/plan-builder';
import type { DiffResult, DatabaseSchema, StateFile } from '../src/types/schema';

describe('plan builder', () => {
  it('should map operation kinds to +, ~ and - symbols', () => {
    const diff: DiffResult = {
      operations: [
        {
          kind: 'create_table',
          table: {
            name: 'posts',
            columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
          },
        },
        {
          kind: 'column_type_changed',
          tableName: 'users',
          columnName: 'email',
          fromType: 'varchar',
          toType: 'text',
        },
        {
          kind: 'drop_column',
          tableName: 'users',
          columnName: 'age',
        },
      ],
    };

    const result = buildMigrationPlan(diff);

    expect(result.entries.map(entry => entry.symbol)).toEqual(['+', '~', '-']);
    expect(result.lines).toEqual([
      '+ create table posts',
      '~ modify column email type on users (varchar -> text)',
      '- drop column age from users',
    ]);
  });

  it('should include metadata for detailed modify operations', () => {
    const diff: DiffResult = {
      operations: [
        {
          kind: 'column_default_changed',
          tableName: 'users',
          columnName: 'status',
          fromDefault: null,
          toDefault: "'active'",
        },
      ],
    };

    const result = buildMigrationPlan(diff);
    const [entry] = result.entries;

    expect(entry.action).toBe('modify');
    expect(entry.tableName).toBe('users');
    expect(entry.columnName).toBe('status');
    expect(entry.from).toBeNull();
    expect(entry.to).toBe("'active'");
    expect(entry.summary).toContain('modify column status default on users');
  });

  it('should keep operation order from diff results', () => {
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

    const diff = diffSchemas(oldState, newSchema);
    const result = buildMigrationPlan(diff);

    expect(result.lines).toEqual([
      '+ create table gamma',
      '+ add column new_col to beta',
      '- drop column old_col from beta',
      '- drop table alpha',
    ]);
  });

  it('should format lines from entries consistently', () => {
    const diff: DiffResult = {
      operations: [
        {
          kind: 'create_view',
          view: {
            name: 'active_users',
            query: 'select 1',
            hash: 'hash1',
          },
        },
        {
          kind: 'replace_view',
          view: {
            name: 'active_users',
            query: 'select 2',
            hash: 'hash2',
          },
        },
        {
          kind: 'drop_view',
          viewName: 'legacy_users',
        },
      ],
    };

    const result = buildMigrationPlan(diff);

    expect(formatMigrationPlanLines(result.entries)).toEqual(result.lines);
    expect(result.lines).toEqual([
      '+ create view active_users',
      '~ replace view active_users',
      '- drop view legacy_users',
    ]);
  });
});
