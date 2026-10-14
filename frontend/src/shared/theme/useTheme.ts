import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './colors';
import { useThemeStore } from './theme.store';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette;
}

/** The player's choice in Settings (Light / Dark), or the device appearance for "System". */
export function useTheme(): Theme {
  const mode = useThemeStore((s) => s.mode);
  const device = useColorScheme();
  const scheme = mode === 'system' ? (device === 'light' ? 'light' : 'dark') : mode;
  return { scheme, colors: scheme === 'dark' ? darkPalette : lightPalette };
}
