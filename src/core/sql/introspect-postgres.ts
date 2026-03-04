import type { Column, DatabaseSchema, Table } from '../../types/schema.js';
import type {
  NormalizedPostgresConstraint,
  PostgresIntrospectionColumnRow,
  PostgresIntrospectionConstraintRow,
  PostgresIntrospectionForeignKeyRow,
  PostgresIntrospectionOptions,
  PostgresIntrospectionTableRow,
} from '../../types/sql.js';
import { normalizeDefault } from '../normalize.js';

const DEFAULT_SCHEMA = 'public';
const CONSTRAINT_TYPE_ORDER: Record<NormalizedPostgresConstraint['type'], number> = {
  'PRIMARY KEY': 0,
  UNIQUE: 1,
  'FOREIGN KEY': 2,
  CHECK: 3,
};

const TABLES_QUERY = `
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema = ANY($1::text[])
`;

const COLUMNS_QUERY = `
SELECT
  table_schema,
  table_name,
  column_name,
  ordinal_position,
  is_nullable,
  data_type,
  udt_name,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  column_default
FROM information_schema.columns
WHERE table_schema = ANY($1::text[])
`;

const CONSTRAINTS_QUERY = `
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  kcu.ordinal_position,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_catalog = kcu.constraint_catalog
  AND tc.constraint_schema = kcu.constraint_schema
  AND tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
  AND tc.table_name = kcu.table_name
LEFT JOIN information_schema.check_constraints cc
  ON tc.constraint_catalog = cc.constraint_catalog
  AND tc.constraint_schema = cc.constraint_schema
  AND tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = ANY($1::text[])
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
`;

const FOREIGN_KEYS_QUERY = `
SELECT
  src_ns.nspname AS table_schema,
  src.relname AS table_name,
  con.conname AS constraint_name,
  src_attr.attname AS local_column_name,
  ref_ns.nspname AS referenced_table_schema,
  ref.relname AS referenced_table_name,
  ref_attr.attname AS referenced_column_name,
  src_key.ord AS position
FROM pg_constraint con
JOIN pg_class src
  ON src.oid = con.conrelid
JOIN pg_namespace src_ns
  ON src_ns.oid = src.relnamespace
JOIN pg_class ref
  ON ref.oid = con.confrelid
JOIN pg_namespace ref_ns
  ON ref_ns.oid = ref.relnamespace
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS src_key(attnum, ord)
  ON TRUE
JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS ref_key(attnum, ord)
  ON ref_key.ord = src_key.ord
JOIN pg_attribute src_attr
  ON src_attr.attrelid = con.conrelid
  AND src_attr.attnum = src_key.attnum
JOIN pg_attribute ref_attr
  ON ref_attr.attrelid = con.confrelid
  AND ref_attr.attnum = ref_key.attnum
WHERE con.contype = 'f'
  AND src_ns.nspname = ANY($1::text[])
`;

function toTableKey(schema: string, table: string): string {
  if (schema === DEFAULT_SCHEMA) {
    return table;
  }
  return `${schema}.${table}`;
}

function normalizeSchemas(schemas?: string[]): string[] {
  const values = schemas ?? [DEFAULT_SCHEMA];
  const deduped = new Set<string>();

  for (const schema of values) {
    const trimmed = schema.trim();
    if (trimmed.length > 0) {
      deduped.add(trimmed);
    }
  }

  if (deduped.size === 0) {
    deduped.add(DEFAULT_SCHEMA);
  }

  return Array.from(deduped).sort((a, b) => a.localeCompare(b));
}

function normalizeColumnType(row: PostgresIntrospectionColumnRow): string {
  const dataType = row.data_type.toLowerCase();
  const udtName = row.udt_name.toLowerCase();

  if (dataType === 'character varying') {
    if (row.character_maximum_length !== null) {
      return `varchar(${row.character_maximum_length})`;
    }
    return 'varchar';
  }

  if (dataType === 'timestamp with time zone') {
    return 'timestamptz';
  }

  if (dataType === 'integer' || udtName === 'int4') {
    return 'int';
  }

  if (dataType === 'bigint' || udtName === 'int8') {
    return 'bigint';
  }

  if (dataType === 'numeric') {
    if (row.numeric_precision !== null && row.numeric_scale !== null) {
      return `numeric(${row.numeric_precision},${row.numeric_scale})`;
    }
    return 'numeric';
  }

  if (dataType === 'boolean' || udtName === 'bool') {
    return 'boolean';
  }

  if (dataType === 'uuid') {
    return 'uuid';
  }

  if (dataType === 'text') {
    return 'text';
  }

  if (dataType === 'date') {
    return 'date';
  }

  return dataType;
}

