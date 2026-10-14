/*
 * Reference data: sports, side formats and default rulesets, written to the database by
 * `npm run db:seed` (upserts by slug, never deletes). Each ruleset config is validated by its
 * plugin's configSchema when seeding. Adding a sport = one entry here (plus a plugin if it needs a
 * new scoring model); see ADDING_A_SPORT.md.
 */

export interface FormatSeed {
  code: string;
  name: string;
  playersPerSide: number;
  minPerSide?: number;
  maxPerSide?: number;
}

export interface RulesetSeed {
  slug: string;
  name: string;
  scoringModel: string;
  config: Record<string, unknown>;
  isDefault?: boolean;
}

export interface SportSeed {
  /** Stable ids: 1-6 match the legacy mst_sport ids. */
  id: number;
  slug: string;
  name: string;
  category: string;
  scoringModel: string;
  isActive: boolean;
  iconKey: string;
  accentColor: string;
  sortOrder: number;
  formats: FormatSeed[];
  rulesets: RulesetSeed[];
}

const SINGLES: FormatSeed = { code: 'singles', name: 'Singles', playersPerSide: 1 };
const DOUBLES: FormatSeed = { code: 'doubles', name: 'Doubles', playersPerSide: 2 };

const badmintonServe = { rotation: 'rally_winner', courtByScore: true, nextGameFirstServer: 'game_winner' };
const tableTennisServe = { rotation: 'alternate', pointsPerServe: 2, everyPointFrom: 10, nextGameFirstServer: 'alternate' };

