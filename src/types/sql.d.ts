import type { Column, DatabaseSchema } from '../types/schema.js';

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
  | { kind: 'DROP_TABLE'; table: string };

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
