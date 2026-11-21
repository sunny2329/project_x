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
  /** Sport text tints (readable on bg): badminton, table tennis, pickleball, padel, tennis, volleyball, box cricket, basketball. */
  tBad: string;
  tTT: string;
  tPk: string;
  tPd: string;
  tTn: string;
  tVb: string;
  tBc: string;
  /** Basketball blue as text (#3B82F6 is too dark on bg). */
  tBb: string;
  /** Basketball blue tint behind cards (rgba of #3B82F6). */
  bbTint: string;
  /** Basketball court drawing: floorboards (two tones), the paint, and the court lines. */
  floor: string;
  floor2: string;
  paint: string;
  cline: string;
  /** The light team's fill in charts (lead-by-minute area below the line) and its dot. */
  wFill: string;
  wDot: string;
  /** Initials-avatar backgrounds. */
  av: [string, string, string, string, string];
  /* Design v2 tokens (names follow the CSS variables in "Project X App Design.html"). */
  /** Cards on the page background. */
  card: string;
  /** Rating ring / progress track, confidence bars that are off. */
  track: string;
  /** Rating pills, tier chips, selected-row tints. */
  accentSoft: string;
  /** The orange header block (profile, tournament, result card). */
  hero: string;
  onHero: string;
  heroMuted: string;
  /** Stat tiles inside the hero. */
  heroChip: string;
  goodBg: string;
  badBg: string;
  /** LIVE pill. */
  live: string;
  liveBg: string;
  liveText: string;
  /** Explainer callouts (tiebreak notes). */
  info: string;
  infoBg: string;
  /** Tab bar background. */
  nav: string;
}

/** LIVE dots and borders where no palette is at hand (design v2 red; screens prefer colors.live). */
export const LIVE = '#DC2626';
/** Unread counts, likes and disputes (same in both themes). */
export const ALERT = '#DC2626';
/** READY / Q badges and the Approve button: a soft green that dark text reads on (both themes). */
export const READY = '#9BD88A';
/** Podium crown. */
export const GOLD = '#F5D06B';

export const darkPalette: Palette = {
  bg: '#0A0908',
  surface: '#151210',
  raised: '#2A231E',
  raised2: '#151210',
  bar: '#120F0D',
  scrim: '#000000',
  line: '#2E2722',
  line2: '#3A322C',
  fg: '#F5EFE9',
  soft: '#D8D1CA',
  muted: '#A69B91',
  faint: '#7D756E',
  primary: '#EA580C',
  onPrimary: '#0A0908',
  accentText: '#FDBA8C',
  accentDeep: '#1F1209',
  accentLine: '#5C2F10',
  accentTint: 'rgba(232,93,4,0.14)',
  sideB: '#F2EDE7',
  onBrightMuted: '#4A433D',
  ink: '#0A0A0A',
  warnBg: '#2A2113',
  warnText: '#FFD58A',
  warnLine: '#5C4A24',
  good: '#9BD88A',
  bad: '#FFB49E',
  tBad: '#FDBA8C',
  tTT: '#FDBA8C',
  tPk: '#FDBA8C',
  tPd: '#FDBA8C',
  tTn: '#FDBA8C',
  tVb: '#FDBA8C',
  tBc: '#FDBA8C',
  tBb: '#FDBA8C',
  bbTint: 'rgba(59,130,246,0.14)',
  floor: '#2B1B10',
  floor2: '#24160D',
  paint: 'rgba(232,93,4,0.30)',
  cline: 'rgba(255,236,214,0.55)',
  wFill: 'rgba(242,237,231,0.30)',
  wDot: '#F2EDE7',
  av: ['#3B2A55', '#4A2433', '#173A43', '#3D2A17', '#26361A'],
  card: '#1B1714',
  track: '#2A231E',
  accentSoft: '#3A1C0C',
  hero: '#1D1814',
  onHero: '#F5EFE9',
  heroMuted: '#A69B91',
  heroChip: '#2E2722',
  goodBg: '#17301A',
  badBg: '#3A1A12',
  live: '#F87171',
  liveBg: '#3A1414',
  liveText: '#FCA5A5',
  info: '#C7CBFF',
  infoBg: '#1E1F3A',
  nav: '#120F0D',
};

export const lightPalette: Palette = {
  bg: '#FFFFFF',
  surface: '#F7F4F1',
  raised: '#F1E8E0',
  raised2: '#F7F4F1',
  bar: '#FFFFFF',
  scrim: '#CFC7BF',
  line: '#EAE3DC',
  line2: '#DDD3CA',
  fg: '#17120E',
  soft: '#3B3430',
  muted: '#6B6158',
  faint: '#978D85',
  primary: '#C2410C',
  onPrimary: '#FFFFFF',
  accentText: '#9A3412',
  accentDeep: '#FFF1E7',
  accentLine: '#F8C6A3',
  accentTint: 'rgba(234,88,12,0.10)',
  sideB: '#1C1917',
  onBrightMuted: 'rgba(255,255,255,0.8)',
  ink: '#0A0A0A',
  warnBg: '#FEF3C7',
  warnText: '#92400E',
  warnLine: '#E9C46A',
  good: '#2E6418',
  bad: '#8A2A12',
  tBad: '#9A3412',
  tTT: '#9A3412',
  tPk: '#9A3412',
  tPd: '#9A3412',
  tTn: '#9A3412',
  tVb: '#9A3412',
  tBc: '#9A3412',
  tBb: '#9A3412',
  bbTint: 'rgba(59,130,246,0.10)',
  floor: '#E9B67E',
  floor2: '#DCA56A',
  paint: 'rgba(194,65,12,0.32)',
  cline: 'rgba(255,255,255,0.95)',
  wFill: 'rgba(28,25,23,0.22)',
  wDot: '#1C1917',
  av: ['#EBD9FF', '#FCE1EA', '#CDF3F8', '#FFE6CC', '#E3F5C8'],
  card: '#FFFFFF',
  track: '#F1E8E0',
  accentSoft: '#FDEBDF',
  hero: '#C2410C',
  onHero: '#FFFFFF',
  heroMuted: '#FFE1CF',
  heroChip: '#A3360A',
  goodBg: '#E6F4E1',
  badBg: '#FBE3DC',
  live: '#DC2626',
  liveBg: '#FDE4E4',
  liveText: '#991B1B',
  info: '#3730A3',
  infoBg: '#ECEEFF',
  nav: '#FFFFFF',
};

/** The one brand orange (design v2). Every sport uses it; sports are told apart by name and icon. */
export const BRAND = '#EA580C';

/** Each sport's colour: all the brand orange in design v2 (the API's accentColor is mapped to it too). */
export const SPORT_COLORS: Record<string, string> = {
  badminton: BRAND,
  'table-tennis': BRAND,
  pickleball: BRAND,
  padel: BRAND,
  tennis: BRAND,
  volleyball: BRAND,
  'box-cricket': BRAND,
  basketball: BRAND,
};

/** Dark or white text, whichever reads on a fill colour ("#rrggbb"; anything else gets white). */
export function textOn(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#FFFFFF';
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 140 ? '#0A0A0A' : '#FFFFFF';
}

/** The sport's readable text tint in this palette ("MATCH POINT" in the sport's colour). */
export function sportText(colors: Palette, _slug: string | undefined): string {
  // Design v2 is one orange accent for every sport (sports are told apart by name and icon).
  return colors.accentText;
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
