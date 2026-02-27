import { describe, it, expect } from 'vitest';
import { generateSql } from '../src/generator/sql-generator';
import type { DiffResult, Table, Column } from '../src/types/schema';

describe('SQL Generator', () => {
  describe('generateSql', () => {
    it('should generate create table statement', () => {
      const table: Table = {
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'email', type: 'varchar', unique: true, nullable: false },
          { name: 'created_at', type: 'timestamptz' },
        ],
      };

      const diff: DiffResult = {
        operations: [
          {
            kind: 'create_table',
            table,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('CREATE TABLE users');
      expect(result).toContain('id uuid primary key');
      expect(result).toContain('email varchar unique not null');
      expect(result).toContain('created_at timestamptz');
      expect(result).toContain(');');
    });

    it('should generate drop table statement', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'drop_table',
            tableName: 'users',
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toBe('DROP TABLE users;');
    });

    it('should generate add column statement', () => {
      const column: Column = {
        name: 'age',
        type: 'int',
        nullable: true,
      };

      const diff: DiffResult = {
        operations: [
          {
            kind: 'add_column',
            tableName: 'users',
            column,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('ALTER TABLE users ADD COLUMN');
      expect(result).toContain('age int');
    });

    it('should generate drop column statement', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'drop_column',
            tableName: 'users',
            columnName: 'age',
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toBe('ALTER TABLE users DROP COLUMN age;');
    });

    it('should generate alter column type statement', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'column_type_changed',
            tableName: 'users',
            columnName: 'email',
            fromType: 'varchar',
            toType: 'text',
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toBe(
        'ALTER TABLE users ALTER COLUMN email TYPE text USING email::text;'
      );
    });

    it('should generate set default statement when default is added or modified', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'column_default_changed',
            tableName: 'users',
            columnName: 'created_at',
            fromDefault: 'now()',
            toDefault: "timezone('utc', now())",
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toBe(
        "ALTER TABLE users ALTER COLUMN created_at SET DEFAULT timezone('utc', now());"
      );
    });

    it('should generate alter column set not null statement', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'column_nullability_changed',
            tableName: 'users',
            columnName: 'email',
            from: true,
            to: false,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      expect(result).toBe('ALTER TABLE users ALTER COLUMN email SET NOT NULL;');
    });

    it('should generate drop default statement when default is removed', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'column_default_changed',
            tableName: 'users',
            columnName: 'created_at',
            fromDefault: 'now()',
            toDefault: null,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toBe(
        'ALTER TABLE users ALTER COLUMN created_at DROP DEFAULT;'
      );
    });

    it('should generate alter column drop not null statement', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'column_nullability_changed',
            tableName: 'users',
            columnName: 'email',
            from: false,
            to: true,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      expect(result).toBe('ALTER TABLE users ALTER COLUMN email DROP NOT NULL;');
    });

    it('should generate type change before nullability change when both operations exist', () => {
      const diff: DiffResult = {
        operations: [
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
        ],
      };

      const result = generateSql(diff, 'postgres');
      expect(result).toBe([
        'ALTER TABLE users ALTER COLUMN email TYPE text USING email::text;',
        'ALTER TABLE users ALTER COLUMN email SET NOT NULL;',
      ].join('\n\n'));
    });

    it('should generate multiple operations separated by newlines', () => {
      const table: Table = {
        name: 'posts',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'title', type: 'varchar', nullable: false },
        ],
      };

      const diff: DiffResult = {
        operations: [
          {
            kind: 'create_table',
            table,
          },
          {
            kind: 'drop_table',
            tableName: 'old_posts',
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      const parts = result.split('\n\n');

      expect(parts.length).toBe(2);
      expect(parts[0]).toContain('CREATE TABLE posts');
      expect(parts[1]).toBe('DROP TABLE old_posts;');
    });
  });

  describe('Create Table with Column Types', () => {
    it('should handle uuid column with supabase provider and default', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'supabase');

      expect(result).toContain('id uuid primary key default gen_random_uuid()');
    });

    it('should handle uuid column without default for postgres provider', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('id uuid primary key');
      expect(result).not.toContain('gen_random_uuid()');
    });

    it('should handle varchar columns', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'email', type: 'varchar', unique: true }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('email varchar unique');
    });

    it('should handle text columns', () => {
      const table: Table = {
        name: 'posts',
        columns: [{ name: 'content', type: 'text', nullable: false }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('content text not null');
    });

    it('should handle int columns', () => {
      const table: Table = {
        name: 'products',
        columns: [{ name: 'quantity', type: 'int', nullable: false }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('quantity int not null');
    });

    it('should handle boolean columns', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'active', type: 'boolean', default: 'true' }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('active boolean default true');
    });

    it('should handle timestamptz columns', () => {
      const table: Table = {
        name: 'events',
        columns: [{ name: 'created_at', type: 'timestamptz' }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('created_at timestamptz');
    });

    it('should handle date columns', () => {
      const table: Table = {
        name: 'bookings',
        columns: [{ name: 'booking_date', type: 'date' }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('booking_date date');
    });
  });

  describe('Column Constraints', () => {
    it('should handle NOT NULL constraint', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'email', type: 'varchar', nullable: false }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('email varchar not null');
    });

    it('should not add NOT NULL when nullable is true', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'phone', type: 'varchar', nullable: true }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('phone varchar');
      expect(result).not.toContain('phone varchar not null');
    });

    it('should not add NOT NULL when nullable is undefined', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'note', type: 'text' }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('note text');
      expect(result).not.toContain('not null');
    });

    it('should handle PRIMARY KEY constraint', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'id', type: 'int', primaryKey: true }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('id int primary key');
    });

    it('should handle UNIQUE constraint', () => {
      const table: Table = {
        name: 'users',
        columns: [
          { name: 'email', type: 'varchar', unique: true, nullable: false },
        ],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('email varchar unique not null');
    });

    it('should handle DEFAULT constraint', () => {
      const table: Table = {
        name: 'users',
        columns: [
          { name: 'status', type: 'varchar', default: "'active'" },
        ],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain("status varchar default 'active'");
    });

    it('should handle FOREIGN KEY constraint', () => {
      const table: Table = {
        name: 'posts',
        columns: [
          {
            name: 'user_id',
            type: 'uuid',
            foreignKey: { table: 'users', column: 'id' },
          },
        ],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('user_id uuid references users(id)');
    });

    it('should combine multiple constraints', () => {
      const table: Table = {
        name: 'posts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            primaryKey: true,
            nullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            nullable: false,
            foreignKey: { table: 'users', column: 'id' },
          },
          {
            name: 'slug',
            type: 'varchar',
            unique: true,
            nullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'draft'",
            nullable: false,
          },
        ],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('id uuid primary key not null');
      expect(result).toContain(
        'user_id uuid references users(id) not null'
      );
      expect(result).toContain('slug varchar unique not null');
      expect(result).toContain("status varchar not null default 'draft'");
    });
  });

  describe('Add Column', () => {
    it('should add simple column', () => {
      const column: Column = {
        name: 'age',
        type: 'int',
      };

      const diff: DiffResult = {
        operations: [
          {
            kind: 'add_column',
            tableName: 'users',
            column,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toBe('ALTER TABLE users ADD COLUMN age int;');
    });

    it('should add column with constraints', () => {
      const column: Column = {
        name: 'status',
        type: 'varchar',
        nullable: false,
        default: "'active'",
      };

      const diff: DiffResult = {
        operations: [
          {
            kind: 'add_column',
            tableName: 'users',
            column,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain("ALTER TABLE users ADD COLUMN status varchar");
      expect(result).toContain("not null default 'active'");
    });

    it('should add foreign key column', () => {
      const column: Column = {
        name: 'org_id',
        type: 'uuid',
        nullable: false,
        foreignKey: { table: 'organizations', column: 'id' },
      };

      const diff: DiffResult = {
        operations: [
          {
            kind: 'add_column',
            tableName: 'users',
            column,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain(
        'ALTER TABLE users ADD COLUMN org_id uuid references organizations(id) not null'
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should generate complete schema with multiple tables', () => {
      const userTable: Table = {
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'email', type: 'varchar', unique: true, nullable: false },
          { name: 'created_at', type: 'timestamptz' },
        ],
      };

      const postTable: Table = {
        name: 'posts',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          {
            name: 'user_id',
            type: 'uuid',
            nullable: false,
            foreignKey: { table: 'users', column: 'id' },
          },
          { name: 'title', type: 'varchar', nullable: false },
          { name: 'content', type: 'text' },
        ],
      };

      const diff: DiffResult = {
        operations: [
          { kind: 'create_table', table: userTable },
          { kind: 'create_table', table: postTable },
        ],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('CREATE TABLE users');
      expect(result).toContain('CREATE TABLE posts');
      expect(result).toContain('user_id uuid references users(id) not null');
    });

    it('should handle migration scenario: create, alter, drop', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'create_table',
            table: {
              name: 'new_users',
              columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
            },
          },
          {
            kind: 'add_column',
            tableName: 'new_users',
            column: { name: 'email', type: 'varchar', nullable: false },
          },
          {
            kind: 'drop_table',
            tableName: 'old_users',
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      const parts = result.split('\n\n');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toContain('CREATE TABLE new_users');
      expect(parts[1]).toContain('ALTER TABLE new_users ADD COLUMN email');
      expect(parts[2]).toBe('DROP TABLE old_users;');
    });
  });

  describe('Provider-specific behavior', () => {
    it('should generate uuid default for supabase', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'supabase');

      expect(result).toContain('default gen_random_uuid()');
    });

    it('should not generate uuid default for postgres without config', () => {
      const table: Table = {
        name: 'users',
        columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).not.toContain('gen_random_uuid()');
    });

    it('should work with both supabase and postgres providers', () => {
      const table: Table = {
        name: 'test',
        columns: [
          { name: 'id', type: 'int', primaryKey: true },
          { name: 'name', type: 'varchar' },
        ],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const resultSupabase = generateSql(diff, 'supabase');
      const resultPostgres = generateSql(diff, 'postgres');

      // Both should have basic structure
      expect(resultSupabase).toContain('CREATE TABLE test');
      expect(resultPostgres).toContain('CREATE TABLE test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle table with single column', () => {
      const table: Table = {
        name: 'simple',
        columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('CREATE TABLE simple');
      expect(result).toContain('id uuid primary key');
      expect(result).toContain(');');
    });

    it('should handle empty operations', () => {
      const diff: DiffResult = {
        operations: [],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toBe('');
    });

    it('should handle column with all constraints', () => {
      const table: Table = {
        name: 'complex',
        columns: [
          {
            name: 'special_id',
            type: 'uuid',
            primaryKey: true,
            unique: true,
            nullable: false,
            default: 'gen_random_uuid()',
            foreignKey: { table: 'other', column: 'id' },
          },
        ],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');

      expect(result).toContain('special_id uuid');
      expect(result).toContain('primary key');
      expect(result).toContain('unique');
      expect(result).toContain('not null');
      expect(result).toContain('default gen_random_uuid()');
      expect(result).toContain('references other(id)');
    });

    it('should properly format multi-line CREATE TABLE statements', () => {
      const table: Table = {
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'email', type: 'varchar', unique: true, nullable: false },
          { name: 'created_at', type: 'timestamptz' },
        ],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'postgres');
      const lines = result.split('\n');

      expect(lines[0]).toBe('CREATE TABLE users (');
      expect(lines[lines.length - 1]).toBe(');');
      // Check that columns are indented properly
      expect(lines[1]).toMatch(/^\s+/);
    });
  });

  describe('Constraint Changes', () => {
    it('should generate deterministic ADD UNIQUE constraint SQL', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'column_unique_changed',
            tableName: 'users',
            columnName: 'email',
            from: false,
            to: true,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      expect(result).toBe(
        'ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);'
      );
    });

    it('should generate deterministic DROP UNIQUE constraint SQL with legacy fallback', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'column_unique_changed',
            tableName: 'users',
            columnName: 'email',
            from: true,
            to: false,
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      expect(result).toBe(
        'ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_email;\nALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;'
      );
    });

    it('should generate ADD PRIMARY KEY constraint SQL with deterministic name', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'add_primary_key_constraint',
            tableName: 'users',
            columnName: 'id',
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      expect(result).toBe(
        'ALTER TABLE users ADD CONSTRAINT pk_users PRIMARY KEY (id);'
      );
    });

    it('should generate DROP PRIMARY KEY constraint SQL with legacy fallback', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'drop_primary_key_constraint',
            tableName: 'users',
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      expect(result).toBe(
        'ALTER TABLE users DROP CONSTRAINT IF EXISTS pk_users;\nALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;'
      );
    });

    it('should keep deterministic drop then add ordering for primary key change', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'drop_primary_key_constraint',
            tableName: 'users',
          },
          {
            kind: 'add_primary_key_constraint',
            tableName: 'users',
            columnName: 'user_id',
          },
        ],
      };

      const result = generateSql(diff, 'postgres');
      const parts = result.split('\n\n');

      expect(parts).toHaveLength(2);
      expect(parts[0]).toContain('DROP CONSTRAINT IF EXISTS pk_users');
      expect(parts[1]).toBe(
        'ALTER TABLE users ADD CONSTRAINT pk_users PRIMARY KEY (user_id);'
      );
    });

    it('should produce identical SQL for repeated runs', () => {
      const diff: DiffResult = {
        operations: [
          {
            kind: 'column_unique_changed',
            tableName: 'users',
            columnName: 'email',
            from: false,
            to: true,
          },
          {
            kind: 'drop_primary_key_constraint',
            tableName: 'users',
          },
          {
            kind: 'add_primary_key_constraint',
            tableName: 'users',
            columnName: 'user_id',
          },
        ],
      };

      expect(generateSql(diff, 'postgres')).toBe(generateSql(diff, 'postgres'));
    });
  });
});
