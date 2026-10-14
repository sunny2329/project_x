import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import { create } from 'zustand';

/** "system" follows the phone's appearance setting. */
export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'projectx.theme.mode';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Reads the saved choice; call once at startup. */
  restore: () => Promise<void>;
}

/** Forces native pieces (keyboard, alerts, date pickers) to the same scheme as the app. */
function applyToNative(mode: ThemeMode): void {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  setMode: (mode) => {
    set({ mode });
    applyToNative(mode);
    void SecureStore.setItemAsync(KEY, mode).catch(() => undefined);
  },
  restore: async () => {
    const saved = await SecureStore.getItemAsync(KEY).catch(() => null);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      set({ mode: saved });
      applyToNative(saved);
    }
  },
}));
