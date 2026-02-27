import { describe, it, expect } from 'vitest';
import { parseSchema } from '../src/parser/parser';

describe('parseSchema', () => {
  it('parses a simple table with columns', () => {
    const schema = `
      table users {
        id uuid pk
        email varchar unique
      }
    `;

    const ast = parseSchema(schema);

    expect(Object.keys(ast.tables)).toEqual(['users']);
    const table = ast.tables.users;
    expect(table.columns).toHaveLength(2);
    expect(table.columns[0]).toMatchObject({ name: 'id', type: 'uuid', primaryKey: true });
    expect(table.columns[1]).toMatchObject({ name: 'email', type: 'varchar', unique: true });
  });
});
