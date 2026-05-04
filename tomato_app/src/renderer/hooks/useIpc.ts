import { useCallback } from 'react';
import type { IpcChannelMap, IpcEventChannel } from '@shared/ipc-channels.js';

const hasElectronAPI = typeof window !== 'undefined' && window.electronAPI;

export function useIpc() {
  const invoke = useCallback(
    <C extends keyof IpcChannelMap>(
      channel: C,
      ...args: IpcChannelMap[C]['request'] extends void ? [] : [IpcChannelMap[C]['request']]
    ): Promise<IpcChannelMap[C]['response']> => {
      if (!hasElectronAPI) {
        // In E2E tests or non-Electron environments, return safe defaults
        return Promise.resolve(undefined as IpcChannelMap[C]['response']);
      }
      return window.electronAPI.invoke(channel, ...args);
    },
    [],
  );

  const listen = useCallback((channel: IpcEventChannel, callback: (...args: unknown[]) => void) => {
    if (!hasElectronAPI) {
      return () => {}; // no-op cleanup for E2E
    }
    return window.electronAPI.on(channel, callback);
  }, []);

  return { invoke, listen };
}