function normalizeConstraints(
  constraintRows: PostgresIntrospectionConstraintRow[],
  foreignKeyRows: PostgresIntrospectionForeignKeyRow[],
): NormalizedPostgresConstraint[] {
  const constraints = new Map<string, {
    tableSchema: string;
    tableName: string;
    name: string;
    type: 'PRIMARY KEY' | 'UNIQUE' | 'CHECK';
    columns: Array<{ name: string; position: number }>;
    checkClause?: string;
  }>();

  for (const row of constraintRows) {
    const key = `${row.table_schema}.${row.table_name}.${row.constraint_name}.${row.constraint_type}`;
    const existing = constraints.get(key);

    if (existing) {
      if (row.column_name !== null) {
        existing.columns.push({
          name: row.column_name,
          position: row.ordinal_position ?? Number.MAX_SAFE_INTEGER,
        });
      }
      if (!existing.checkClause && row.check_clause) {
        existing.checkClause = row.check_clause;
      }
      continue;
    }

    constraints.set(key, {
      tableSchema: row.table_schema,
      tableName: row.table_name,
      name: row.constraint_name,
      type: row.constraint_type,
      columns: row.column_name === null
        ? []
        : [{
          name: row.column_name,
          position: row.ordinal_position ?? Number.MAX_SAFE_INTEGER,
        }],
      ...(row.check_clause ? { checkClause: row.check_clause } : {}),
    });
  }

  const normalized: NormalizedPostgresConstraint[] = [];
  for (const value of constraints.values()) {
    value.columns.sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position;
      }
      return left.name.localeCompare(right.name);
    });

    normalized.push({
      tableSchema: value.tableSchema,
      tableName: value.tableName,
      name: value.name,
      type: value.type,
      columns: value.columns.map(item => item.name),
      ...(value.checkClause ? { checkClause: value.checkClause } : {}),
    });
  }

  const foreignKeys = new Map<string, {
    tableSchema: string;
    tableName: string;
    name: string;
    local: Array<{ name: string; position: number }>;
    referencedTableSchema: string;
    referencedTableName: string;
    referenced: Array<{ name: string; position: number }>;
  }>();

  for (const row of foreignKeyRows) {
    const key = `${row.table_schema}.${row.table_name}.${row.constraint_name}`;
    const existing = foreignKeys.get(key);
    if (existing) {
      existing.local.push({ name: row.local_column_name, position: row.position });
      existing.referenced.push({ name: row.referenced_column_name, position: row.position });
      continue;
    }

    foreignKeys.set(key, {
      tableSchema: row.table_schema,
      tableName: row.table_name,
      name: row.constraint_name,
      local: [{ name: row.local_column_name, position: row.position }],
      referencedTableSchema: row.referenced_table_schema,
      referencedTableName: row.referenced_table_name,
      referenced: [{ name: row.referenced_column_name, position: row.position }],
    });
  }

  for (const value of foreignKeys.values()) {
    value.local.sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));
    value.referenced.sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));

    normalized.push({
      tableSchema: value.tableSchema,
      tableName: value.tableName,
      name: value.name,
      type: 'FOREIGN KEY',
      columns: value.local.map(item => item.name),
      referencedTableSchema: value.referencedTableSchema,
      referencedTableName: value.referencedTableName,
      referencedColumns: value.referenced.map(item => item.name),
    });
  }

  normalized.sort((left, right) => {
    if (left.tableSchema !== right.tableSchema) {
      return left.tableSchema.localeCompare(right.tableSchema);
    }
    if (left.tableName !== right.tableName) {
      return left.tableName.localeCompare(right.tableName);
    }
    const typeOrderDiff = CONSTRAINT_TYPE_ORDER[left.type] - CONSTRAINT_TYPE_ORDER[right.type];
    if (typeOrderDiff !== 0) {
      return typeOrderDiff;
    }
    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }
    return left.columns.join(',').localeCompare(right.columns.join(','));
  });

  return normalized;
}

