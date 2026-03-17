import type { Column, DatabaseSchema } from '../types/schema.js';
import type { PolicyCommand } from '../types/schema.js';

export type SqlOp =
  | {
    kind: 'CREATE_TABLE';
    table: string;
    columns: ParsedColumn[];
    constraints: ParsedConstraint[];
  }
  | { kind: 'ADD_COLUMN'; table: string; column: ParsedColumn }
  | { kind: 'ALTER_COLUMN_TYPE'; table: string; column: string; toType: string }
  | { kind: 'SET_NOT_NULL'; table: string; column: string }
  | { kind: 'DROP_NOT_NULL'; table: string; column: string }
  | { kind: 'SET_DEFAULT'; table: string; column: string; expr: string }
  | { kind: 'DROP_DEFAULT'; table: string; column: string }
  | { kind: 'ADD_CONSTRAINT'; table: string; constraint: ParsedConstraint }
  | { kind: 'DROP_CONSTRAINT'; table: string; name: string }
  | { kind: 'DROP_COLUMN'; table: string; column: string }
  | { kind: 'DROP_TABLE'; table: string }
  | { kind: 'ENABLE_RLS'; table: string }
  | {
    kind: 'CREATE_POLICY';
    table: string;
    name: string;
    command: PolicyCommand;
    using?: string;
    withCheck?: string;
    to?: string[];
  };

export interface ParsedColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string | null;
  unique?: boolean;
  primaryKey?: boolean;
}

export type ParsedConstraint =
  | { type: 'PRIMARY_KEY'; name?: string; columns: string[] }
  | { type: 'UNIQUE'; name?: string; columns: string[] };

export interface ParseWarning {
  statement: string;
  reason: string;
}

export interface ParseResult {
  ops: SqlOp[];
  warnings: ParseWarning[];
}

export interface ApplySqlOpsResult {
  schema: DatabaseSchema | { tables: Record<string, { name: string; columns: Column[]; primaryKey?: string | null }> };
  warnings: ParseWarning[];
}

export type PostgresQueryExecutor = <TRow extends object>(
  sql: string,
  params?: readonly unknown[]
) => Promise<TRow[]>;

export interface PostgresIntrospectionOptions {
  query: PostgresQueryExecutor;
  schemas?: string[];
}

export interface PostgresIntrospectionTableRow {
  table_schema: string;
  table_name: string;
}

export interface PostgresIntrospectionColumnRow {
  table_schema: string;
  table_name: string;
  column_name: string;
  ordinal_position: number;
  is_nullable: 'YES' | 'NO';
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  column_default: string | null;
}

export interface PostgresIntrospectionConstraintRow {
  table_schema: string;
  table_name: string;
  constraint_name: string;
  constraint_type: 'PRIMARY KEY' | 'UNIQUE' | 'CHECK';
  column_name: string | null;
  ordinal_position: number | null;
  check_clause: string | null;
}

export interface PostgresIntrospectionForeignKeyRow {
  table_schema: string;
  table_name: string;
  constraint_name: string;
  local_column_name: string;
  referenced_table_schema: string;
  referenced_table_name: string;
  referenced_column_name: string;
  position: number;
}

export interface NormalizedPostgresConstraint {
  tableSchema: string;
  tableName: string;
  name: string;
  type: 'PRIMARY KEY' | 'UNIQUE' | 'FOREIGN KEY' | 'CHECK';
  columns: string[];
  referencedTableSchema?: string;
  referencedTableName?: string;
  referencedColumns?: string[];
  checkClause?: string;
}