export const SPORTS: SportSeed[] = [
  {
    id: 2,
    slug: 'badminton',
    name: 'Badminton',
    category: 'racket',
    scoringModel: 'rally',
    isActive: true,
    iconKey: 'badminton',
    accentColor: '#A855F7',
    sortOrder: 1,
    formats: [SINGLES, DOUBLES],
    rulesets: [
      {
        slug: 'bwf-21x3',
        name: 'Best of 3 · 21 points',
        scoringModel: 'rally',
        isDefault: true,
        config: { pointsToWin: 21, winBy: 2, cap: 30, bestOf: 3, serve: badmintonServe },
      },
      { slug: 'single-21', name: 'One game · 21 points', scoringModel: 'rally', config: { pointsToWin: 21, winBy: 2, cap: 30, bestOf: 1, serve: badmintonServe } },
      { slug: 'short-15x3', name: 'Best of 3 · 15 points', scoringModel: 'rally', config: { pointsToWin: 15, winBy: 2, cap: 21, bestOf: 3, serve: badmintonServe } },
    ],
  },
  {
    id: 3,
    slug: 'table-tennis',
    name: 'Table Tennis',
    category: 'racket',
    scoringModel: 'rally',
    isActive: true,
    iconKey: 'table-tennis',
    accentColor: '#EAB308',
    sortOrder: 2,
    formats: [SINGLES, DOUBLES],
    rulesets: [
      { slug: 'ittf-11x5', name: 'Best of 5 · 11 points', scoringModel: 'rally', isDefault: true, config: { pointsToWin: 11, winBy: 2, bestOf: 5, serve: tableTennisServe } },
      { slug: 'ittf-11x3', name: 'Best of 3 · 11 points', scoringModel: 'rally', config: { pointsToWin: 11, winBy: 2, bestOf: 3, serve: tableTennisServe } },
      { slug: 'ittf-11x7', name: 'Best of 7 · 11 points', scoringModel: 'rally', config: { pointsToWin: 11, winBy: 2, bestOf: 7, serve: tableTennisServe } },
    ],
  },
  {
    id: 1,
    slug: 'pickleball',
    name: 'Pickleball',
    category: 'racket',
    scoringModel: 'side_out',
    isActive: true,
    iconKey: 'racquetball',
    accentColor: '#F97316',
    sortOrder: 3,
    formats: [SINGLES, DOUBLES],
    rulesets: [
      { slug: 'side-out-11', name: 'Side-out · one game to 11', scoringModel: 'side_out', isDefault: true, config: { pointsToWin: 11, winBy: 2, bestOf: 1 } },
      { slug: 'side-out-11x3', name: 'Side-out · best of 3 to 11', scoringModel: 'side_out', config: { pointsToWin: 11, winBy: 2, bestOf: 3 } },
      { slug: 'side-out-15', name: 'Side-out · one game to 15', scoringModel: 'side_out', config: { pointsToWin: 15, winBy: 2, bestOf: 1 } },
      { slug: 'side-out-21', name: 'Side-out · one game to 21', scoringModel: 'side_out', config: { pointsToWin: 21, winBy: 2, bestOf: 1 } },
      {
        slug: 'rally-21',
        name: 'Rally · one game to 21',
        scoringModel: 'rally',
        config: { pointsToWin: 21, winBy: 2, bestOf: 1, serve: { rotation: 'rally_winner', courtByScore: true, nextGameFirstServer: 'alternate' } },
      },
      {
        slug: 'rally-15x3',
        name: 'Rally · best of 3 to 15',
        scoringModel: 'rally',
        config: { pointsToWin: 15, winBy: 2, bestOf: 3, serve: { rotation: 'rally_winner', courtByScore: true, nextGameFirstServer: 'alternate' } },
      },
    ],
  },
  {
    id: 7,
    slug: 'padel',
    name: 'Padel',
    category: 'racket',
    scoringModel: 'tennis',
    isActive: true,
    iconKey: 'tennis-ball',
    accentColor: '#06B6D4',
    sortOrder: 4,
    formats: [DOUBLES],
    rulesets: [
      { slug: 'bo3-advantage', name: 'Best of 3 · advantage', scoringModel: 'tennis', isDefault: true, config: { bestOf: 3, deuce: 'advantage', playersPerSide: [2] } },
      { slug: 'bo3-golden-point', name: 'Best of 3 · golden point', scoringModel: 'tennis', config: { bestOf: 3, deuce: 'golden_point', playersPerSide: [2] } },
      {
        slug: 'bo3-golden-super-tiebreak',
        name: 'Best of 3 · golden point · super tiebreak',
        scoringModel: 'tennis',
        config: { bestOf: 3, deuce: 'golden_point', finalSet: 'match_tiebreak', playersPerSide: [2] },
      },
    ],
  },
  {
    id: 8,
    slug: 'tennis',
    name: 'Tennis',
    category: 'racket',
    scoringModel: 'tennis',
    isActive: true,
    iconKey: 'tennis',
    accentColor: '#84CC16',
    sortOrder: 5,
    formats: [SINGLES, DOUBLES],
    rulesets: [
      { slug: 'bo3-advantage', name: 'Best of 3 · advantage', scoringModel: 'tennis', isDefault: true, config: { bestOf: 3, deuce: 'advantage' } },
      { slug: 'bo3-no-ad', name: 'Best of 3 · no-ad', scoringModel: 'tennis', config: { bestOf: 3, deuce: 'golden_point' } },
      { slug: 'bo3-match-tiebreak', name: 'Best of 3 · match tiebreak', scoringModel: 'tennis', config: { bestOf: 3, deuce: 'advantage', finalSet: 'match_tiebreak' } },
      { slug: 'bo5-advantage', name: 'Best of 5 · advantage', scoringModel: 'tennis', config: { bestOf: 5, deuce: 'advantage' } },
      { slug: 'one-set', name: 'One set · advantage', scoringModel: 'tennis', config: { bestOf: 1, deuce: 'advantage' } },
    ],
  },
  // ----- Not in the MVP: kept, hidden (is_active = false). -----
  {
    id: 4,
    slug: 'volleyball',
    name: 'Volleyball',
    category: 'team',
    scoringModel: 'rally',
    isActive: false,
    iconKey: 'volleyball',
    accentColor: '#14B8A6',
    sortOrder: 50,
    formats: [{ code: 'team', name: 'Team', playersPerSide: 6, minPerSide: 2, maxPerSide: 6 }],
    rulesets: [
      {
        slug: 'bo5-25',
        name: 'Best of 5 · sets to 25',
        scoringModel: 'rally',
        isDefault: true,
        config: { pointsToWin: 25, winBy: 2, bestOf: 5, decidingGamePoints: 15, segmentType: 'set', playersPerSide: [2, 3, 4, 5, 6] },
      },
    ],
  },
  // Football and box cricket need scoring plugins that don't exist yet ("timed_goals", "overs";
  // the old engines are parked in src/engine/scoring/parked). No rulesets until then.
  {
    id: 5,
    slug: 'football',
    name: 'Football',
    category: 'team',
    scoringModel: 'timed_goals',
    isActive: false,
    iconKey: 'soccer',
    accentColor: '#3B82F6',
    sortOrder: 51,
    formats: [{ code: 'team', name: 'Team', playersPerSide: 5, minPerSide: 1, maxPerSide: 11 }],
    rulesets: [],
  },
  {
    id: 6,
    slug: 'box-cricket',
    name: 'Box Cricket',
    category: 'bat_and_ball',
    scoringModel: 'overs',
    isActive: false,
    iconKey: 'cricket',
    accentColor: '#22C55E',
    sortOrder: 52,
    formats: [{ code: 'team', name: 'Team', playersPerSide: 6, minPerSide: 1, maxPerSide: 11 }],
    rulesets: [],
  },
];

export function sportSeed(slug: string): SportSeed {
  const sport = SPORTS.find((s) => s.slug === slug);
  if (!sport) throw new Error(`Unknown sport ${slug}`);
  return sport;
}

export function rulesetConfig(sportSlug: string, rulesetSlug?: string): Record<string, unknown> {
  const sport = sportSeed(sportSlug);
  const ruleset = rulesetSlug ? sport.rulesets.find((r) => r.slug === rulesetSlug) : sport.rulesets.find((r) => r.isDefault);
  if (!ruleset) throw new Error(`Unknown ruleset ${sportSlug}/${rulesetSlug}`);
  return ruleset.config;
}
