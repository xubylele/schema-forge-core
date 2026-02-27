import type { DatabaseSchema, StateFile } from '../types/schema';
import { diffSchemas } from './diff';

export type Severity = 'error' | 'warning';

export interface Finding {
  severity: Severity;
  code: 'DROP_TABLE' | 'DROP_COLUMN' | 'ALTER_COLUMN_TYPE' | 'SET_NOT_NULL';
  table: string;
  column?: string;
  from?: string;
  to?: string;
  message: string;
}

export interface ValidationReport {
  hasErrors: boolean;
  hasWarnings: boolean;
  errors: Array<Omit<Finding, 'severity'>>;
  warnings: Array<Omit<Finding, 'severity'>>;
}

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

function classifyTypeChange(from: string, to: string): Pick<Finding, 'severity' | 'message'> {
  const fromType = normalizeColumnType(from);
  const toType = normalizeColumnType(to);

  const uuidInvolved = fromType === 'uuid' || toType === 'uuid';
  if (uuidInvolved && fromType !== toType) {
    return {
      severity: 'error',
      message: `Type changed from ${fromType} to ${toType} (likely incompatible cast)`,
    };
  }

  if (fromType === 'int' && toType === 'bigint') {
    return {
      severity: 'warning',
      message: 'Type widened from int to bigint',
    };
  }

  if (fromType === 'bigint' && toType === 'int') {
    return {
      severity: 'error',
      message: 'Type narrowed from bigint to int (likely incompatible cast)',
    };
  }

  if (fromType === 'text' && parseVarcharLength(toType) !== null) {
    return {
      severity: 'error',
      message: `Type changed from text to ${toType} (may truncate existing values)`,
    };
  }

  if (parseVarcharLength(fromType) !== null && toType === 'text') {
    return {
      severity: 'warning',
      message: 'Type widened from varchar(n) to text',
    };
  }

  const fromVarcharLength = parseVarcharLength(fromType);
  const toVarcharLength = parseVarcharLength(toType);
  if (fromVarcharLength !== null && toVarcharLength !== null) {
    if (toVarcharLength >= fromVarcharLength) {
      return {
        severity: 'warning',
        message: `Type widened from varchar(${fromVarcharLength}) to varchar(${toVarcharLength})`,
      };
    }

    return {
      severity: 'error',
      message: `Type narrowed from varchar(${fromVarcharLength}) to varchar(${toVarcharLength})`,
    };
  }

  const fromNumeric = parseNumericType(fromType);
  const toNumeric = parseNumericType(toType);
  if (fromNumeric && toNumeric && fromNumeric.scale === toNumeric.scale) {
    if (toNumeric.precision >= fromNumeric.precision) {
      return {
        severity: 'warning',
        message: `Type widened from numeric(${fromNumeric.precision},${fromNumeric.scale}) to numeric(${toNumeric.precision},${toNumeric.scale})`,
      };
    }

    return {
      severity: 'error',
      message: `Type narrowed from numeric(${fromNumeric.precision},${fromNumeric.scale}) to numeric(${toNumeric.precision},${toNumeric.scale})`,
    };
  }

  return {
    severity: 'warning',
    message: `Type changed from ${fromType} to ${toType} (compatibility unknown)`,
  };
}

export function validateSchemaChanges(previousState: StateFile, currentSchema: DatabaseSchema): Finding[] {
  const findings: Finding[] = [];
  const diff = diffSchemas(previousState, currentSchema);

  for (const operation of diff.operations) {
    switch (operation.kind) {
      case 'drop_table':
        findings.push({
          severity: 'error',
          code: 'DROP_TABLE',
          table: operation.tableName,
          message: 'Table removed',
        });
        break;

      case 'drop_column':
        findings.push({
          severity: 'error',
          code: 'DROP_COLUMN',
          table: operation.tableName,
          column: operation.columnName,
          message: 'Column removed',
        });
        break;

      case 'column_type_changed': {
        const classification = classifyTypeChange(operation.fromType, operation.toType);
        findings.push({
          severity: classification.severity,
          code: 'ALTER_COLUMN_TYPE',
          table: operation.tableName,
          column: operation.columnName,
          from: normalizeColumnType(operation.fromType),
          to: normalizeColumnType(operation.toType),
          message: classification.message,
        });
        break;
      }

      case 'column_nullability_changed':
        if (operation.from && !operation.to) {
          findings.push({
            severity: 'warning',
            code: 'SET_NOT_NULL',
            table: operation.tableName,
            column: operation.columnName,
            message: 'Column changed to NOT NULL (may fail if data contains NULLs)',
          });
        }
        break;

      default:
        break;
    }
  }

  return findings;
}

export function toValidationReport(findings: Finding[]): ValidationReport {
  const errors = findings.filter(finding => finding.severity === 'error');
  const warnings = findings.filter(finding => finding.severity === 'warning');

  return {
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errors: errors.map(({ severity, ...finding }) => finding),
    warnings: warnings.map(({ severity, ...finding }) => finding),
  };
}
