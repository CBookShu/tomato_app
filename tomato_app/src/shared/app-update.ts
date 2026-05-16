export const UPDATE_REPOSITORY = {
  owner: 'CBookShu',
  repo: 'tomato_app',
} as const;

export const UPDATE_RELEASES_LATEST_URL = `https://api.github.com/repos/${UPDATE_REPOSITORY.owner}/${UPDATE_REPOSITORY.repo}/releases/latest`;
export const UPDATE_RELEASE_PAGE_URL = `https://github.com/${UPDATE_REPOSITORY.owner}/${UPDATE_REPOSITORY.repo}/releases/latest`;
export const UPDATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'error';

export interface UpdateSnapshot {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  releaseTag: string | null;
  releaseName: string | null;
  releaseUrl: string | null;
  releaseNotes: string | null;
  lastCheckedAt: string | null;
  error: string | null;
}

export interface UpdateCheckOptions {
  force?: boolean;
}

export interface UpdateSeed {
  status?: Exclude<UpdateStatus, 'checking'>;
  latestVersion?: string | null;
  releaseTag?: string | null;
  releaseName?: string | null;
  releaseUrl?: string | null;
  releaseNotes?: string | null;
  lastCheckedAt?: string | null;
  error?: string | null;
}

export interface GitHubReleasePayload {
  tag_name: string;
  name?: string | null;
  html_url?: string | null;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
}
