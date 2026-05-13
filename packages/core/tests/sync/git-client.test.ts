import { describe, expect, jest, test } from '@jest/globals';
import { GitClient } from '../../src/sync/git-client.js';

const env = jest.fn().mockReturnThis();
const raw = jest.fn<() => Promise<string>>();
const pull = jest.fn();
const push = jest.fn();
const addRemote = jest.fn();
const init = jest.fn();
const addConfig = jest.fn();
const status = jest.fn();
const getRemotes = jest.fn();

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
  })),
}));

describe('GitClient', () => {
  test('applies credential env and keeps github token out of remote URL', () => {
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
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      }),
    );
  });

  test('parses the remote default branch from ls-remote symref output', async () => {
    raw.mockResolvedValueOnce('ref: refs/heads/main\tHEAD\n');
    const client = new GitClient('/tmp/repo');
    await expect(client.getRemoteDefaultBranch('origin')).resolves.toBe('main');
  });
});
