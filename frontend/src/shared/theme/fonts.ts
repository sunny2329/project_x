import { BarlowCondensed_500Medium, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';

/** Loaded once in the root layout (useFonts). Design v2: Barlow Condensed (display) + DM Sans (body). */
export const FONT_ASSETS = {
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
};

export type BodyWeight = 400 | 500 | 600 | 700 | 800;
/** 500 / 600 / 700 are Barlow's own weights; 800 and 900 (older call sites) render as 700. */
export type DisplayWeight = 500 | 600 | 700 | 800 | 900;

/**
 * Custom fonts can't be bolded with fontWeight on Android, so each weight is its own family.
 * DM Sans 800 is not loaded; it falls back to Bold.
 */
export function bodyFont(weight: BodyWeight = 400): string {
  if (weight >= 700) return 'DMSans_700Bold';
  if (weight === 600) return 'DMSans_600SemiBold';
  if (weight === 500) return 'DMSans_500Medium';
  return 'DMSans_400Regular';
}

/** Barlow Condensed: titles, section headings and every score / rating number. */
export function displayFont(weight: DisplayWeight = 700): string {
  if (weight === 500) return 'BarlowCondensed_500Medium';
  if (weight === 600) return 'BarlowCondensed_600SemiBold';
  return 'BarlowCondensed_700Bold';
}
