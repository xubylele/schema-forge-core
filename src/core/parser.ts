import type { Column, ColumnType, DatabaseSchema, ForeignKey } from '../types/schema.js';

/**
 * Parse a schema from DSL source string
 * 
 * Supported DSL:
 * - Comments: lines starting with # or // are ignored
 * - Blocks:
 *   table <name> {
 *     <colName> <type> [modifiers...]
 *   }
 * 
 * Supported modifiers:
 * - pk (primary key)
 * - unique
 * - not null
 * - nullable
 * - default <value>
 * - fk <table>.<column> (e.g., fk users.id)
 * 
 * @param source - DSL source string
 * @returns DatabaseSchema with tables and columns in order
 * @throws Error if parsing fails
 */
export function parseSchema(source: string): DatabaseSchema {
  const lines = source.split('\n');
  const tables: Record<string, { name: string; columns: Column[]; primaryKey?: string | null }> = {};

  let currentLine = 0;

  const validBaseColumnTypes: Set<string> = new Set([
    'uuid', 'varchar', 'text', 'int', 'bigint', 'boolean', 'timestamptz', 'date'
  ]);

  function normalizeColumnType(type: string): string {
    return type
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*\)\s*/g, ')');
  }

  function isValidColumnType(type: string): boolean {
    const normalizedType = normalizeColumnType(type);
    if (validBaseColumnTypes.has(normalizedType)) {
      return true;
    }

    return /^varchar\(\d+\)$/.test(normalizedType) || /^numeric\(\d+,\d+\)$/.test(normalizedType);
  }

  /**
   * Remove comments and trim whitespace from a line
   */
  function cleanLine(line: string): string {
    // Remove line comments
    const commentIndex = line.search(/(?:\/\/|#)/);
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex);
    }
    return line.trim();
  }

  /**
   * Parse a foreign key reference (e.g., "users.id")
   */
  function parseForeignKey(fkRef: string, lineNum: number): ForeignKey {
    const parts = fkRef.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Line ${lineNum}: Invalid foreign key format '${fkRef}'. Expected format: table.column`);
    }
    return {
      table: parts[0],
      column: parts[1]
    };
  }

  /**
   * Parse a column definition line
   */
  function parseColumn(line: string, lineNum: number): Column {
    const tokens = line.split(/\s+/).filter(t => t.length > 0);
    const modifiers = new Set(['pk', 'unique', 'nullable', 'default', 'fk']);

    if (tokens.length < 2) {
      throw new Error(`Line ${lineNum}: Invalid column definition. Expected: <name> <type> [modifiers...]`);
    }

    const colName = tokens[0];
    const colType = normalizeColumnType(tokens[1]);

    if (!isValidColumnType(colType)) {
      throw new Error(
        `Line ${lineNum}: Invalid column type '${tokens[1]}'. Valid types: ${Array.from(validBaseColumnTypes).join(', ')}, varchar(n), numeric(p,s)`
      );
    }

    const column: Column = {
      name: colName,
      type: colType as ColumnType,
      nullable: true
    };

    // Parse modifiers
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

        case 'not':
          if (tokens[i + 1] !== 'null') {
            throw new Error(`Line ${lineNum}: Unknown modifier 'not'`);
          }
          column.nullable = false;
          i += 2;
          break;

        case 'default':
          i++;
          if (i >= tokens.length) {
            throw new Error(`Line ${lineNum}: 'default' modifier requires a value`);
          }
          {
            const defaultTokens: string[] = [];

            while (i < tokens.length && !modifiers.has(tokens[i])) {
              defaultTokens.push(tokens[i]);
              i++;
            }

            if (defaultTokens.length === 0) {
              throw new Error(`Line ${lineNum}: 'default' modifier requires a value`);
            }

            column.default = defaultTokens.join(' ');
          }
          break;

        case 'fk':
          i++;
          if (i >= tokens.length) {
            throw new Error(`Line ${lineNum}: 'fk' modifier requires a table.column reference`);
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

  /**
   * Parse a table block
   */
  function parseTableBlock(startLine: number): number {
    const firstLine = cleanLine(lines[startLine]);
    const match = firstLine.match(/^table\s+(\w+)\s*\{?\s*$/);

    if (!match) {
      throw new Error(`Line ${startLine + 1}: Invalid table definition. Expected: table <name> {`);
    }

    const tableName = match[1];

    if (tables[tableName]) {
      throw new Error(`Line ${startLine + 1}: Duplicate table definition '${tableName}'`);
    }

    const columns: Column[] = [];
    let lineIdx = startLine + 1;
    let foundClosingBrace = false;

    // Parse columns until we find closing brace
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

      // This should be a column definition
      try {
        const column = parseColumn(cleaned, lineIdx + 1);
        columns.push(column);
      } catch (error) {
        throw error;
      }

      lineIdx++;
    }

    if (!foundClosingBrace) {
      throw new Error(`Line ${startLine + 1}: Table '${tableName}' block not closed (missing '}')`);
    }

    const primaryKeyColumn = columns.find(column => column.primaryKey)?.name ?? null;

    tables[tableName] = {
      name: tableName,
      columns,
      ...(primaryKeyColumn !== null && { primaryKey: primaryKeyColumn }),
    };

    return lineIdx;
  }

  // Main parsing loop
  while (currentLine < lines.length) {
    const cleaned = cleanLine(lines[currentLine]);

    if (!cleaned) {
      currentLine++;
      continue;
    }

    // Check if this is a table definition
    if (cleaned.startsWith('table ')) {
      currentLine = parseTableBlock(currentLine);
    } else {
      throw new Error(`Line ${currentLine + 1}: Unexpected content '${cleaned}'. Expected table definition.`);
    }

    currentLine++;
  }

  return { tables };
}
