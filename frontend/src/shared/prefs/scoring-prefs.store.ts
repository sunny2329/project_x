import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'projectx.scoring.prefs';

interface ScoringPrefs {
  /** Settings > While scoring > Keep screen on. */
  keepAwake: boolean;
  /** Settings > While scoring > Vibrate on each point. */
  haptics: boolean;
  set(changes: Partial<Pick<ScoringPrefs, 'keepAwake' | 'haptics'>>): void;
  /** Reads the saved choices; call once at startup. */
  restore(): Promise<void>;
}

export const useScoringPrefs = create<ScoringPrefs>((set, get) => ({
  keepAwake: true,
  haptics: true,
  set(changes) {
    set(changes);
    const { keepAwake, haptics } = get();
    void SecureStore.setItemAsync(KEY, JSON.stringify({ keepAwake, haptics })).catch(() => undefined);
  },
  async restore() {
    const saved = await SecureStore.getItemAsync(KEY).catch(() => null);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<ScoringPrefs>;
      set({ keepAwake: parsed.keepAwake !== false, haptics: parsed.haptics !== false });
    } catch {
      // Ignore a corrupt value; the defaults stay.
    }
  },
}));
