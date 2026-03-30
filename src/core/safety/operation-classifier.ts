/**
 * Operation classifier - determines safety level for schema operations.
 * Routes operation types through classification rules to determine SAFE/WARNING/DESTRUCTIVE status.
 */

import type { Operation } from '../../types/schema.js';
import type { SafetyLevel } from './index.js';

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
 * Classify a type change operation to determine safety level.
 * Handles special cases like UUID conversions, int/bigint widening, varchar truncation.
 */
function classifyTypeChange(from: string, to: string): SafetyLevel {
  const fromType = normalizeColumnType(from);
  const toType = normalizeColumnType(to);

  const uuidInvolved = fromType === 'uuid' || toType === 'uuid';
  if (uuidInvolved && fromType !== toType) {
    return 'DESTRUCTIVE';
  }

  if (fromType === 'int' && toType === 'bigint') {
    return 'WARNING';
  }

  if (fromType === 'bigint' && toType === 'int') {
    return 'DESTRUCTIVE';
  }

  if (fromType === 'text' && parseVarcharLength(toType) !== null) {
    return 'DESTRUCTIVE';
  }

  if (parseVarcharLength(fromType) !== null && toType === 'text') {
    return 'WARNING';
  }

  const fromVarcharLength = parseVarcharLength(fromType);
  const toVarcharLength = parseVarcharLength(toType);
  if (fromVarcharLength !== null && toVarcharLength !== null) {
    if (toVarcharLength >= fromVarcharLength) {
      return 'WARNING';
    }

    return 'DESTRUCTIVE';
  }

  const fromNumeric = parseNumericType(fromType);
  const toNumeric = parseNumericType(toType);
  if (fromNumeric && toNumeric && fromNumeric.scale === toNumeric.scale) {
    if (toNumeric.precision >= fromNumeric.precision) {
      return 'WARNING';
    }

    return 'DESTRUCTIVE';
  }

  return 'WARNING';
}

/**
 * Classify an operation to determine its safety level.
 * Routes operation types through classification rules.
 */
export function classifyOperation(operation: Operation): SafetyLevel {
  switch (operation.kind) {
    case 'create_table':
      return 'SAFE';

    case 'add_column':
      return 'SAFE';

    case 'drop_table':
      return 'DESTRUCTIVE';

    case 'drop_column':
      return 'DESTRUCTIVE';

    case 'column_type_changed':
      return classifyTypeChange(operation.fromType, operation.toType);

    case 'column_nullability_changed':
      if (operation.from && !operation.to) {
        return 'WARNING';
      }
      return 'SAFE';

    case 'column_default_changed':
      return 'SAFE';

    case 'column_unique_changed':
      return 'SAFE';

    case 'drop_primary_key_constraint':
      return 'DESTRUCTIVE';

    case 'add_primary_key_constraint':
      return 'SAFE';

    case 'create_index':
      return 'SAFE';

    case 'drop_index':
      return 'WARNING';

    case 'create_policy':
      return 'SAFE';

    case 'drop_policy':
      return 'DESTRUCTIVE';

    case 'modify_policy':
      return 'WARNING';

    default:
      const _exhaustive: never = operation;
      return _exhaustive;
  }
}
