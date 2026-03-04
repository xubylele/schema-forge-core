import { describe, expect, it } from 'vitest';
import { analyzeSchemaDrift } from '../src/core/drift-analyzer';
import type { DatabaseSchema, StateFile } from '../src/types/schema';

describe('analyzeSchemaDrift', () => {
  it('detects missing and extra tables', () => {
    const state: StateFile = {
      version: 1,
      tables: {
        profiles: { columns: { id: { type: 'uuid' } } },
        users: { columns: { id: { type: 'uuid' } } },
      },
    };

    const liveSchema: DatabaseSchema = {
      tables: {
        users: { name: 'users', columns: [{ name: 'id', type: 'uuid' }] },
        sessions: { name: 'sessions', columns: [{ name: 'id', type: 'uuid' }] },
      },
    };

    const report = analyzeSchemaDrift(state, liveSchema);

    expect(report.missingTables).toEqual(['profiles']);
    expect(report.extraTables).toEqual(['sessions']);
    expect(report.columnDifferences).toEqual([]);
    expect(report.typeMismatches).toEqual([]);
  });

  it('detects column differences in common tables', () => {
    const state: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid' },
            email: { type: 'varchar(255)' },
            nickname: { type: 'text' },
          },
        },
      },
    };

    const liveSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'email', type: 'varchar(255)' },
            { name: 'last_login', type: 'timestamptz' },
          ],
        },
      },
    };

    const report = analyzeSchemaDrift(state, liveSchema);

    expect(report.columnDifferences).toEqual([
      {
        tableName: 'users',
        missingInLive: ['nickname'],
        extraInLive: ['last_login'],
      },
    ]);
    expect(report.typeMismatches).toEqual([]);
  });

  it('detects type mismatches for common columns', () => {
    const state: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            age: { type: 'int' },
            email: { type: 'varchar(255)' },
          },
        },
      },
    };

    const liveSchema: DatabaseSchema = {
      tables: {
        users: {
          name: 'users',
          columns: [
            { name: 'age', type: 'bigint' },
            { name: 'email', type: 'VARCHAR(255)' as any },
          ],
        },
      },
    };

    const report = analyzeSchemaDrift(state, liveSchema);

    expect(report.typeMismatches).toEqual([
      {
        tableName: 'users',
        columnName: 'age',
        expectedType: 'int',
        actualType: 'bigint',
      },
    ]);
  });

  it('returns deterministic report ordering in mixed drift scenarios', () => {
    const stateA: StateFile = {
      version: 1,
      tables: {
        zeta: { columns: { id: { type: 'uuid' } } },
        alpha: {
          columns: {
            id: { type: 'uuid' },
            nickname: { type: 'text' },
            score: { type: 'int' },
          },
        },
      },
    };

    const liveA: DatabaseSchema = {
      tables: {
        alpha: {
          name: 'alpha',
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'score', type: 'bigint' },
            { name: 'created_at', type: 'timestamptz' },
          ],
        },
        beta: { name: 'beta', columns: [{ name: 'id', type: 'uuid' }] },
      },
    };

    const stateB: StateFile = {
      version: 1,
      tables: {
        alpha: {
          columns: {
            score: { type: 'int' },
            nickname: { type: 'text' },
            id: { type: 'uuid' },
          },
        },
        zeta: { columns: { id: { type: 'uuid' } } },
      },
    };

    const liveB: DatabaseSchema = {
      tables: {
        beta: { name: 'beta', columns: [{ name: 'id', type: 'uuid' }] },
        alpha: {
          name: 'alpha',
          columns: [
            { name: 'created_at', type: 'timestamptz' },
            { name: 'id', type: 'uuid' },
            { name: 'score', type: 'bigint' },
          ],
        },
      },
    };

    const first = analyzeSchemaDrift(stateA, liveA);
    const second = analyzeSchemaDrift(stateB, liveB);

    expect(first).toEqual(second);
    expect(first).toEqual({
      missingTables: ['zeta'],
      extraTables: ['beta'],
      columnDifferences: [
        {
          tableName: 'alpha',
          missingInLive: ['nickname'],
          extraInLive: ['created_at'],
        },
      ],
      typeMismatches: [
        {
          tableName: 'alpha',
          columnName: 'score',
          expectedType: 'int',
          actualType: 'bigint',
        },
      ],
    });
  });
});
