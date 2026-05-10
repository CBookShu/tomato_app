// tomato_app/src/main/sync/keychain.ts
import { safeStorage } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { app } from 'electron';

const SERVICE_NAME = 'tomato-app';
const TOKEN_FILE = 'github-token.enc';

function getTokenFilePath(): string {
  return path.join(app.getPath('userData'), TOKEN_FILE);
}

export async function saveToken(token: string): Promise<void> {
  const encrypted = safeStorage.encryptString(token);
  await fs.writeFile(getTokenFilePath(), encrypted);
}

export async function getToken(): Promise<string | null> {
  try {
    const filePath = getTokenFilePath();
    const encrypted = await fs.readFile(filePath);
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

export async function deleteToken(): Promise<void> {
  try {
    await fs.unlink(getTokenFilePath());
  } catch {
    // Ignore if file doesn't exist
  }
}

export async function hasToken(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}
