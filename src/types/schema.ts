export type ColumnType =
  | 'uuid'
  | 'varchar'
  | `varchar(${number})`
  | 'text'
  | 'int'
  | 'bigint'
  | `numeric(${number},${number})`
  | 'boolean'
  | 'timestamptz'
  | 'date'
  | (string & {});

export interface ForeignKey {
  table: string;
  column: string;
}

export type PolicyCommand = 'select' | 'insert' | 'update' | 'delete' | 'all';

export interface PolicyNode {
  name: string;
  table: string;
  command: PolicyCommand;
  using?: string;
  withCheck?: string;
  to?: string[];
}

export interface StatePolicy {
  command: PolicyCommand;
  using?: string;
  withCheck?: string;
  to?: string[];
}

export interface IndexNode {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  where?: string;
  expression?: string;
}

export interface StateIndex {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  where?: string;
  expression?: string;
}

export interface ViewNode {
  name: string;
  query: string;
  hash: string;
}

export interface StateView {
  query: string;
  hash?: string;
}

export interface Column {
  name: string;
  type: ColumnType;
  primaryKey?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string | null;
  foreignKey?: ForeignKey;
}

export interface Table {
  name: string;
  columns: Column[];
  primaryKey?: string | null;
  indexes?: IndexNode[];
  policies?: PolicyNode[];
}

export interface DatabaseSchema {
  tables: Record<string, Table>;
  views?: Record<string, ViewNode>;
}

export interface StateColumn {
  type: ColumnType;
  primaryKey?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string | null;
  foreignKey?: ForeignKey;
}

export interface StateTable {
  columns: Record<string, StateColumn>;
  primaryKey?: string | null;
  indexes?: Record<string, StateIndex>;
  policies?: Record<string, StatePolicy>;
}

export interface StateFile {
  version: 1;
  tables: Record<string, StateTable>;
  views?: Record<string, StateView>;
}

export interface DriftColumnDifference {
  tableName: string;
  missingInLive: string[];
  extraInLive: string[];
}

export interface DriftTypeMismatch {
  tableName: string;
  columnName: string;
  expectedType: ColumnType;
  actualType: ColumnType;
}

export interface DriftReport {
  missingTables: string[];
  extraTables: string[];
  columnDifferences: DriftColumnDifference[];
  typeMismatches: DriftTypeMismatch[];
}

export type Operation =
  | { kind: 'create_table'; table: Table }
  | { kind: 'drop_table'; tableName: string }
  | {
    kind: 'column_type_changed';
    tableName: string;
    columnName: string;
    fromType: ColumnType;
    toType: ColumnType;
  }
  | {
    kind: 'column_nullability_changed';
    tableName: string;
    columnName: string;
    from: boolean;
    to: boolean;
  }
  | { kind: 'add_column'; tableName: string; column: Column }
  | {
    kind: 'column_default_changed';
    tableName: string;
    columnName: string;
    fromDefault: string | null;
    toDefault: string | null;
  }
  | { kind: 'drop_column'; tableName: string; columnName: string }
  | {
    kind: 'column_unique_changed';
    tableName: string;
    columnName: string;
    from: boolean;
    to: boolean;
  }
  | { kind: 'drop_primary_key_constraint'; tableName: string }
  | {
    kind: 'add_primary_key_constraint';
    tableName: string;
    columnName: string;
  }
  | { kind: 'create_index'; tableName: string; index: IndexNode }
  | { kind: 'drop_index'; tableName: string; index: StateIndex }
  | { kind: 'create_policy'; tableName: string; policy: PolicyNode }
  | { kind: 'drop_policy'; tableName: string; policyName: string }
  | { kind: 'create_view'; view: ViewNode }
  | { kind: 'drop_view'; viewName: string }
  | { kind: 'replace_view'; view: ViewNode }
  | {
    kind: 'modify_policy';
    tableName: string;
    policyName: string;
    policy: PolicyNode;
  };

export interface DiffResult {
  operations: Operation[];
}
