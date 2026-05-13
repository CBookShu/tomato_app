import { describe, expect, test } from 'vitest';
import { createGitCredentialEnv } from '../../../src/main/sync/git-credentials.js';

describe('createGitCredentialEnv', () => {
  test('creates a github-only temporary credential env', () => {
    const env = createGitCredentialEnv('ghp_test_token');

    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.GIT_CONFIG_COUNT).toBe('1');
    expect(env.GIT_CONFIG_KEY_0).toBe('http.https://github.com/.extraheader');
    expect(env.GIT_CONFIG_VALUE_0).toContain('AUTHORIZATION: basic ');

    const encodedValue = env.GIT_CONFIG_VALUE_0?.split('basic ')[1];
    expect(encodedValue).toBeDefined();
    expect(Buffer.from(encodedValue!, 'base64').toString()).toBe('x-access-token:ghp_test_token');
  });
});
