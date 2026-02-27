import { describe, expect, it } from 'vitest';
import { parseSchema } from '../src/core/parser';
import { validateSchemaChanges } from '../src/core/validate';
import type { DatabaseSchema, StateFile } from '../src/types/schema';

describe('validateSchemaChanges', () => {
  it('reports DROP_TABLE as error when table is removed', () => {
    const previousState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
          },
        },
      },
    };

    const currentSchema: DatabaseSchema = { tables: {} };

    expect(validateSchemaChanges(previousState, currentSchema)).toContainEqual({
      severity: 'error',
      code: 'DROP_TABLE',
      table: 'users',
      message: 'Table removed',
    });
  });

  it('reports DROP_COLUMN as error when column is removed', () => {
    const previousState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            id: { type: 'uuid', primaryKey: true },
            avatar_url: { type: 'text' },
          },
        },
      },
    };

    const currentSchema = parseSchema(`
      table users {
        id uuid pk
      }
    `);

    expect(validateSchemaChanges(previousState, currentSchema)).toContainEqual({
      severity: 'error',
      code: 'DROP_COLUMN',
      table: 'users',
      column: 'avatar_url',
      message: 'Column removed',
    });
  });

  it('classifies int to bigint as warning', () => {
    const previousState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            age: { type: 'int' },
          },
        },
      },
    };

    const currentSchema = parseSchema(`
      table users {
        age bigint
      }
    `);

    expect(validateSchemaChanges(previousState, currentSchema)).toContainEqual({
      severity: 'warning',
      code: 'ALTER_COLUMN_TYPE',
      table: 'users',
      column: 'age',
      from: 'int',
      to: 'bigint',
      message: 'Type widened from int to bigint',
    });
  });

  it('classifies text to varchar as error', () => {
    const previousState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            bio: { type: 'text' },
          },
        },
      },
    };

    const currentSchema = parseSchema(`
      table users {
        bio varchar(255)
      }
    `);

    expect(validateSchemaChanges(previousState, currentSchema)).toContainEqual({
      severity: 'error',
      code: 'ALTER_COLUMN_TYPE',
      table: 'users',
      column: 'bio',
      from: 'text',
      to: 'varchar(255)',
      message: 'Type changed from text to varchar(255) (may truncate existing values)',
    });
  });

  it('reports SET_NOT_NULL as warning for nullable to not null', () => {
    const previousState: StateFile = {
      version: 1,
      tables: {
        users: {
          columns: {
            email: { type: 'text', nullable: true },
          },
        },
      },
    };

    const currentSchema = parseSchema(`
      table users {
        email text not null
      }
    `);

    expect(validateSchemaChanges(previousState, currentSchema)).toContainEqual({
      severity: 'warning',
      code: 'SET_NOT_NULL',
      table: 'users',
      column: 'email',
      message: 'Column changed to NOT NULL (may fail if data contains NULLs)',
    });
  });
});
