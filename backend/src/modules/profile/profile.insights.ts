/*
 * The per-sport "rating & performance" block of a player profile (design v2): rating, tier,
 * confidence, trend, record splits, form, activity, best partner and top rival.
 *
 * `computeInsights` is pure (unit tested); `loadInsights` gathers its inputs in four queries.
 * Sports are never mixed: everything here is for one player in one sport.
 */
import type { Queryable } from '../../database/pool.js';
import { AppError } from '../../utils/app-error.js';
import { UserStatus } from '../auth/auth.types.js';
import { confidenceOf, DEFAULT_RATING, PLACEMENT_MATCHES, tierOf, type Confidence, type TierInfo } from '../../engine/rating/index.js';

/** Opponents this many points above / below count as higher / lower rated. */
export const SIMILAR_BAND = 50;
/** How far back the activity heatmap and match list reach. */
export const ACTIVITY_DAYS = 84;
const RANGE_DAYS = { '1M': 30, '3M': 91, '1Y': 365 } as const;
export type TrendRange = keyof typeof RANGE_DAYS;
/** Matches longer than this (a match left open overnight) don't count toward the average time. */
const MAX_MATCH_MINUTES = 6 * 60;
/** Trend lines are thinned to at most this many points. */
const MAX_TREND_POINTS = 30;
const DAY = 86_400_000;

export interface InsightMatch {
  completedAt: Date;
  startedAt: Date | null;
  won: boolean | null; // null = draw
  /** Top-level segments (games / sets) as [mine, theirs] and who won them (true = me). */
  segments: Array<{ mine: number; theirs: number; wonByMe: boolean | null }>;
  /** Points (or games) for and against across the match. */
  minorFor: number;
  minorAgainst: number;
  partners: Array<{ playerId: string; userId: string | null; name: string }>;
  opponents: Array<{ playerId: string; userId: string | null; name: string }>;
  /** My rating going in and the opponents' average going in; null when the match wasn't rated. */
  ratingBefore: number | null;
  opponentRatingBefore: number | null;
}

export interface InsightInputs {
  now: Date;
  rating: number | null;
  ratedMatches: number;
  /** Every rated match of mine in this sport, oldest first. */
  history: Array<{ at: Date; after: number }>;
  /** Completed matches, newest first. */
  matches: InsightMatch[];
  percentile: { topPercent: number; city: string | null } | null;
  /** Current ratings of the people who may show up as partner / rival. */
  ratingsByPlayer: Map<string, number>;
  minorLabel: string;
  majorLabel: string;
}

export interface Person {
  playerId: string;
  userId: string | null;
  name: string;
  rating: number | null;
  matches: number;
  won: number;
  lost: number;
}

