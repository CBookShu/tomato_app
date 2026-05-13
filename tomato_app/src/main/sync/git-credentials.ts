export function createGitCredentialEnv(token: string): NodeJS.ProcessEnv {
  const basicToken = Buffer.from(`x-access-token:${token}`).toString('base64');

  return {
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basicToken}`,
  };
}
