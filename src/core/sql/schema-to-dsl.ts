import type { DatabaseSchema } from '../../types/schema';

function renderColumn(column: {
  name: string;
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string | null;
}): string {
  const parts: string[] = [column.name, column.type];

  if (column.primaryKey) {
    parts.push('pk');
  }

  if (column.unique) {
    parts.push('unique');
  }

  if (column.nullable === false && !column.primaryKey) {
    parts.push('not null');
  }

  if (column.default !== undefined && column.default !== null) {
    parts.push(`default ${column.default}`);
  }

  return `  ${parts.join(' ')}`;
}

export function schemaToDsl(schema: DatabaseSchema): string {
  const tableNames = Object.keys(schema.tables).sort((left, right) => left.localeCompare(right));

  const blocks = tableNames.map(tableName => {
    const table = schema.tables[tableName];
    const lines: string[] = [`table ${table.name} {`];

    for (const column of table.columns) {
      lines.push(renderColumn(column as any));
    }

    lines.push('}');
    return lines.join('\n');
  });

  if (blocks.length === 0) {
    return '# SchemaForge schema definition\n';
  }

  return `# SchemaForge schema definition\n\n${blocks.join('\n\n')}\n`;
}
