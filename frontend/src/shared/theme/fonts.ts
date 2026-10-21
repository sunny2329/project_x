import {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  BigShouldersDisplay_900Black,
} from '@expo-google-fonts/big-shoulders-display';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';

/** Loaded once in the root layout (useFonts). */
export const FONT_ASSETS = {
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_800ExtraBold,
  BigShouldersDisplay_900Black,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
};

export type BodyWeight = 400 | 500 | 600 | 700 | 800;
export type DisplayWeight = 700 | 800 | 900;

/**
 * Custom fonts can't be bolded with fontWeight on Android, so each weight is its own family.
 * Instrument Sans has no 800; it falls back to Bold.
 */
export function bodyFont(weight: BodyWeight = 400): string {
  if (weight >= 700) return 'InstrumentSans_700Bold';
  if (weight === 600) return 'InstrumentSans_600SemiBold';
  if (weight === 500) return 'InstrumentSans_500Medium';
  return 'InstrumentSans_400Regular';
}

/** Big Shoulders Display: titles and every score number. */
export function displayFont(weight: DisplayWeight = 900): string {
  if (weight === 700) return 'BigShouldersDisplay_700Bold';
  if (weight === 800) return 'BigShouldersDisplay_800ExtraBold';
  return 'BigShouldersDisplay_900Black';
}
