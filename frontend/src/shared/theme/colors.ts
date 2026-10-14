export interface Palette {
  /** Screen canvas. */
  background: string;
  /** Cards, fields, list groups. */
  surface: string;
  surfaceBorder: string;
  /** App bars and the tab bar. */
  header: string;
  text: string;
  textMuted: string;
  placeholder: string;
  icon: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Orange-tinted fill behind selected chips, badges and callouts. */
  primarySoft: string;
  link: string;
  divider: string;
  secondaryButton: string;
  secondaryButtonPressed: string;
  error: string;
  errorSurface: string;
  success: string;
  successSurface: string;
  warning: string;
  /** Opacity of the orange glow under primary buttons, the logo and the tab bar's + button. */
  glow: number;
}

/** Strava's orange, used in both themes. */
const ORANGE = '#FC5200';

/**
 * Strava-style dark mode: near-black cards and app bars on a black canvas (the black shows as the
 * gap between feed cards), white text, flat orange actions with no glow.
 */
export const darkPalette: Palette = {
  background: '#000000',
  surface: '#141414',
  surfaceBorder: '#333333',
  header: '#141414',
  text: '#FFFFFF',
  textMuted: '#A3A3A3',
  placeholder: '#8F8F8F',
  icon: '#A3A3A3',
  primary: ORANGE,
  primaryPressed: '#E04800',
  onPrimary: '#FFFFFF',
  primarySoft: '#2E1608',
  link: ORANGE,
  divider: '#262626',
  secondaryButton: '#242424',
  secondaryButtonPressed: '#2E2E2E',
  error: '#FF6B6B',
  errorSurface: '#2A1414',
  success: '#4ADE80',
  successSurface: '#12261A',
  warning: '#FACC15',
  glow: 0,
};

/**
 * Strava-style light mode: white app bars and cards on a light grey canvas, near-black text,
 * hairline borders, flat, orange only for actions and highlights.
 */
export const lightPalette: Palette = {
  background: '#F0F0F5',
  surface: '#FFFFFF',
  surfaceBorder: '#D6D6DC',
  header: '#FFFFFF',
  text: '#242428',
  textMuted: '#6D6D78',
  placeholder: '#8A8A94',
  icon: '#6D6D78',
  primary: ORANGE,
  primaryPressed: '#E04800',
  onPrimary: '#FFFFFF',
  primarySoft: '#FFEFE6',
  link: ORANGE,
  divider: '#E8E8EC',
  secondaryButton: '#F2F2F4',
  secondaryButtonPressed: '#E6E6EA',
  error: '#D93025',
  errorSurface: '#FDECEA',
  success: '#16A34A',
  successSurface: '#E8F7EE',
  warning: '#B7791F',
  glow: 0,
};

/** Background tones for initials avatars and team badges, picked by name so a player keeps the same colour. */
export const AVATAR_TONES = ['#7C5CBF', '#3F6FD8', '#B84A5E', '#2F8F6A', '#8A7A1E', '#C26A1B', '#4A7F9E', '#9C4FA8'] as const;

export function toneFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]!;
}
