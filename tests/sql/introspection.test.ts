import { describe, expect, it } from 'vitest';
import { introspectPostgresSchema } from '../../src/core/sql/introspect-postgres';
import type {
  PostgresIntrospectionColumnRow,
  PostgresIntrospectionConstraintRow,
  PostgresIntrospectionForeignKeyRow,
  PostgresIntrospectionTableRow,
  PostgresQueryExecutor,
} from '../../src/types/sql';

interface MockRows {
  tables: PostgresIntrospectionTableRow[];
  columns: PostgresIntrospectionColumnRow[];
  constraints: PostgresIntrospectionConstraintRow[];
  foreignKeys: PostgresIntrospectionForeignKeyRow[];
}

function createMockQuery(rows: MockRows, capturedParams?: unknown[][]): PostgresQueryExecutor {
  return async <TRow extends object>(sql: string, params?: readonly unknown[]): Promise<TRow[]> => {
    if (capturedParams && params) {
      capturedParams.push([...params]);
    }

    if (sql.includes('information_schema.tables')) {
      return rows.tables as TRow[];
    }
    if (sql.includes('information_schema.columns')) {
      return rows.columns as TRow[];
    }
    if (sql.includes('information_schema.table_constraints')) {
      return rows.constraints as TRow[];
    }
    if (sql.includes('FROM pg_constraint')) {
      return rows.foreignKeys as TRow[];
    }
    return [] as TRow[];
  };
}

