import { promises as fs } from 'fs';
import path from 'path';
import { findFiles, readTextFile } from '../fs';

export interface MigrationSqlInput {
  filePath: string;
  sql: string;
}

export async function loadMigrationSqlInput(inputPath: string): Promise<MigrationSqlInput[]> {
  const stats = await fs.stat(inputPath);

  if (stats.isFile()) {
    if (!inputPath.toLowerCase().endsWith('.sql')) {
      throw new Error(`Input file must be a .sql file: ${inputPath}`);
    }
    return [{ filePath: inputPath, sql: await readTextFile(inputPath) }];
  }

  if (!stats.isDirectory()) {
    throw new Error(`Input path must be a .sql file or directory: ${inputPath}`);
  }

  const sqlFiles = await findFiles(inputPath, /\.sql$/i);
  sqlFiles.sort((left, right) => path.basename(left).localeCompare(path.basename(right)));

  const result: MigrationSqlInput[] = [];
  for (const filePath of sqlFiles) {
    result.push({
      filePath,
      sql: await readTextFile(filePath)
    });
  }

  return result;
}
