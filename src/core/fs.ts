import { promises as fs } from 'fs';
import path from 'path';

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error}`);
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a text file with UTF-8 encoding
 */
export async function readTextFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Write a text file with UTF-8 encoding
 */
export async function writeTextFile(filePath: string, content: string): Promise<void> {
  try {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await ensureDir(dir);

    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error}`);
  }
}

/**
 * Read a JSON file with UTF-8 encoding
 * Returns fallback value if file doesn't exist
 */
export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const exists = await fileExists(filePath);
    if (!exists) {
      return fallback;
    }

    const content = await readTextFile(filePath);
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Failed to read JSON file ${filePath}: ${error}`);
  }
}

/**
 * Write a JSON file with UTF-8 encoding
 * Pretty-prints with 2-space indentation
 */
export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  try {
    const content = JSON.stringify(data, null, 2);
    await writeTextFile(filePath, content);
  } catch (error) {
    throw new Error(`Failed to write JSON file ${filePath}: ${error}`);
  }
}

/**
 * Find files matching a pattern recursively
 */
export async function findFiles(dirPath: string, pattern: RegExp): Promise<string[]> {
  const results: string[] = [];

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const subResults = await findFiles(fullPath, pattern);
        results.push(...subResults);
      } else if (item.isFile() && pattern.test(item.name)) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    throw new Error(`Failed to find files in ${dirPath}: ${error}`);
  }

  return results;
}
