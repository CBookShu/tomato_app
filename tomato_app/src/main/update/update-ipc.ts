import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import type { UpdateService } from './update-service.js';

export function registerUpdateIpcHandlers(updateService: UpdateService, isTestMode = process.env.NODE_ENV === 'test') {
  ipcMain.handle(IPC.UPDATE_GET_STATUS, async () => updateService.getStatus());
  ipcMain.handle(IPC.UPDATE_CHECK_FOR_UPDATES, async (_event, payload) => updateService.checkForUpdates(payload));
  ipcMain.handle(IPC.UPDATE_OPEN_RELEASE, async () => updateService.openRelease());

  if (isTestMode) {
    ipcMain.handle(IPC.TEST_UPDATE_SEED, async (_event, payload) => {
      await updateService.seedForTests(payload);
      return { success: true as const };
    });

    ipcMain.handle(IPC.TEST_UPDATE_RESET, async () => {
      await updateService.resetForTests();
      return { success: true as const };
    });
  }
}
