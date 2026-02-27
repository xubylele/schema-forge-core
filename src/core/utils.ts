/**
 * Generates a timestamp string in the format YYYYMMDDHHmmss
 * using the local time zone.
 * 
 * @returns A 14-character timestamp string (e.g., "20260222143045")
 * @example
 * ```typescript
 * const timestamp = nowTimestamp();
 * // Returns: "20260222143045"
 * ```
 */
export function nowTimestamp(): string {
  const date = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');

  return (
    String(date.getFullYear()) +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/**
 * Converts a string to a safe kebab-case format suitable for file names.
 * Trims whitespace, converts to lowercase, replaces non-alphanumeric characters
 * with hyphens, and removes leading/trailing hyphens.
 * 
 * @param name - The string to convert to kebab-case
 * @returns A kebab-case string, or 'migration' if the result is empty
 * @example
 * ```typescript
 * slugifyName("MyFileName");      // Returns: "my-file-name"
 * slugifyName("My  File  Name");  // Returns: "my-file-name"
 * slugifyName("My_File@#$Name");  // Returns: "my-file-name"
 * slugifyName("");                // Returns: "migration"
 * slugifyName("   ");             // Returns: "migration"
 * ```
 */
export function slugifyName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  ) || 'migration';
}
