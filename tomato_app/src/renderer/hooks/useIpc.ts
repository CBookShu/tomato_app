import { useCallback } from 'react';
import type { IpcChannelMap } from '@shared/ipc-channels.js';

export function useIpc() {
  const invoke = useCallback(
    <C extends keyof IpcChannelMap>(
      channel: C,
      ...args: IpcChannelMap[C]['request'] extends void ? [] : [IpcChannelMap[C]['request']]
    ): Promise<IpcChannelMap[C]['response']> => {
      return window.electronAPI.invoke(channel, ...args);
    },
    [],
  );

  const listen = useCallback((channel: string, callback: (...args: unknown[]) => void) => {
    return window.electronAPI.on(channel, callback);
  }, []);

  return { invoke, listen };
}
