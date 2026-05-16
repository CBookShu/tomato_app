import { UPDATE_RELEASES_LATEST_URL, type GitHubReleasePayload } from '../../shared/app-update.js';

export interface GithubReleaseClient {
  getLatestRelease: () => Promise<GitHubReleasePayload>;
}

export interface GithubReleaseClientDeps {
  fetcher?: typeof fetch;
  endpoint?: string;
}

export function createGithubReleaseClient(deps: GithubReleaseClientDeps = {}): GithubReleaseClient {
  const fetcher = deps.fetcher ?? fetch;
  const endpoint = deps.endpoint ?? UPDATE_RELEASES_LATEST_URL;

  return {
    async getLatestRelease() {
      const response = await fetcher(endpoint, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'tomato-app-update-service',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch GitHub release: ${response.status}`);
      }

      return (await response.json()) as GitHubReleasePayload;
    },
  };
}
