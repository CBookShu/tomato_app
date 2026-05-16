export function createGitCredentialEnv(token?: string | null): NodeJS.ProcessEnv | undefined {
  const normalizedToken = token?.trim();
  if (!normalizedToken) {
    return undefined;
  }

  const credentials = Buffer.from(`x-access-token:${normalizedToken}`).toString('base64');
  return {
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${credentials}`,
  };
}
