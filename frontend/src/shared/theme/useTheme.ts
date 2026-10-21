import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './colors';
import { useThemeStore } from './theme.store';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette;
}

/** Follows the phone's appearance (every design has a dark and a light version). */
export function useTheme(): Theme {
  const mode = useThemeStore((s) => s.mode);
  const device = useColorScheme();
  const scheme = mode === 'system' ? (device === 'light' ? 'light' : 'dark') : mode;
  return { scheme, colors: scheme === 'dark' ? darkPalette : lightPalette };
}
