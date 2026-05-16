import { app, shell } from 'electron';
import type { UpdateCache } from './update-cache.js';
import { UpdateCache } from './update-cache.js';
import {
  UPDATE_CACHE_TTL_MS,
  UPDATE_RELEASE_PAGE_URL,
  type GitHubReleasePayload,
  type UpdateCheckOptions,
  type UpdateSeed,
  type UpdateSnapshot,
} from '../../shared/app-update.js';
import { compareSemver } from '../../shared/release-version.js';
import { createGithubReleaseClient, type GithubReleaseClient } from './github-release-client.js';

export interface UpdateServiceDeps {
  cache?: UpdateCache;
  client?: GithubReleaseClient;
  fetcher?: typeof fetch;
  currentVersion?: string;
  now?: () => Date;
  openExternal?: typeof shell.openExternal;
}

const TEST_ONLY_ERROR = 'Test-only update state is unavailable outside test mode';

function createEmptySnapshot(currentVersion: string): UpdateSnapshot {
  return {
    status: 'idle',
    currentVersion,
    latestVersion: null,
    releaseTag: null,
    releaseName: null,
    releaseUrl: null,
    releaseNotes: null,
    lastCheckedAt: null,
    error: null,
  };
}

function normalizeTagVersion(tag: string): string {
  return tag.replace(/^v/i, '').trim();
}

function isFresh(snapshot: UpdateSnapshot | null, now: Date): boolean {
  if (!snapshot?.lastCheckedAt) {
    return false;
  }

  const lastCheckedAt = Date.parse(snapshot.lastCheckedAt);
  if (Number.isNaN(lastCheckedAt)) {
    return false;
  }

  return now.getTime() - lastCheckedAt < UPDATE_CACHE_TTL_MS;
}

function buildSnapshotFromRelease(
  currentVersion: string,
  release: GitHubReleasePayload,
  now: Date,
): UpdateSnapshot {
  const latestVersion = normalizeTagVersion(release.tag_name);
  const releaseUrl = release.html_url ?? UPDATE_RELEASE_PAGE_URL;
  const releaseName = release.name?.trim() || release.tag_name;
  const releaseNotes = release.body?.trim() || null;
  const comparison = compareSemver(currentVersion, latestVersion);

  return {
    status: comparison < 0 ? 'available' : 'up-to-date',
    currentVersion,
    latestVersion,
    releaseTag: release.tag_name,
    releaseName,
    releaseUrl,
    releaseNotes,
    lastCheckedAt: now.toISOString(),
    error: null,
  };
}

export class UpdateService {
  private snapshot: UpdateSnapshot | null = null;
  private testSeed: UpdateSnapshot | null = null;
  private cacheLoaded = false;

  constructor(private readonly deps: UpdateServiceDeps = {}) {}

  private get cache(): UpdateCache {
    return this.deps.cache ?? new UpdateCache();
  }

  private get client(): GithubReleaseClient {
    return this.deps.client ?? createGithubReleaseClient({ fetcher: this.deps.fetcher });
  }

  private get hasCustomClient(): boolean {
    return Boolean(this.deps.client || this.deps.fetcher);
  }

  private get currentVersion(): string {
    return this.deps.currentVersion ?? app.getVersion();
  }

  private get openExternal(): typeof shell.openExternal {
    return this.deps.openExternal ?? shell.openExternal.bind(shell);
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private isTestMode(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  private async ensureLoaded(): Promise<void> {
    if (this.cacheLoaded) {
      return;
    }

    this.snapshot = (await this.cache.load()) ?? createEmptySnapshot(this.currentVersion);
    this.cacheLoaded = true;
  }

  private async persist(snapshot: UpdateSnapshot): Promise<UpdateSnapshot> {
    this.snapshot = snapshot;
    this.cacheLoaded = true;
    await this.cache.save(snapshot);
    return snapshot;
  }

  private async getSeededSnapshot(): Promise<UpdateSnapshot | null> {
    if (!this.testSeed) {
      return null;
    }

    const seededSnapshot = {
      ...createEmptySnapshot(this.currentVersion),
      ...this.testSeed,
      currentVersion: this.currentVersion,
      lastCheckedAt: this.testSeed.lastCheckedAt ?? this.now().toISOString(),
      error: this.testSeed.error ?? null,
      latestVersion: this.testSeed.latestVersion ?? null,
      releaseTag: this.testSeed.releaseTag ?? null,
      releaseName: this.testSeed.releaseName ?? null,
      releaseUrl: this.testSeed.releaseUrl ?? null,
      releaseNotes: this.testSeed.releaseNotes ?? null,
      status: this.testSeed.status ?? 'available',
    } satisfies UpdateSnapshot;

    return seededSnapshot;
  }

  async getStatus(): Promise<UpdateSnapshot> {
    await this.ensureLoaded();

    if (this.testSeed) {
      const seededSnapshot = await this.getSeededSnapshot();
      if (seededSnapshot) {
        this.snapshot = seededSnapshot;
        return seededSnapshot;
      }
    }

    return this.snapshot ?? createEmptySnapshot(this.currentVersion);
  }

  async checkForUpdates(options: UpdateCheckOptions = {}): Promise<UpdateSnapshot> {
    await this.ensureLoaded();

    if (this.testSeed) {
      const seededSnapshot = await this.getSeededSnapshot();
      if (seededSnapshot) {
        return this.persist(seededSnapshot);
      }
    }

    const current = this.snapshot ?? createEmptySnapshot(this.currentVersion);

    if (!options.force && isFresh(current, this.now())) {
      return current;
    }

    if (this.isTestMode() && !this.testSeed && !this.hasCustomClient) {
      return current;
    }

    try {
      const latestRelease = await this.client.getLatestRelease();
      const nextSnapshot = buildSnapshotFromRelease(this.currentVersion, latestRelease, this.now());
      return await this.persist(nextSnapshot);
    } catch (error) {
      const failedSnapshot: UpdateSnapshot = {
        ...current,
        status: 'error',
        lastCheckedAt: this.now().toISOString(),
        error: (error as Error).message,
      };

      return this.persist(failedSnapshot);
    }
  }

  async openRelease(): Promise<void> {
    const status = await this.getStatus();
    await this.openExternal(status.releaseUrl ?? UPDATE_RELEASE_PAGE_URL);
  }

  async seedForTests(seed: UpdateSeed): Promise<UpdateSnapshot> {
    if (!this.isTestMode()) {
      throw new Error(TEST_ONLY_ERROR);
    }

    const snapshot: UpdateSnapshot = {
      ...createEmptySnapshot(this.currentVersion),
      ...seed,
      currentVersion: this.currentVersion,
      status: seed.status ?? 'available',
      latestVersion: seed.latestVersion ?? null,
      releaseTag: seed.releaseTag ?? null,
      releaseName: seed.releaseName ?? null,
      releaseUrl: seed.releaseUrl ?? null,
      releaseNotes: seed.releaseNotes ?? null,
      lastCheckedAt: seed.lastCheckedAt ?? this.now().toISOString(),
      error: seed.error ?? null,
    };

    this.testSeed = snapshot;
    return this.persist(snapshot);
  }

  async resetForTests(): Promise<void> {
    if (!this.isTestMode()) {
      throw new Error(TEST_ONLY_ERROR);
    }

    this.testSeed = null;
    this.snapshot = createEmptySnapshot(this.currentVersion);
    this.cacheLoaded = true;
    await this.cache.clear();
  }
}
