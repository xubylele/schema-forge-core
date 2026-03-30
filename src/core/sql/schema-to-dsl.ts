import { deterministicIndexName } from '../normalize.js';
import type { DatabaseSchema, IndexNode, PolicyNode } from '../../types/schema.js';

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

function renderPolicy(policy: PolicyNode): string {
  const lines: string[] = [
    `policy "${policy.name}" on ${policy.table}`,
    `for ${policy.command}`
  ];
  if (policy.to !== undefined && policy.to.length > 0) {
    lines.push(`to ${policy.to.join(' ')}`);
  }
  if (policy.using !== undefined && policy.using !== '') {
    lines.push(`using ${policy.using}`);
  }
  if (policy.withCheck !== undefined && policy.withCheck !== '') {
    lines.push(`with check ${policy.withCheck}`);
  }
  return lines.join('\n');
}

function renderIndex(index: IndexNode): string {
  const resolvedName = index.name || deterministicIndexName({
    table: index.table,
    columns: index.columns,
    expression: index.expression,
  });

  const lines: string[] = [`index ${resolvedName} on ${index.table}`];
  if (index.expression) {
    lines.push(`expression ${index.expression}`);
  } else {
    lines.push(`columns ${index.columns.join(', ')}`);
  }

  if (index.unique) {
    lines.push('unique');
  }

  if (index.where) {
    lines.push(`where ${index.where}`);
  }

  return lines.join('\n');
}

export function schemaToDsl(schema: DatabaseSchema): string {
  const tableNames = Object.keys(schema.tables).sort((left, right) => left.localeCompare(right));

  const blocks: string[] = [];
  for (const tableName of tableNames) {
    const table = schema.tables[tableName];
    const tableLines: string[] = [`table ${table.name} {`];

    for (const column of table.columns) {
      tableLines.push(renderColumn(column as any));
    }

    tableLines.push('}');
    blocks.push(tableLines.join('\n'));

    const sortedIndexes = (table.indexes ?? [])
      .map(index => ({
        ...index,
        name: index.name || deterministicIndexName({
          table: index.table,
          columns: index.columns,
          expression: index.expression,
        }),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const index of sortedIndexes) {
      blocks.push(renderIndex(index));
    }

    if (table.policies?.length) {
      for (const policy of table.policies) {
        blocks.push(renderPolicy(policy));
      }
    }
  }

  if (blocks.length === 0) {
    return '# SchemaForge schema definition\n';
  }

  return `# SchemaForge schema definition\n\n${blocks.join('\n\n')}\n`;
}
