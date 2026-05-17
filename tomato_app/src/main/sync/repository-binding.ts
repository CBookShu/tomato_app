import { app } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const BINDING_FILE_NAME = 'repository-binding.json';
const DATA_DIR_NAME = 'tomato-data';
const META_DIR_NAME = '.meta';

export interface RepositoryBinding {
  remoteUrl: string;
  remoteLabel: string;
  remoteBranch: string;
  boundAt: string;
  updatedAt: string;
}

export interface ParsedRemoteBinding {
  remoteUrl: string;
  remoteLabel: string;
  remoteBranch: string;
}

export function parseRemoteBinding(remoteUrl: string, remoteBranch: string): ParsedRemoteBinding {
  const trimmedUrl = remoteUrl.trim();
  const trimmedBranch = remoteBranch.trim();

  if (!trimmedUrl) {
    throw new Error('Remote URL is required');
  }

  if (!trimmedBranch) {
    throw new Error('Remote branch is required');
  }

  return {
    remoteUrl: trimmedUrl,
    remoteLabel: trimmedUrl,
    remoteBranch: trimmedBranch,
  };
}

export function createRepositoryBinding(
  remoteUrl: string,
  remoteBranch: string,
  now: Date = new Date(),
): RepositoryBinding {
  const parsed = parseRemoteBinding(remoteUrl, remoteBranch);
  const timestamp = now.toISOString();

  return {
    ...parsed,
    boundAt: timestamp,
    updatedAt: timestamp,
  };
}

export function parseGitHubRepositoryUrl(remoteUrl: string): ParsedRemoteBinding {
  return parseRemoteBinding(remoteUrl, 'main');
}

export type ParsedRepositoryUrl = ParsedRemoteBinding;

export interface CreateRepositoryBindingOptions {
  remoteBranch?: string;
  now?: Date;
}

export function createRepositoryBindingFromOptions(
  remoteUrl: string,
  options: CreateRepositoryBindingOptions = {},
): RepositoryBinding {
  return createRepositoryBinding(remoteUrl, options.remoteBranch ?? 'main', options.now);
}

export function getRepositoryBindingPath(userDataDir: string = app.getPath('userData')): string {
  return path.join(userDataDir, DATA_DIR_NAME, META_DIR_NAME, BINDING_FILE_NAME);
}

function getLegacyRepositoryBindingPath(userDataDir: string): string {
  return path.join(userDataDir, BINDING_FILE_NAME);
}

async function readBindingFile(filePath: string): Promise<RepositoryBinding | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as RepositoryBinding;
  } catch {
    return null;
  }
}

async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore missing file.
  }
}

export class RepositoryBindingStore {
  constructor(private readonly userDataDir: string = app.getPath('userData')) {}

  async loadBinding(): Promise<RepositoryBinding | null> {
    const filePath = getRepositoryBindingPath(this.userDataDir);
    const binding = await readBindingFile(filePath);
    if (binding) {
      return binding;
    }

    const legacyPath = getLegacyRepositoryBindingPath(this.userDataDir);
    const legacyBinding = await readBindingFile(legacyPath);
    if (!legacyBinding) {
      return null;
    }

    await this.saveBinding(legacyBinding);
    await removeFileIfExists(legacyPath);
    return legacyBinding;
  }

  async saveBinding(binding: RepositoryBinding): Promise<void> {
    await fs.mkdir(path.dirname(getRepositoryBindingPath(this.userDataDir)), { recursive: true });
    await fs.writeFile(getRepositoryBindingPath(this.userDataDir), `${JSON.stringify(binding, null, 2)}\n`, 'utf8');
  }

  async clearBinding(): Promise<void> {
    await removeFileIfExists(getRepositoryBindingPath(this.userDataDir));
    await removeFileIfExists(getLegacyRepositoryBindingPath(this.userDataDir));
  }
}