export interface SportInsights {
  rating: number;
  ratedMatches: number;
  provisional: boolean;
  placementsLeft: number;
  confidence: Confidence;
  tier: TierInfo | null;
  delta30: number;
  peak: number;
  percentile: { topPercent: number; city: string | null } | null;
  trend: Record<TrendRange, number[]>;
  record: { played: number; won: number; lost: number; drawn: number; winRate: number | null };
  stats: {
    minorWonPct: number | null;
    avgMinorMargin: number | null;
    deciding: { won: number; lost: number };
    comebacks: number;
    avgMinutes: number | null;
    bestStreak: number;
    minorLabel: string;
    majorLabel: string;
  };
  vsStrength: Array<{ band: 'higher' | 'similar' | 'lower'; won: number; lost: number }>;
  split: { singles: { won: number; lost: number }; doubles: { won: number; lost: number } };
  /** Last 10 results, oldest first. */
  form: Array<'W' | 'L' | 'D'>;
  /** When each match in the last 84 days finished; the app buckets them by its own local day. */
  activity: string[];
  partner: Person | null;
  rival: Person | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Rating at a moment: the last rating at or before it, or the start rating before any match. */
function ratingAt(history: InsightInputs['history'], at: number): number {
  let value = DEFAULT_RATING;
  for (const h of history) {
    if (h.at.getTime() > at) break;
    value = h.after;
  }
  return value;
}

function thin(points: number[]): number[] {
  if (points.length <= MAX_TREND_POINTS) return points;
  const step = (points.length - 1) / (MAX_TREND_POINTS - 1);
  return Array.from({ length: MAX_TREND_POINTS }, (_, i) => points[Math.round(i * step)]!);
}

function person(id: string, list: InsightMatch[], pick: (m: InsightMatch) => InsightMatch['partners'], ratings: Map<string, number>): Person {
  const games = list.filter((m) => pick(m).some((p) => p.playerId === id));
  const latest = pick(games[0]!).find((p) => p.playerId === id)!;
  return {
    playerId: id,
    userId: latest.userId,
    name: latest.name,
    rating: ratings.has(id) ? Math.round(ratings.get(id)!) : null,
    matches: games.length,
    won: games.filter((m) => m.won === true).length,
    lost: games.filter((m) => m.won === false).length,
  };
}

/** The person met most often (ties: the most recent), or null. */
function mostFrequent(list: InsightMatch[], pick: (m: InsightMatch) => InsightMatch['partners'], ratings: Map<string, number>): Person | null {
  const counts = new Map<string, number>();
  for (const m of list) for (const p of pick(m)) counts.set(p.playerId, (counts.get(p.playerId) ?? 0) + 1);
  let best: string | null = null;
  for (const [id, n] of counts) if (best === null || n > counts.get(best)!) best = id; // Map keeps first-seen (newest) order on ties
  return best ? person(best, list, pick, ratings) : null;
}

export function computeInsights(input: InsightInputs): SportInsights {
  const { now, matches, history } = input;
  const nowMs = now.getTime();
  const rating = Math.round(input.rating ?? DEFAULT_RATING);
  const provisional = input.ratedMatches < PLACEMENT_MATCHES;
  const chronological = [...matches].reverse();

  const trend = Object.fromEntries(
    (Object.keys(RANGE_DAYS) as TrendRange[]).map((range) => {
      const from = nowMs - RANGE_DAYS[range] * DAY;
      const inside = history.filter((h) => h.at.getTime() > from).map((h) => Math.round(h.after));
      return [range, inside.length ? thin([Math.round(ratingAt(history, from)), ...inside]) : []];
    }),
  ) as Record<TrendRange, number[]>;

  const won = matches.filter((m) => m.won === true).length;
  const lost = matches.filter((m) => m.won === false).length;
  const drawn = matches.length - won - lost;

  const withScore = matches.filter((m) => m.minorFor + m.minorAgainst > 0);
  const minorFor = withScore.reduce((s, m) => s + m.minorFor, 0);
  const minorAgainst = withScore.reduce((s, m) => s + m.minorAgainst, 0);

  const deciding = { won: 0, lost: 0 };
  let comebacks = 0;
  for (const m of matches) {
    const done = m.segments.filter((g) => g.wonByMe !== null);
    if (done.length >= 2) {
      const beforeLast = done.slice(0, -1);
      const mine = beforeLast.filter((g) => g.wonByMe).length;
      if (mine === beforeLast.length - mine && m.won !== null) deciding[m.won ? 'won' : 'lost'] += 1;
      if (m.won === true && done[0]!.wonByMe === false) comebacks += 1;
    }
  }

  const minutes = matches
    .filter((m) => m.startedAt)
    .map((m) => (m.completedAt.getTime() - m.startedAt!.getTime()) / 60_000)
    .filter((n) => n > 0 && n <= MAX_MATCH_MINUTES);

  let bestStreak = 0;
  let run = 0;
  for (const m of chronological) {
    run = m.won === true ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }

  const bands = { higher: { won: 0, lost: 0 }, similar: { won: 0, lost: 0 }, lower: { won: 0, lost: 0 } };
  for (const m of matches) {
    if (m.ratingBefore === null || m.opponentRatingBefore === null || m.won === null) continue;
    const diff = m.opponentRatingBefore - m.ratingBefore;
    const band = diff >= SIMILAR_BAND ? 'higher' : diff <= -SIMILAR_BAND ? 'lower' : 'similar';
    bands[band][m.won ? 'won' : 'lost'] += 1;
  }

  const split = { singles: { won: 0, lost: 0 }, doubles: { won: 0, lost: 0 } };
  for (const m of matches) {
    if (m.won === null) continue;
    split[m.partners.length ? 'doubles' : 'singles'][m.won ? 'won' : 'lost'] += 1;
  }

  const peak = Math.round(Math.max(rating, ...history.map((h) => h.after)));
  return {
    rating,
    ratedMatches: input.ratedMatches,
    provisional,
    placementsLeft: Math.max(0, PLACEMENT_MATCHES - input.ratedMatches),
    confidence: confidenceOf(input.ratedMatches),
    tier: provisional ? null : tierOf(rating),
    delta30: Math.round(rating - ratingAt(history, nowMs - 30 * DAY)),
    peak,
    percentile: provisional ? null : input.percentile,
    trend,
    record: { played: matches.length, won, lost, drawn, winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null },
    stats: {
      minorWonPct: minorFor + minorAgainst ? Math.round((minorFor / (minorFor + minorAgainst)) * 100) : null,
      avgMinorMargin: withScore.length ? round1((minorFor - minorAgainst) / withScore.length) : null,
      deciding,
      comebacks,
      avgMinutes: minutes.length ? Math.round(minutes.reduce((s, n) => s + n, 0) / minutes.length) : null,
      bestStreak,
      minorLabel: input.minorLabel,
      majorLabel: input.majorLabel,
    },
    vsStrength: (['higher', 'similar', 'lower'] as const).map((band) => ({ band, ...bands[band] })),
    split,
    form: chronological.slice(-10).map((m) => (m.won === true ? 'W' : m.won === false ? 'L' : 'D')),
    activity: matches.filter((m) => m.completedAt.getTime() > nowMs - ACTIVITY_DAYS * DAY).map((m) => m.completedAt.toISOString()),
    partner: mostFrequent(matches, (m) => m.partners, input.ratingsByPlayer),
    rival: mostFrequent(matches, (m) => m.opponents, input.ratingsByPlayer),
  };
}

/** `loadInsights` by sport slug; unknown or inactive sports are a 404. */
export async function insightsFor(db: Queryable, userId: string, sportSlug: string): Promise<SportInsights | null> {
  const { rows } = await db.query<{ id: number }>('SELECT id FROM sports WHERE slug = $1 AND is_active', [sportSlug]);
  if (!rows[0]) throw AppError.notFound('SPORT_NOT_FOUND', 'Sport not found.');
  return loadInsights(db, userId, rows[0].id);
}

/** Most recent completed matches considered (form, splits, partner, rival). */
const MATCH_LIMIT = 500;

interface Summary {
  segments?: Array<{ scores: number[]; winnerSideIndex: number | null; complete: boolean }>;
  totals?: { minor: number[]; minorLabel: string; majorLabel: string };
}

/**
 * Everything `computeInsights` needs for the user's player in `sportId`. Returns null when the
 * user has no player row yet (then the profile shows an unplayed sport).
 */
export async function loadInsights(db: Queryable, userId: string, sportId: number, now = new Date()): Promise<SportInsights | null> {
  const { rows: players } = await db.query<{ playerId: string; rating: number | null; ratedMatches: number | null; city: string | null }>(
    `SELECT p.id AS "playerId", r.rating, r.rated_matches AS "ratedMatches", nullif(trim(pr.city), '') AS city
       FROM players p
       LEFT JOIN player_ratings r ON r.player_id = p.id AND r.sport_id = $2
       LEFT JOIN usr_user_profile pr ON pr.user_id = p.user_id
      WHERE p.user_id = $1`,
    [userId, sportId],
  );
  const me = players[0];
  if (!me) return null;

  type Row = {
    completedAt: Date;
    startedAt: Date | null;
    sideIndex: number;
    outcome: 'won' | 'lost' | 'drawn';
    summary: Summary | null;
    partners: InsightMatch['partners'];
    opponents: InsightMatch['opponents'];
    ratingBefore: number | null;
    opponentRatingBefore: number | null;
  };
  const people = (cond: string) =>
    `coalesce((SELECT json_agg(json_build_object('playerId', o.player_id, 'userId', op.user_id, 'name', op.display_name) ORDER BY o.sort_order)
                 FROM match_participants o JOIN players op ON op.id = o.player_id
                WHERE o.match_id = m.id AND ${cond}), '[]'::json)`;
  const [{ rows: matchRows }, { rows: history }] = await Promise.all([
    db.query<Row>(
      `SELECT m.completed_at AS "completedAt", m.started_at AS "startedAt", ms.side_index AS "sideIndex", ms.outcome::text AS outcome, m.summary,
              ${people('o.side_id = mp.side_id AND o.id <> mp.id')} AS partners,
              ${people('o.side_id <> mp.side_id')} AS opponents,
              (SELECT h.rating_before FROM player_rating_history h WHERE h.match_id = m.id AND h.player_id = mp.player_id) AS "ratingBefore",
              (SELECT avg(h.rating_before) FROM player_rating_history h JOIN match_participants o ON o.player_id = h.player_id AND o.match_id = m.id
                WHERE h.match_id = m.id AND o.side_id <> mp.side_id) AS "opponentRatingBefore"
         FROM match_participants mp
         JOIN match_sides ms ON ms.id = mp.side_id
         JOIN matches m ON m.id = mp.match_id
        WHERE mp.player_id = $1 AND m.sport_id = $2 AND m.status = 'completed' AND ms.outcome IS NOT NULL AND m.completed_at IS NOT NULL
        ORDER BY m.completed_at DESC
        LIMIT $3`,
      [me.playerId, sportId, MATCH_LIMIT],
    ),
    db.query<{ at: Date; after: number }>(
      'SELECT created_at AS at, rating_after AS after FROM player_rating_history WHERE player_id = $1 AND sport_id = $2 ORDER BY created_at',
      [me.playerId, sportId],
    ),
  ]);

  const matches: InsightMatch[] = matchRows.map((r) => {
    const mine = r.sideIndex;
    const other = 1 - mine;
    const segments = (r.summary?.segments ?? [])
      .filter((g) => g.complete)
      .map((g) => ({ mine: g.scores[mine] ?? 0, theirs: g.scores[other] ?? 0, wonByMe: g.winnerSideIndex === null ? null : g.winnerSideIndex === mine }));
    const minor = r.summary?.totals?.minor ?? [];
    return {
      completedAt: r.completedAt,
      startedAt: r.startedAt,
      won: r.outcome === 'drawn' ? null : r.outcome === 'won',
      segments,
      minorFor: minor[mine] ?? 0,
      minorAgainst: minor[other] ?? 0,
      partners: r.partners,
      opponents: r.opponents,
      ratingBefore: r.ratingBefore === null ? null : Number(r.ratingBefore),
      opponentRatingBefore: r.opponentRatingBefore === null ? null : Number(r.opponentRatingBefore),
    };
  });

  const others = [...new Set(matches.flatMap((m) => [...m.partners, ...m.opponents].map((p) => p.playerId)))];
  const ratedMatches = me.ratedMatches ?? 0;
  const [{ rows: otherRatings }, percentile] = await Promise.all([
    others.length
      ? db.query<{ playerId: string; rating: number }>('SELECT player_id AS "playerId", rating FROM player_ratings WHERE sport_id = $1 AND player_id = ANY($2::uuid[])', [sportId, others])
      : Promise.resolve({ rows: [] as Array<{ playerId: string; rating: number }> }),
    me.rating !== null && ratedMatches >= PLACEMENT_MATCHES ? findPercentile(db, sportId, me.rating, me.city) : Promise.resolve(null),
  ]);
  const totals = matchRows.find((r) => r.summary?.totals)?.summary?.totals;
  return computeInsights({
    now,
    rating: me.rating,
    ratedMatches,
    history,
    matches,
    percentile,
    ratingsByPlayer: new Map(otherRatings.map((r) => [r.playerId, r.rating])),
    minorLabel: totals?.minorLabel ?? 'points',
    majorLabel: totals?.majorLabel ?? 'games',
  });
}

/** A percentile needs at least this many placed players to mean anything. */
export const MIN_PERCENTILE_POOL = 5;

/**
 * "Top 12%": the share of the pool rated at or above the player (they count themselves), at
 * least 1%. City first; too few placed players there falls back to everyone; too few overall is null.
 */
export function pickPercentile(city: string | null, inCity: { total: number; above: number }, overall: { total: number; above: number }): { topPercent: number; city: string | null } | null {
  const pct = (c: { total: number; above: number }) => Math.max(1, Math.ceil((c.above / c.total) * 100));
  if (city && inCity.total >= MIN_PERCENTILE_POOL) return { topPercent: pct(inCity), city };
  if (overall.total >= MIN_PERCENTILE_POOL) return { topPercent: pct(overall), city: null };
  return null;
}

/** Counts behind `pickPercentile`: placed players in this sport whose accounts are active. */
async function findPercentile(db: Queryable, sportId: number, rating: number, city: string | null): Promise<{ topPercent: number; city: string | null } | null> {
  const { rows } = await db.query<{ total: number; above: number; cityTotal: number; cityAbove: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE r.rating >= $2)::int AS above,
            count(*) FILTER (WHERE lower(trim(pr.city)) = lower($4))::int AS "cityTotal",
            count(*) FILTER (WHERE lower(trim(pr.city)) = lower($4) AND r.rating >= $2)::int AS "cityAbove"
       FROM player_ratings r
       JOIN players p ON p.id = r.player_id
       JOIN usr_user u ON u.id = p.user_id AND u.status = $5
       LEFT JOIN usr_user_profile pr ON pr.user_id = u.id
      WHERE r.sport_id = $1 AND r.rated_matches >= $3`,
    [sportId, rating, PLACEMENT_MATCHES, city ?? '', UserStatus.ACTIVE],
  );
  const c = rows[0]!;
  return pickPercentile(city, { total: c.cityTotal, above: c.cityAbove }, { total: c.total, above: c.above });
}
