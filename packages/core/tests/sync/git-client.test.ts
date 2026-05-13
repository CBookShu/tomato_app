import { describe, expect, jest, test } from '@jest/globals';
import { GitClient } from '../../src/sync/git-client.js';

const env = jest.fn().mockReturnThis();
const raw = jest.fn<() => Promise<string>>();
const pull = jest.fn<(...args: unknown[]) => Promise<void>>();
const push = jest.fn<(...args: unknown[]) => Promise<void>>();
const addRemote = jest.fn();
const init = jest.fn();
const addConfig = jest.fn();
const status = jest.fn();
const getRemotes = jest.fn();
const checkoutLocalBranch = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.mock('simple-git', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    env,
    raw,
    pull,
    push,
    addRemote,
    init,
    addConfig,
    status,
    getRemotes,
    checkoutLocalBranch,
  })),
}));

describe('GitClient', () => {
  test('applies credential env and keeps github token out of remote URL', () => {
    const previousEnv = process.env.TOMATO_TEST_GIT_ENV;
    process.env.TOMATO_TEST_GIT_ENV = 'keep-me';

    new GitClient('/tmp/repo', {
      env: {
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic dGVzdDp0b2tlbg==',
      },
    });

    expect(env).toHaveBeenCalledWith(
      expect.objectContaining({
        TOMATO_TEST_GIT_ENV: 'keep-me',
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      }),
    );

    if (previousEnv === undefined) {
      delete process.env.TOMATO_TEST_GIT_ENV;
    } else {
      process.env.TOMATO_TEST_GIT_ENV = previousEnv;
    }
  });

  test('parses the remote default branch from ls-remote symref output', async () => {
    raw.mockResolvedValueOnce('ref: refs/heads/main\tHEAD\n');
    const client = new GitClient('/tmp/repo');
    await expect(client.getRemoteDefaultBranch('origin')).resolves.toBe('main');
  });

  test('uses the configured remote and branch for pull and push', async () => {
    pull.mockResolvedValueOnce(undefined);
    push.mockResolvedValueOnce(undefined);

    const client = new GitClient('/tmp/repo', {
      remoteName: 'upstream',
      remoteBranch: 'release',
    });

    await client.pull();
    await client.push();

    expect(pull).toHaveBeenCalledWith('upstream', 'release', ['--rebase']);
    expect(push).toHaveBeenCalledWith('upstream', 'release');
  });

  test('creates a backup branch with checkoutLocalBranch', async () => {
    checkoutLocalBranch.mockResolvedValueOnce(undefined);

    const client = new GitClient('/tmp/repo');
    await client.createBranch('local-backup-test');

    expect(checkoutLocalBranch).toHaveBeenCalledWith('local-backup-test');
  });
});
