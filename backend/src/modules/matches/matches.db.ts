import { randomBytes } from 'node:crypto';
import type { DbTx } from '../../database/prisma.js';
import { createScorer, replay, scoringRegistry, type ScoreSummary, type Scorer, type SegmentSummary } from '../../engine/scoring/index.js';
import { toPlayerRef } from '../players/players.service.js';
import type { LiveEvent, LiveState } from './live/live-store.js';
import type { MatchStatic, MatchStatusName } from './matches.types.js';

export const newShareToken = () => randomBytes(16).toString('base64url');

const matchInclude = {
  sport: true,
  sportFormat: true,
  ruleset: { select: { id: true, name: true } },
  venue: { select: { id: true, name: true } },
  court: { select: { id: true, name: true } },
  sides: {
    orderBy: { sideIndex: 'asc' },
    include: { participants: { orderBy: { sortOrder: 'asc' }, include: { player: true } } },
  },
  fixture: { include: { stage: { include: { event: { include: { tournament: { select: { id: true, slug: true, name: true } } } } } } } },
  scorers: { select: { userId: true } },
} as const;

export type MatchRecord = NonNullable<Awaited<ReturnType<typeof findMatchRecord>>>;

export function findMatchRecord(db: DbTx, matchId: string) {
  return db.match.findUnique({ where: { id: matchId }, include: matchInclude });
}

export function toStatic(m: MatchRecord): MatchStatic {
  const fixture = m.fixture;
  return {
    id: m.id,
    context: m.context,
    sport: { id: String(m.sport.id), slug: m.sport.slug, name: m.sport.name, iconKey: m.sport.iconKey, accentColor: m.sport.accentColor },
    format: { code: m.sportFormat.code, name: m.sportFormat.name, playersPerSide: m.sportFormat.playersPerSide },
    ruleset: { id: m.ruleset?.id ?? null, name: m.ruleset?.name ?? null, scoringModel: m.scoringModel },
    scoringMode: m.scoringMode,
    shareToken: m.shareToken,
    createdByUserId: m.createdByUserId,
    venue: m.venue,
    court: m.court,
    tournament: fixture
      ? {
          tournamentId: fixture.stage.event.tournament.id,
          slug: fixture.stage.event.tournament.slug,
          name: fixture.stage.event.tournament.name,
          eventId: fixture.stage.event.id,
          eventName: fixture.stage.event.name,
          fixtureId: fixture.id,
          roundName: fixture.roundName,
        }
      : null,
    sides: m.sides.map((side) => {
      const players = side.participants.map((p) => toPlayerRef(p.player));
      return {
        index: side.sideIndex,
        name: side.name ?? players.map((p) => p.displayName.split(' ')[0]).join(' & '),
        teamId: side.teamId,
        entryId: side.entryId,
        players,
        outcome: side.outcome,
      };
    }),
  };
}

/** Everyone who may score: assigned scorers, the court's scorers, and the tournament's organizers. */
export async function scorerUserIds(db: DbTx, m: MatchRecord): Promise<string[]> {
  const ids = new Set(m.scorers.map((s) => s.userId));
  if (m.courtId) for (const s of await db.courtScorer.findMany({ where: { courtId: m.courtId } })) ids.add(s.userId);
  const tournamentId = m.fixture?.stage.event.tournament.id;
  if (tournamentId) {
    const t = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { organizerUserId: true } });
    ids.add(t.organizerUserId);
    const staff = await db.tournamentStaff.findMany({ where: { tournamentId, role: { in: ['organizer', 'co_organizer'] } } });
    for (const s of staff) ids.add(s.userId);
  }
  return [...ids];
}

export function scorerFor(scoringModel: string, config: unknown, view: Pick<MatchStatic, 'sides'>): Scorer {
  return createScorer(scoringRegistry, scoringModel, config, view.sides.map((s) => ({ index: s.index, playerCount: s.players.length })));
}

export const activeEvents = (events: LiveEvent[]) => events.filter((e) => !e.voided).map((e) => e.payload);

/** Every event and every undo bumps the version. */
export const versionOf = (events: Array<{ voided: boolean }>) => events.length + events.filter((e) => e.voided).length;

