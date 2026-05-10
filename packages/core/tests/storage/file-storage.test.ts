// packages/core/tests/storage/file-storage.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileStorage } from '../../src/storage/file-storage.js';

describe('FileStorage', () => {
  let tempDir: string;
  let storage: FileStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tomato-test-'));
    storage = new FileStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('writeFile creates file with content', async () => {
    await storage.writeFile('test.yaml', 'name: test\n');
    const content = await fs.readFile(path.join(tempDir, 'test.yaml'), 'utf-8');
    expect(content).toBe('name: test\n');
  });

  test('readFile returns file content', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'name: test\n');
    const content = await storage.readFile('test.yaml');
    expect(content).toBe('name: test\n');
  });

  test('readFile returns null for missing file', async () => {
    const content = await storage.readFile('missing.yaml');
    expect(content).toBeNull();
  });

  test('deleteFile removes file', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    await storage.deleteFile('test.yaml');
    const exists = await storage.fileExists('test.yaml');
    expect(exists).toBe(false);
  });

  test('fileExists returns true for existing file', async () => {
    await fs.writeFile(path.join(tempDir, 'test.yaml'), 'content');
    const exists = await storage.fileExists('test.yaml');
    expect(exists).toBe(true);
  });

  test('fileExists returns false for missing file', async () => {
    const exists = await storage.fileExists('missing.yaml');
    expect(exists).toBe(false);
  });

  test('ensureDir creates directory if not exists', async () => {
    await storage.ensureDir('subdir/nested');
    const stat = await fs.stat(path.join(tempDir, 'subdir/nested'));
    expect(stat.isDirectory()).toBe(true);
  });

  test('listFiles returns all files in directory', async () => {
    await fs.writeFile(path.join(tempDir, 'a.yaml'), '');
    await fs.writeFile(path.join(tempDir, 'b.yaml'), '');
    const files = await storage.listFiles('.');
    expect(files).toContain('a.yaml');
    expect(files).toContain('b.yaml');
  });
});
