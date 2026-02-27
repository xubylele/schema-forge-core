import { describe, expect, it } from 'vitest';
import { parseMigrationSql } from '../../src/core/sql/parse-migration';
import { splitSqlStatements } from '../../src/core/sql/split-statements';

describe('splitSqlStatements', () => {
  it('does not split semicolon inside single-quoted literal', () => {
    const sql = `
      ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'a;b';
      DROP TABLE public.temp_users;
    `;

    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("'a;b'");
  });
});

describe('parseMigrationSql', () => {
  it('parses CREATE TABLE with inline PK/UNIQUE/DEFAULT', () => {
    const sql = `
      CREATE TABLE public.users (
        id uuid PRIMARY KEY,
        email text UNIQUE,
        created_at timestamptz DEFAULT now()
      );
    `;

    const result = parseMigrationSql(sql);
    expect(result.warnings).toHaveLength(0);
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toEqual({
      kind: 'CREATE_TABLE',
      table: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
        { name: 'email', type: 'text', nullable: true, unique: true },
        { name: 'created_at', type: 'timestamptz', nullable: true, default: 'now()' }
      ],
      constraints: []
    });
  });

  it('parses ALTER TABLE ADD COLUMN', () => {
    const sql = `ALTER TABLE public.users ADD COLUMN last_login timestamptz DEFAULT now();`;
    const result = parseMigrationSql(sql);

    expect(result.warnings).toHaveLength(0);
    expect(result.ops).toEqual([
      {
        kind: 'ADD_COLUMN',
        table: 'users',
        column: {
          name: 'last_login',
          type: 'timestamptz',
          nullable: true,
          default: 'now()'
        }
      }
    ]);
  });

  it('parses ALTER COLUMN TYPE', () => {
    const sql = `ALTER TABLE public.users ALTER COLUMN email TYPE varchar(255);`;
    const result = parseMigrationSql(sql);

    expect(result.warnings).toHaveLength(0);
    expect(result.ops).toEqual([
      {
        kind: 'ALTER_COLUMN_TYPE',
        table: 'users',
        column: 'email',
        toType: 'varchar(255)'
      }
    ]);
  });

  it('parses SET/DROP NOT NULL', () => {
    const sql = `
      ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;
      ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
    `;
    const result = parseMigrationSql(sql);

    expect(result.warnings).toHaveLength(0);
    expect(result.ops).toEqual([
      { kind: 'SET_NOT_NULL', table: 'users', column: 'email' },
      { kind: 'DROP_NOT_NULL', table: 'users', column: 'email' }
    ]);
  });

  it('parses SET/DROP DEFAULT', () => {
    const sql = `
      ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'member';
      ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
    `;
    const result = parseMigrationSql(sql);

    expect(result.warnings).toHaveLength(0);
    expect(result.ops).toEqual([
      { kind: 'SET_DEFAULT', table: 'users', column: 'role', expr: "'member'" },
      { kind: 'DROP_DEFAULT', table: 'users', column: 'role' }
    ]);
  });

  it('parses ADD/DROP CONSTRAINT primary key and unique', () => {
    const sql = `
      ALTER TABLE public.users ADD CONSTRAINT pk_users PRIMARY KEY (id);
      ALTER TABLE public.users ADD CONSTRAINT uq_users_email UNIQUE (email);
      ALTER TABLE public.users DROP CONSTRAINT uq_users_email;
    `;
    const result = parseMigrationSql(sql);

    expect(result.warnings).toHaveLength(0);
    expect(result.ops).toEqual([
      {
        kind: 'ADD_CONSTRAINT',
        table: 'users',
        constraint: { type: 'PRIMARY_KEY', name: 'pk_users', columns: ['id'] }
      },
      {
        kind: 'ADD_CONSTRAINT',
        table: 'users',
        constraint: { type: 'UNIQUE', name: 'uq_users_email', columns: ['email'] }
      },
      {
        kind: 'DROP_CONSTRAINT',
        table: 'users',
        name: 'uq_users_email'
      }
    ]);
  });

  it('parses DROP COLUMN', () => {
    const sql = `ALTER TABLE public.users DROP COLUMN avatar_url;`;
    const result = parseMigrationSql(sql);

    expect(result.warnings).toHaveLength(0);
    expect(result.ops).toEqual([{ kind: 'DROP_COLUMN', table: 'users', column: 'avatar_url' }]);
  });

  it('parses DROP TABLE', () => {
    const sql = `DROP TABLE public.users;`;
    const result = parseMigrationSql(sql);

    expect(result.warnings).toHaveLength(0);
    expect(result.ops).toEqual([{ kind: 'DROP_TABLE', table: 'users' }]);
  });

  it('adds warning for unsupported statements', () => {
    const sql = `CREATE INDEX idx_users_email ON public.users(email);`;
    const result = parseMigrationSql(sql);

    expect(result.ops).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toContain('Unsupported');
  });

  it('returns ordered operations across multiple statements', () => {
    const sql = `
      CREATE TABLE public.users (
        id uuid PRIMARY KEY,
        email text UNIQUE,
        created_at timestamptz DEFAULT now()
      );
      ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;
      ALTER TABLE public.users ALTER COLUMN email TYPE varchar(255);
    `;

    const result = parseMigrationSql(sql);

    expect(result.warnings).toHaveLength(0);
    expect(result.ops.map(op => op.kind)).toEqual([
      'CREATE_TABLE',
      'SET_NOT_NULL',
      'ALTER_COLUMN_TYPE'
    ]);
  });
});
