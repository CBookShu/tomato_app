import { app } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const BINDING_FILE_NAME = 'github-sync-binding.json';

export interface RepositoryBinding {
  repositoryUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  remoteName: 'origin';
  remoteBranch: string;
  boundAt: string;
  updatedAt: string;
}

export interface ParsedRepositoryUrl {
  repositoryUrl: string;
  repositoryOwner: string;
  repositoryName: string;
}

export interface CreateRepositoryBindingOptions {
  remoteName?: 'origin';
  remoteBranch?: string;
  now?: Date;
}

export function parseGitHubRepositoryUrl(input: string): ParsedRepositoryUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Repository URL must be a full https://github.com/<owner>/<repo> URL');
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new Error('Repository URL must be a full https://github.com/<owner>/<repo> URL');
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new Error('Repository URL must be a full https://github.com/<owner>/<repo> URL');
  }

  const [repositoryOwner, rawRepositoryName] = segments;
  const repositoryName = rawRepositoryName.endsWith('.git')
    ? rawRepositoryName.slice(0, -4)
    : rawRepositoryName;

  if (!repositoryOwner || !repositoryName) {
    throw new Error('Repository URL must be a full https://github.com/<owner>/<repo> URL');
  }

  return {
    repositoryUrl: `https://github.com/${repositoryOwner}/${repositoryName}`,
    repositoryOwner,
    repositoryName,
  };
}

export function createRepositoryBinding(
  repositoryUrl: string,
  options: CreateRepositoryBindingOptions = {},
): RepositoryBinding {
  const parsed = parseGitHubRepositoryUrl(repositoryUrl);
  const now = (options.now ?? new Date()).toISOString();

  return {
    repositoryUrl: parsed.repositoryUrl,
    repositoryOwner: parsed.repositoryOwner,
    repositoryName: parsed.repositoryName,
    remoteName: options.remoteName ?? 'origin',
    remoteBranch: options.remoteBranch ?? 'main',
    boundAt: now,
    updatedAt: now,
  };
}

export function getRepositoryBindingPath(userDataDir: string = app.getPath('userData')): string {
  return path.join(userDataDir, BINDING_FILE_NAME);
}

export class RepositoryBindingStore {
  constructor(private readonly userDataDir: string = app.getPath('userData')) {}

  async loadBinding(): Promise<RepositoryBinding | null> {
    try {
      const filePath = getRepositoryBindingPath(this.userDataDir);
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw) as RepositoryBinding;
    } catch {
      return null;
    }
  }

  async saveBinding(binding: RepositoryBinding): Promise<void> {
    await fs.mkdir(this.userDataDir, { recursive: true });
    await fs.writeFile(getRepositoryBindingPath(this.userDataDir), `${JSON.stringify(binding, null, 2)}\n`, 'utf8');
  }

  async clearBinding(): Promise<void> {
    try {
      await fs.unlink(getRepositoryBindingPath(this.userDataDir));
    } catch {
      // Ignore missing file.
    }
  }
}
