export type ColumnType =
  | 'uuid'
  | 'varchar'
  | 'text'
  | 'int'
  | 'boolean'
  | 'timestamptz'
  | 'date';

export interface ForeignKey {
  table: string;
  column: string;
}

export interface Column {
  name: string;
  type: ColumnType;
  primaryKey?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string;
  foreignKey?: ForeignKey;
}

export interface Table {
  name: string;
  columns: Column[];
}

export interface DatabaseSchema {
  tables: Record<string, Table>;
}

export interface StateColumn {
  type: ColumnType;
  primaryKey?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string;
  foreignKey?: ForeignKey;
}

export interface StateTable {
  columns: Record<string, StateColumn>;
}

export interface StateFile {
  version: 1;
  tables: Record<string, StateTable>;
}

export type Operation =
  | { kind: 'create_table'; table: Table }
  | { kind: 'drop_table'; tableName: string }
  | { kind: 'add_column'; tableName: string; column: Column }
  | { kind: 'drop_column'; tableName: string; columnName: string };

export interface DiffResult {
  operations: Operation[];
}