describe('introspectPostgresSchema', () => {
  it('maps tables, columns and representable constraints from metadata', async () => {
    const paramsLog: unknown[][] = [];
    const query = createMockQuery({
      tables: [
        { table_schema: 'audit', table_name: 'events' },
        { table_schema: 'public', table_name: 'users' },
      ],
      columns: [
        {
          table_schema: 'public',
          table_name: 'users',
          column_name: 'role',
          ordinal_position: 3,
          is_nullable: 'YES',
          data_type: 'text',
          udt_name: 'text',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          column_default: `'member'::text`,
        },
        {
          table_schema: 'public',
          table_name: 'users',
          column_name: 'id',
          ordinal_position: 1,
          is_nullable: 'NO',
          data_type: 'uuid',
          udt_name: 'uuid',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          column_default: 'gen_random_uuid()',
        },
        {
          table_schema: 'public',
          table_name: 'users',
          column_name: 'email',
          ordinal_position: 2,
          is_nullable: 'NO',
          data_type: 'character varying',
          udt_name: 'varchar',
          character_maximum_length: 255,
          numeric_precision: null,
          numeric_scale: null,
          column_default: null,
        },
        {
          table_schema: 'public',
          table_name: 'users',
          column_name: 'manager_id',
          ordinal_position: 4,
          is_nullable: 'YES',
          data_type: 'uuid',
          udt_name: 'uuid',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          column_default: null,
        },
        {
          table_schema: 'audit',
          table_name: 'events',
          column_name: 'id',
          ordinal_position: 1,
          is_nullable: 'NO',
          data_type: 'bigint',
          udt_name: 'int8',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          column_default: null,
        },
      ],
      constraints: [
        {
          table_schema: 'public',
          table_name: 'users',
          constraint_name: 'users_pkey',
          constraint_type: 'PRIMARY KEY',
          column_name: 'id',
          ordinal_position: 1,
          check_clause: null,
        },
        {
          table_schema: 'public',
          table_name: 'users',
          constraint_name: 'users_email_key',
          constraint_type: 'UNIQUE',
          column_name: 'email',
          ordinal_position: 1,
          check_clause: null,
        },
        {
          table_schema: 'public',
          table_name: 'users',
          constraint_name: 'users_role_check',
          constraint_type: 'CHECK',
          column_name: null,
          ordinal_position: null,
          check_clause: "(role = ANY (ARRAY['member'::text, 'admin'::text]))",
        },
        {
          table_schema: 'audit',
          table_name: 'events',
          constraint_name: 'events_pkey',
          constraint_type: 'PRIMARY KEY',
          column_name: 'id',
          ordinal_position: 1,
          check_clause: null,
        },
      ],
      foreignKeys: [
        {
          table_schema: 'public',
          table_name: 'users',
          constraint_name: 'users_manager_id_fkey',
          local_column_name: 'manager_id',
          referenced_table_schema: 'public',
          referenced_table_name: 'users',
          referenced_column_name: 'id',
          position: 1,
        },
      ],
    }, paramsLog);

    const schema = await introspectPostgresSchema({
      query,
      schemas: [' public ', 'audit', 'public'],
    });

    expect(Object.keys(schema.tables)).toEqual(['audit.events', 'users']);
    expect(schema.tables['audit.events']).toEqual({
      name: 'audit.events',
      primaryKey: 'id',
      columns: [
        {
          name: 'id',
          type: 'bigint',
          nullable: false,
          primaryKey: true,
        },
      ],
    });
    expect(schema.tables.users).toEqual({
      name: 'users',
      primaryKey: 'id',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          nullable: false,
          default: 'gen_random_uuid()',
          primaryKey: true,
        },
        {
          name: 'email',
          type: 'varchar(255)',
          nullable: false,
          unique: true,
        },
        {
          name: 'role',
          type: 'text',
          nullable: true,
          default: `'member'::text`,
        },
        {
          name: 'manager_id',
          type: 'uuid',
          nullable: true,
          foreignKey: {
            table: 'users',
            column: 'id',
          },
        },
      ],
    });

    expect(paramsLog).toHaveLength(4);
    for (const params of paramsLog) {
      expect(params[0]).toEqual(['audit', 'public']);
    }
  });

  it('produces deterministic output regardless of row order', async () => {
    const rows: MockRows = {
      tables: [
        { table_schema: 'public', table_name: 'posts' },
        { table_schema: 'public', table_name: 'users' },
      ],
      columns: [
        {
          table_schema: 'public',
          table_name: 'posts',
          column_name: 'author_id',
          ordinal_position: 2,
          is_nullable: 'NO',
          data_type: 'uuid',
          udt_name: 'uuid',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          column_default: null,
        },
        {
          table_schema: 'public',
          table_name: 'users',
          column_name: 'id',
          ordinal_position: 1,
          is_nullable: 'NO',
          data_type: 'uuid',
          udt_name: 'uuid',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          column_default: null,
        },
        {
          table_schema: 'public',
          table_name: 'posts',
          column_name: 'id',
          ordinal_position: 1,
          is_nullable: 'NO',
          data_type: 'uuid',
          udt_name: 'uuid',
          character_maximum_length: null,
          numeric_precision: null,
          numeric_scale: null,
          column_default: null,
        },
      ],
      constraints: [
        {
          table_schema: 'public',
          table_name: 'posts',
          constraint_name: 'posts_pkey',
          constraint_type: 'PRIMARY KEY',
          column_name: 'id',
          ordinal_position: 1,
          check_clause: null,
        },
        {
          table_schema: 'public',
          table_name: 'users',
          constraint_name: 'users_pkey',
          constraint_type: 'PRIMARY KEY',
          column_name: 'id',
          ordinal_position: 1,
          check_clause: null,
        },
      ],
      foreignKeys: [
        {
          table_schema: 'public',
          table_name: 'posts',
          constraint_name: 'posts_author_id_fkey',
          local_column_name: 'author_id',
          referenced_table_schema: 'public',
          referenced_table_name: 'users',
          referenced_column_name: 'id',
          position: 1,
        },
      ],
    };

    const forward = await introspectPostgresSchema({ query: createMockQuery(rows) });
    const reversed = await introspectPostgresSchema({
      query: createMockQuery({
        tables: [...rows.tables].reverse(),
        columns: [...rows.columns].reverse(),
        constraints: [...rows.constraints].reverse(),
        foreignKeys: [...rows.foreignKeys].reverse(),
      }),
    });

    expect(reversed).toEqual(forward);
  });

  it('ignores composite constraints that cannot be represented in current schema model', async () => {
    const schema = await introspectPostgresSchema({
      query: createMockQuery({
        tables: [{ table_schema: 'public', table_name: 'memberships' }],
        columns: [
          {
            table_schema: 'public',
            table_name: 'memberships',
            column_name: 'user_id',
            ordinal_position: 1,
            is_nullable: 'NO',
            data_type: 'uuid',
            udt_name: 'uuid',
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            column_default: null,
          },
          {
            table_schema: 'public',
            table_name: 'memberships',
            column_name: 'team_id',
            ordinal_position: 2,
            is_nullable: 'NO',
            data_type: 'uuid',
            udt_name: 'uuid',
            character_maximum_length: null,
            numeric_precision: null,
            numeric_scale: null,
            column_default: null,
          },
        ],
        constraints: [
          {
            table_schema: 'public',
            table_name: 'memberships',
            constraint_name: 'memberships_pkey',
            constraint_type: 'PRIMARY KEY',
            column_name: 'user_id',
            ordinal_position: 1,
            check_clause: null,
          },
          {
            table_schema: 'public',
            table_name: 'memberships',
            constraint_name: 'memberships_pkey',
            constraint_type: 'PRIMARY KEY',
            column_name: 'team_id',
            ordinal_position: 2,
            check_clause: null,
          },
        ],
        foreignKeys: [],
      }),
    });

    expect(schema.tables.memberships.primaryKey).toBeNull();
    expect(schema.tables.memberships.columns).toEqual([
      { name: 'user_id', type: 'uuid', nullable: false },
      { name: 'team_id', type: 'uuid', nullable: false },
    ]);
  });
});
