import { useEffect } from 'react';
import { IPC } from '@shared/ipc-channels.js';
import { useSettingsStore } from '@/stores/settings-store.js';

export function useSound() {
  const soundEnabled = useSettingsStore((s) => s.settings['sound_enabled'] !== 'false');

  useEffect(() => {
    const hasElectronAPI = typeof window !== 'undefined' && window.electronAPI;
    if (!hasElectronAPI) {
      return;
    }

    const handler = async (...args: unknown[]) => {
      if (!soundEnabled) {
        return;
      }

      const soundType = args[0] as string;

      try {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = soundType === 'pomodoro-end' ? 800 : 600;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    };

    return window.electronAPI.on(IPC.PLAY_SOUND, handler);
  }, [soundEnabled]);
}
