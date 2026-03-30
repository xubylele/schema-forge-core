/**
 * Safety checker - validates operations and enforces safety rules.
 * Returns structured safety reports with standardized result objects.
 */

import type { DatabaseSchema, Operation, StateFile } from '../../types/schema.js';
import { diffSchemas } from '../diff.js';
import { classifyOperation } from './operation-classifier.js';
import type { Finding, SafetyLevel, SafetyReport } from './index.js';

interface NumericType {
  precision: number;
  scale: number;
}

function normalizeColumnType(type: string): string {
  return type
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\)\s*/g, ')');
}

function parseVarcharLength(type: string): number | null {
  const match = normalizeColumnType(type).match(/^varchar\((\d+)\)$/);
  return match ? Number(match[1]) : null;
}

function parseNumericType(type: string): NumericType | null {
  const match = normalizeColumnType(type).match(/^numeric\((\d+),(\d+)\)$/);
  if (!match) {
    return null;
  }

  return {
    precision: Number(match[1]),
    scale: Number(match[2]),
  };
}

/**
 * Generate a detailed message for type changes.
 */
function generateTypeChangeMessage(from: string, to: string): string {
  const fromType = normalizeColumnType(from);
  const toType = normalizeColumnType(to);

  const uuidInvolved = fromType === 'uuid' || toType === 'uuid';
  if (uuidInvolved && fromType !== toType) {
    return `Type changed from ${fromType} to ${toType} (likely incompatible cast)`;
  }

  if (fromType === 'int' && toType === 'bigint') {
    return 'Type widened from int to bigint';
  }

  if (fromType === 'bigint' && toType === 'int') {
    return 'Type narrowed from bigint to int (likely incompatible cast)';
  }

  if (fromType === 'text' && parseVarcharLength(toType) !== null) {
    return `Type changed from text to ${toType} (may truncate existing values)`;
  }

  if (parseVarcharLength(fromType) !== null && toType === 'text') {
    const length = parseVarcharLength(fromType);
    return `Type widened from varchar(${length}) to text`;
  }

  const fromVarcharLength = parseVarcharLength(fromType);
  const toVarcharLength = parseVarcharLength(toType);
  if (fromVarcharLength !== null && toVarcharLength !== null) {
    if (toVarcharLength >= fromVarcharLength) {
      return `Type widened from varchar(${fromVarcharLength}) to varchar(${toVarcharLength})`;
    }

    return `Type narrowed from varchar(${fromVarcharLength}) to varchar(${toVarcharLength})`;
  }

  const fromNumeric = parseNumericType(fromType);
  const toNumeric = parseNumericType(toType);
  if (fromNumeric && toNumeric && fromNumeric.scale === toNumeric.scale) {
    if (toNumeric.precision >= fromNumeric.precision) {
      return `Type widened from numeric(${fromNumeric.precision},${fromNumeric.scale}) to numeric(${toNumeric.precision},${toNumeric.scale})`;
    }

    return `Type narrowed from numeric(${fromNumeric.precision},${fromNumeric.scale}) to numeric(${toNumeric.precision},${toNumeric.scale})`;
  }

  return `Type changed from ${fromType} to ${toType} (compatibility unknown)`;
}

/**
 * Check safety of a single operation.
 * Returns a Finding with classification and detailed context.
 */
export function checkOperationSafety(operation: Operation): Finding | null {
  const safetyLevel = classifyOperation(operation);

  if (safetyLevel === 'SAFE') {
    return null;
  }

  switch (operation.kind) {
    case 'drop_table':
      return {
        safetyLevel,
        code: 'DROP_TABLE',
        table: operation.tableName,
        message: 'Table removed',
        operationKind: operation.kind,
      };

    case 'drop_column':
      return {
        safetyLevel,
        code: 'DROP_COLUMN',
        table: operation.tableName,
        column: operation.columnName,
        message: 'Column removed',
        operationKind: operation.kind,
      };

    case 'column_type_changed':
      return {
        safetyLevel,
        code: 'ALTER_COLUMN_TYPE',
        table: operation.tableName,
        column: operation.columnName,
        from: normalizeColumnType(operation.fromType),
        to: normalizeColumnType(operation.toType),
        message: generateTypeChangeMessage(operation.fromType, operation.toType),
        operationKind: operation.kind,
      };

    case 'column_nullability_changed':
      if (operation.from && !operation.to) {
        return {
          safetyLevel,
          code: 'SET_NOT_NULL',
          table: operation.tableName,
          column: operation.columnName,
          message: 'Column changed to NOT NULL (may fail if data contains NULLs)',
          operationKind: operation.kind,
        };
      }
      return null;

    case 'drop_primary_key_constraint':
      return {
        safetyLevel,
        code: 'DROP_TABLE', // Reuse code for primary key drops
        table: operation.tableName,
        message: 'Primary key constraint removed',
        operationKind: operation.kind,
      };

    case 'drop_index':
      return {
        safetyLevel,
        code: 'DROP_INDEX',
        table: operation.tableName,
        message: `Index '${operation.index.name}' removed`,
        operationKind: operation.kind,
      };

    case 'drop_policy':
      return {
        safetyLevel,
        code: 'DROP_POLICY',
        table: operation.tableName,
        message: 'Policy removed',
        operationKind: operation.kind,
      };

    case 'modify_policy':
      return {
        safetyLevel,
        code: 'MODIFY_POLICY',
        table: operation.tableName,
        message: 'Policy expression changed',
        operationKind: operation.kind,
      };

    default:
      return null;
  }
}

/**
 * Check safety of all schema changes.
 * Returns a comprehensive SafetyReport with all findings aggregated and categorized.
 */
export function checkSchemaSafety(previousState: StateFile, currentSchema: DatabaseSchema): SafetyReport {
  const findings: Finding[] = [];
  const diff = diffSchemas(previousState, currentSchema);

  for (const operation of diff.operations) {
    const finding = checkOperationSafety(operation);
    if (finding) {
      findings.push(finding);
    }
  }

  const hasWarnings = findings.some(f => f.safetyLevel === 'WARNING');
  const hasDestructiveOps = findings.some(f => f.safetyLevel === 'DESTRUCTIVE');

  return {
    findings,
    hasSafeIssues: false, // All findings are non-safe by definition
    hasWarnings,
    hasDestructiveOps,
  };
}
