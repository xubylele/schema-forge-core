import { describe, it, expect } from 'vitest';
import { nowTimestamp, slugifyName } from '../src/core/utils';

describe('nowTimestamp', () => {
  it('should return a string', () => {
    const result = nowTimestamp();
    expect(typeof result).toBe('string');
  });

  it('should return exactly 14 characters', () => {
    const result = nowTimestamp();
    expect(result).toHaveLength(14);
  });

  it('should contain only digits', () => {
    const result = nowTimestamp();
    expect(result).toMatch(/^\d+$/);
  });

  it('should return a valid timestamp format (YYYYMMDDHHmmss)', () => {
    const result = nowTimestamp();

    const year = parseInt(result.substring(0, 4), 10);
    const month = parseInt(result.substring(4, 6), 10);
    const day = parseInt(result.substring(6, 8), 10);
    const hours = parseInt(result.substring(8, 10), 10);
    const minutes = parseInt(result.substring(10, 12), 10);
    const seconds = parseInt(result.substring(12, 14), 10);

    expect(year).toBeGreaterThanOrEqual(2020);
    expect(year).toBeLessThanOrEqual(2100);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThanOrEqual(23);
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThanOrEqual(59);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThanOrEqual(59);
  });
});

describe('slugifyName', () => {
  it('should convert basic string to kebab-case', () => {
    expect(slugifyName('My File Name')).toBe('my-file-name');
  });

  it('should handle multiple spaces', () => {
    expect(slugifyName('My  File  Name')).toBe('my-file-name');
  });

  it('should replace special characters with hyphens', () => {
    expect(slugifyName('My_File@#$Name')).toBe('my-file-name');
  });

  it('should preserve already kebab-case strings', () => {
    expect(slugifyName('my-file-name')).toBe('my-file-name');
  });

  it('should convert uppercase with underscores to kebab-case', () => {
    expect(slugifyName('MY_FILE_NAME')).toBe('my-file-name');
  });

  it('should return fallback "migration" for empty string', () => {
    expect(slugifyName('')).toBe('migration');
  });

  it('should return fallback "migration" for whitespace-only string', () => {
    expect(slugifyName('   ')).toBe('migration');
  });

  it('should preserve numbers in the slug', () => {
    expect(slugifyName('my123file456')).toBe('my123file456');
  });

  it('should remove leading and trailing dashes', () => {
    expect(slugifyName('-my-file-')).toBe('my-file');
  });

  it('should handle special characters', () => {
    expect(slugifyName('Cafe-Manager')).toBe('cafe-manager');
  });

  it('should handle camelCase by lowercasing (no word splitting)', () => {
    expect(slugifyName('MyFile123Name')).toBe('myfile123name');
  });

  it('should handle consecutive special characters', () => {
    expect(slugifyName('my___file---name')).toBe('my-file-name');
  });

  it('should handle strings with only special characters', () => {
    expect(slugifyName('@#$%^&*()')).toBe('migration');
  });

  it('should handle tabs and newlines', () => {
    expect(slugifyName('my\tfile\nname')).toBe('my-file-name');
  });
});
