/**
 * Colour tokens from the ProjectX-UI handoff (the CSS variables at the top of every
 * `screens/*.dc.html`). Names match the handoff so a screen can be checked against its design.
 */
export interface Palette {
  /** Screen background. */
  bg: string;
  /** Cards, inputs, round icon buttons. */
  surface: string;
  /** Chips, dividers inside cards, avatar rings. */
  raised: string;
  raised2: string;
  /** Tab bar and bottom action bars. */
  bar: string;
  /** Behind bottom sheets. */
  scrim: string;
  line: string;
  line2: string;
  /** Main text. */
  fg: string;
  soft: string;
  muted: string;
  faint: string;
  /** Main buttons, active tab, + button. */
  primary: string;
  /** Text and icons on primary. */
  onPrimary: string;
  /** Orange text (PROJECT·X·, links). */
  accentText: string;
  accentDeep: string;
  accentLine: string;
  accentTint: string;
  /** The second side's big score button. */
  sideB: string;
  /** Secondary text on the bright side-B / primary fills. */
  onBrightMuted: string;
  /** Dark text on sport-coloured fills. */
  ink: string;
  warnBg: string;
  warnText: string;
  warnLine: string;
  good: string;
  bad: string;
  /** Sport text tints (readable on bg): badminton, table tennis, pickleball, padel, tennis, volleyball. */
  tBad: string;
  tTT: string;
  tPk: string;
  tPd: string;
  tTn: string;
  tVb: string;
  /** Initials-avatar backgrounds. */
  av: [string, string, string, string, string];
}

/** LIVE badges and unread counts (same in both themes). */
export const LIVE = '#FF5468';
/** READY / Q badges and the Approve button (same in both themes). */
export const READY = '#4ADE80';
/** Podium crown. */
export const GOLD = '#F5D06B';

export const darkPalette: Palette = {
  bg: '#0A0A0A',
  surface: '#161412',
  raised: '#221F1C',
  raised2: '#1B1917',
  bar: '#0F0E0D',
  scrim: '#000000',
  line: '#2C2825',
  line2: '#3F3A35',
  fg: '#F6F2EE',
  soft: '#D8D1CA',
  muted: '#ABA39B',
  faint: '#7D756E',
  primary: '#E85D04',
  onPrimary: '#0A0A0A',
  accentText: '#FF8A3D',
  accentDeep: '#1F1209',
  accentLine: '#5C2F10',
  accentTint: 'rgba(232,93,4,0.14)',
  sideB: '#F2EDE7',
  onBrightMuted: '#4A433D',
  ink: '#0A0A0A',
  warnBg: '#2A2113',
  warnText: '#FFD58A',
  warnLine: '#5C4A24',
  good: '#4ADE80',
  bad: '#FF8A98',
  tBad: '#C990FA',
  tTT: '#F2CC4D',
  tPk: '#FDA668',
  tPd: '#5FD4E8',
  tTn: '#B5E26A',
  tVb: '#5EDBC8',
  av: ['#3B2A55', '#4A2433', '#173A43', '#3D2A17', '#26361A'],
};

export const lightPalette: Palette = {
  bg: '#FFFFFF',
  surface: '#F7F3EF',
  raised: '#EEE8E2',
  raised2: '#F2EDE8',
  bar: '#FFFFFF',
  scrim: '#CFC7BF',
  line: '#E6DED6',
  line2: '#D2C8BE',
  fg: '#16120F',
  soft: '#3B3430',
  muted: '#6B625B',
  faint: '#978D85',
  primary: '#C2410C',
  onPrimary: '#FFFFFF',
  accentText: '#C2410C',
  accentDeep: '#FFF1E7',
  accentLine: '#F8C6A3',
  accentTint: 'rgba(234,88,12,0.10)',
  sideB: '#1C1917',
  onBrightMuted: 'rgba(255,255,255,0.8)',
  ink: '#0A0A0A',
  warnBg: '#FEF3C7',
  warnText: '#92400E',
  warnLine: '#E9C46A',
  good: '#15803D',
  bad: '#BE123C',
  tBad: '#7E22CE',
  tTT: '#A16207',
  tPk: '#C2410C',
  tPd: '#0E7490',
  tTn: '#4D7C0F',
  tVb: '#0F766E',
  av: ['#EBD9FF', '#FCE1EA', '#CDF3F8', '#FFE6CC', '#E3F5C8'],
};

/** Each sport's colour (backend/src/catalog/sports.ts); dark text (`ink`) goes on top of it. */
export const SPORT_COLORS: Record<string, string> = {
  badminton: '#A855F7',
  'table-tennis': '#EAB308',
  pickleball: '#F97316',
  padel: '#06B6D4',
  tennis: '#84CC16',
  volleyball: '#14B8A6',
};

/** The sport's readable text tint in this palette ("MATCH POINT" in the sport's colour). */
export function sportText(colors: Palette, slug: string | undefined): string {
  switch (slug) {
    case 'badminton':
      return colors.tBad;
    case 'table-tennis':
      return colors.tTT;
    case 'pickleball':
      return colors.tPk;
    case 'padel':
      return colors.tPd;
    case 'tennis':
      return colors.tTn;
    case 'volleyball':
      return colors.tVb;
    default:
      return colors.accentText;
  }
}

/** `#RRGGBB` at `alpha` ("rgba(168,85,247,0.14)" tints behind sport cards). */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** A stable avatar tone for a person (same colour everywhere). */
export function avatarTone(colors: Palette, key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return colors.av[Math.abs(hash) % colors.av.length]!;
}
