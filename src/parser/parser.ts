import type {
  Column,
  ColumnType,
  DatabaseSchema,
  ForeignKey,
  Table,
} from '../types/schema';

export function parseSchema(source: string): DatabaseSchema {
  const lines = source.split('\n');
  const tables: Record<string, Table> = {};

  let currentLine = 0;

  const validColumnTypes: Set<string> = new Set([
    'uuid',
    'varchar',
    'text',
    'int',
    'boolean',
    'timestamptz',
    'date',
  ]);

  function cleanLine(line: string): string {
    const commentIndex = line.search(/(?:\/\/|#)/);
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex);
    }
    return line.trim();
  }

  function parseForeignKey(fkRef: string, lineNum: number): ForeignKey {
    const parts = fkRef.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        `Line ${lineNum}: Invalid foreign key format '${fkRef}'. Expected format: table.column`
      );
    }
    return {
      table: parts[0],
      column: parts[1],
    };
  }

  function parseColumn(line: string, lineNum: number): Column {
    const tokens = line.split(/\s+/).filter(t => t.length > 0);

    if (tokens.length < 2) {
      throw new Error(
        `Line ${lineNum}: Invalid column definition. Expected: <name> <type> [modifiers...]`
      );
    }

    const colName = tokens[0];
    const colType = tokens[1];

    if (!validColumnTypes.has(colType)) {
      throw new Error(
        `Line ${lineNum}: Invalid column type '${colType}'. Valid types: ${Array.from(validColumnTypes).join(', ')}`
      );
    }

    const column: Column = {
      name: colName,
      type: colType as ColumnType,
    };

    let i = 2;
    while (i < tokens.length) {
      const modifier = tokens[i];

      switch (modifier) {
        case 'pk':
          column.primaryKey = true;
          i++;
          break;

        case 'unique':
          column.unique = true;
          i++;
          break;

        case 'nullable':
          column.nullable = true;
          i++;
          break;

        case 'default':
          i++;
          if (i >= tokens.length) {
            throw new Error(`Line ${lineNum}: 'default' modifier requires a value`);
          }
          column.default = tokens[i];
          i++;
          break;

        case 'fk':
          i++;
          if (i >= tokens.length) {
            throw new Error(
              `Line ${lineNum}: 'fk' modifier requires a table.column reference`
            );
          }
          column.foreignKey = parseForeignKey(tokens[i], lineNum);
          i++;
          break;

        default:
          throw new Error(`Line ${lineNum}: Unknown modifier '${modifier}'`);
      }
    }

    return column;
  }

  function parseTableBlock(startLine: number): number {
    const firstLine = cleanLine(lines[startLine]);
    const match = firstLine.match(/^table\s+(\w+)\s*\{?\s*$/);

    if (!match) {
      throw new Error(
        `Line ${startLine + 1}: Invalid table definition. Expected: table <name> {`
      );
    }

    const tableName = match[1];

    if (tables[tableName]) {
      throw new Error(`Line ${startLine + 1}: Duplicate table definition '${tableName}'`);
    }

    const columns: Column[] = [];
    let lineIdx = startLine + 1;
    let foundClosingBrace = false;

    while (lineIdx < lines.length) {
      const cleaned = cleanLine(lines[lineIdx]);

      if (!cleaned) {
        lineIdx++;
        continue;
      }

      if (cleaned === '}') {
        foundClosingBrace = true;
        break;
      }

      const column = parseColumn(cleaned, lineIdx + 1);
      columns.push(column);

      lineIdx++;
    }

    if (!foundClosingBrace) {
      throw new Error(
        `Line ${startLine + 1}: Table '${tableName}' block not closed (missing '}')`
      );
    }

    tables[tableName] = {
      name: tableName,
      columns,
    };

    return lineIdx;
  }

  while (currentLine < lines.length) {
    const cleaned = cleanLine(lines[currentLine]);

    if (!cleaned) {
      currentLine++;
      continue;
    }

    if (cleaned.startsWith('table ')) {
      currentLine = parseTableBlock(currentLine);
    } else {
      throw new Error(
        `Line ${currentLine + 1}: Unexpected content '${cleaned}'. Expected table definition.`
      );
    }

    currentLine++;
  }

  return { tables };
}
