import { describe, it, expect } from 'vitest';
import { generateSql } from '../src/generator/sql-generator';
import type { DiffResult, Table, Column } from '../src/types/schema';

describe('Generator - Minimal Tests', () => {
  describe('create_table with supabase provider', () => {
    it('should generate CREATE TABLE with gen_random_uuid() for supabase', () => {
      const table: Table = {
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', primaryKey: true },
          { name: 'email', type: 'varchar', unique: true, nullable: false },
        ],
      };

      const diff: DiffResult = {
        operations: [{ kind: 'create_table', table }],
      };

      const result = generateSql(diff, 'supabase');

      expect(result).toContain('CREATE TABLE users');
      expect(result).toContain('id uuid primary key default gen_random_uuid()');
      expect(result).toContain('email varchar unique not null');
      expect(result).toContain(');');
    });
  });

  describe('add_column to existing table', () => {
    it('should generate ALTER TABLE ADD COLUMN', () => {
      const column: Column = {
        name: 'avatar',
        type: 'varchar',
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
      expect(result).toContain('avatar varchar');
      expect(result).toContain(';');
    });
  });
});
