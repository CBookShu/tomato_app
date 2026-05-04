import { create } from 'zustand';

interface SettingsStoreState {
  settings: Record<string, string>;
  loading: boolean;

  setAll: (settings: Record<string, string>) => void;
  set: (key: string, value: string) => void;
  get: (key: string, defaultValue?: string) => string | null;
  remove: (key: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: {},
  loading: false,

  setAll: (settings) => set({ settings }),
  set: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  get: (key, defaultValue) => get().settings[key] ?? defaultValue ?? null,
  remove: (key) =>
    set((s) => {
      const next = { ...s.settings };
      delete next[key];
      return { settings: next };
    }),
  setLoading: (loading) => set({ loading }),
}));