export async function loadLiveState(db: DbTx, matchId: string): Promise<LiveState | null> {
  const m = await findMatchRecord(db, matchId);
  if (!m) return null;
  const rows = await db.matchEvent.findMany({ where: { matchId }, orderBy: { sequence: 'asc' }, include: { side: { select: { sideIndex: true } } } });
  const events: LiveEvent[] = rows.map((e) => ({
    sequence: e.sequence,
    type: e.type,
    sideIndex: e.side?.sideIndex ?? null,
    payload: e.payload as Record<string, unknown>,
    clientEventId: e.clientEventId,
    occurredAt: e.occurredAt.toISOString(),
    voided: e.voidedAt !== null,
  }));
  return {
    version: versionOf(events),
    match: {
      id: m.id,
      status: m.status as MatchStatusName,
      scoringModel: m.scoringModel,
      rulesetConfig: m.rulesetConfig,
      startedAt: m.startedAt?.toISOString() ?? null,
      scorerUserIds: await scorerUserIds(db, m),
      view: toStatic(m),
    },
    events,
  };
}

export function summaryOf(state: Pick<LiveState, 'match' | 'events'>): ScoreSummary {
  return replay(scorerFor(state.match.scoringModel, state.match.rulesetConfig, state.match.view), activeEvents(state.events)).summary;
}

interface FlatSegment {
  path: string;
  parentPath: string | null;
  segment: SegmentSummary;
}

function flatten(segments: SegmentSummary[], parentPath: string | null = null): FlatSegment[] {
  return segments.flatMap((segment) => {
    const path = `${parentPath ? `${parentPath}/` : ''}${segment.type}:${segment.sequence}`;
    return [{ path, parentPath, segment }, ...flatten(segment.children, path)];
  });
}

/**
 * Makes match_segments / match_segment_scores mirror the summary's segment tree (inserting new
 * segments, updating changed ones, deleting ones an undo removed). A projection: always
 * rebuildable from match_events.
 */
export async function syncSegments(db: DbTx, matchId: string, sideIds: string[], segments: SegmentSummary[]): Promise<void> {
  const existing = await db.matchSegment.findMany({ where: { matchId }, include: { scores: true } });
  const byId = new Map(existing.map((s) => [s.id, s]));
  const pathOf = (s: (typeof existing)[number]): string => {
    const own = `${s.type}:${s.sequence}`;
    const parent = s.parentId ? byId.get(s.parentId) : undefined;
    return parent ? `${pathOf(parent)}/${own}` : own;
  };
  const current = new Map(existing.map((s) => [pathOf(s), s]));
  const wanted = flatten(segments);
  const ids = new Map<string, string>();
  const now = new Date();

  for (const { path, parentPath, segment } of wanted) {
    const winnerSideId = segment.winnerSideIndex === null ? null : sideIds[segment.winnerSideIndex]!;
    const status = segment.complete ? 'completed' : 'in_progress';
    const found = current.get(path);
    if (!found) {
      const created = await db.matchSegment.create({
        data: {
          matchId,
          parentId: parentPath ? ids.get(parentPath)! : null,
          type: segment.type,
          sequence: segment.sequence,
          status,
          winnerSideId,
          endedAt: segment.complete ? now : null,
          scores: { create: segment.scores.map((score, i) => ({ sideId: sideIds[i]!, score })) },
        },
      });
      ids.set(path, created.id);
      continue;
    }
    ids.set(path, found.id);
    if (found.status !== status || found.winnerSideId !== winnerSideId) {
      await db.matchSegment.update({ where: { id: found.id }, data: { status, winnerSideId, endedAt: segment.complete ? (found.endedAt ?? now) : null } });
    }
    for (const [i, score] of segment.scores.entries()) {
      const sideId = sideIds[i]!;
      const old = found.scores.find((s) => s.sideId === sideId);
      if (!old) await db.matchSegmentScore.create({ data: { segmentId: found.id, sideId, score } });
      else if (old.score !== score) await db.matchSegmentScore.update({ where: { segmentId_sideId: { segmentId: found.id, sideId } }, data: { score } });
    }
  }
  const stale = [...current.entries()].filter(([path]) => !ids.has(path)).map(([, s]) => s.id);
  if (stale.length) await db.matchSegment.deleteMany({ where: { id: { in: stale } } });
}