export async function introspectPostgresSchema(options: PostgresIntrospectionOptions): Promise<DatabaseSchema> {
  const schemaFilter = normalizeSchemas(options.schemas);

  const [tableRows, columnRows, constraintRows, foreignKeyRows] = await Promise.all([
    options.query<PostgresIntrospectionTableRow>(TABLES_QUERY, [schemaFilter]),
    options.query<PostgresIntrospectionColumnRow>(COLUMNS_QUERY, [schemaFilter]),
    options.query<PostgresIntrospectionConstraintRow>(CONSTRAINTS_QUERY, [schemaFilter]),
    options.query<PostgresIntrospectionForeignKeyRow>(FOREIGN_KEYS_QUERY, [schemaFilter]),
  ]);

  const sortedTables = [...tableRows].sort((left, right) => {
    if (left.table_schema !== right.table_schema) {
      return left.table_schema.localeCompare(right.table_schema);
    }
    return left.table_name.localeCompare(right.table_name);
  });

  const sortedColumns = [...columnRows].sort((left, right) => {
    if (left.table_schema !== right.table_schema) {
      return left.table_schema.localeCompare(right.table_schema);
    }
    if (left.table_name !== right.table_name) {
      return left.table_name.localeCompare(right.table_name);
    }
    if (left.ordinal_position !== right.ordinal_position) {
      return left.ordinal_position - right.ordinal_position;
    }
    return left.column_name.localeCompare(right.column_name);
  });

  const normalizedConstraints = normalizeConstraints(constraintRows, foreignKeyRows);

  const tableMap = new Map<string, Table>();
  const columnMap = new Map<string, Map<string, Column>>();

  for (const row of sortedTables) {
    const key = toTableKey(row.table_schema, row.table_name);
    const table: Table = { name: key, columns: [], primaryKey: null };
    tableMap.set(key, table);
    columnMap.set(key, new Map());
  }

  for (const row of sortedColumns) {
    const key = toTableKey(row.table_schema, row.table_name);
    const table = tableMap.get(key);
    const columnsByName = columnMap.get(key);
    if (!table || !columnsByName) {
      continue;
    }

    const column: Column = {
      name: row.column_name,
      type: normalizeColumnType(row),
      nullable: row.is_nullable === 'YES',
    };

    const normalizedDefault = normalizeDefault(row.column_default);
    if (normalizedDefault !== null) {
      column.default = normalizedDefault;
    }

    table.columns.push(column);
    columnsByName.set(column.name, column);
  }

  for (const constraint of normalizedConstraints) {
    const tableKey = toTableKey(constraint.tableSchema, constraint.tableName);
    const table = tableMap.get(tableKey);
    const columnsByName = columnMap.get(tableKey);
    if (!table || !columnsByName) {
      continue;
    }

    if (constraint.type === 'PRIMARY KEY') {
      if (constraint.columns.length === 1) {
        const column = columnsByName.get(constraint.columns[0]);
        if (column) {
          column.primaryKey = true;
          column.nullable = false;
          table.primaryKey = column.name;
        }
      }
      continue;
    }

    if (constraint.type === 'UNIQUE') {
      if (constraint.columns.length === 1) {
        const column = columnsByName.get(constraint.columns[0]);
        if (column) {
          column.unique = true;
        }
      }
      continue;
    }

    if (constraint.type === 'FOREIGN KEY') {
      if (
        constraint.columns.length === 1
        && constraint.referencedColumns
        && constraint.referencedColumns.length === 1
        && constraint.referencedTableName
      ) {
        const column = columnsByName.get(constraint.columns[0]);
        if (column) {
          column.foreignKey = {
            table: toTableKey(
              constraint.referencedTableSchema ?? DEFAULT_SCHEMA,
              constraint.referencedTableName,
            ),
            column: constraint.referencedColumns[0],
          };
        }
      }
    }
  }

  const orderedTableNames = Array.from(tableMap.keys()).sort((left, right) => left.localeCompare(right));
  const tables: DatabaseSchema['tables'] = {};
  for (const tableName of orderedTableNames) {
    const table = tableMap.get(tableName);
    if (table) {
      tables[tableName] = table;
    }
  }

  return { tables };
}
