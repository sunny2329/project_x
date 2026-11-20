import { router } from 'expo-router';
import { View } from 'react-native';
import { LIVE, READY, useTheme, withAlpha } from '@/shared/theme';
import { Badge, D, type IconName, T, Tap } from '@/shared/ui';
import { EventHero, shareTournament } from './TournamentV2';
import { clock, clock12, weekdayDayMonth } from '@/shared/utils/format';
import { roundCode } from '../rounds';
import { fixtureBadge } from '../status';
import type { EventDetail, EventSummary, FixtureView } from '../types';
import { drawFormatLabel } from '../types';

/** "4 groups → top 2 to knockout", "Knockout · 3rd place match", "Round robin". */
export function drawSummary(event: Pick<EventSummary, 'drawFormat' | 'drawConfig'>): string {
  const c = event.drawConfig ?? {};
  if (event.drawFormat === 'groups_knockout') {
    const groups = Number(c.groupCount ?? 0);
    const top = Number(c.qualifiersPerGroup ?? 2);
    return groups ? `${groups} groups → top ${top} to knockout` : 'Groups + knockout';
  }
  if (event.drawFormat === 'round_robin') return Number(c.legs) === 2 ? 'Double round robin' : 'Round robin';
  return c.thirdPlaceMatch ? 'Knockout · 3rd place match' : drawFormatLabel(event.drawFormat);
}

/** "16 pairs" / "32 players". */
export function entriesNoun(playersPerSide: number, n: number): string {
  return `${n} ${playersPerSide > 1 ? (n === 1 ? 'pair' : 'pairs') : n === 1 ? 'player' : 'players'}`;
}

/** Side names for a fixture: the entry, or its placeholder ("Winner QF 2", "1st Group A"). */
export function fixtureSide(f: FixtureView, i: number): { name: string; placeholder: boolean; seed: number | null } {
  const e = f.entries[i];
  if (e) return { name: e.name.replace(/ & /g, ' / '), placeholder: false, seed: e.seed };
  return { name: f.placeholders[i] ?? (f.status === 'bye' ? 'Bye' : 'TBD'), placeholder: true, seed: null };
}

/** "QF1 · Court 2" / "Group A · Court 2 · 10:30". `short` gives "QF2" style round codes and leaves the time to the card. */
export function fixtureMeta(f: FixtureView, withEvent = false, short = false): string {
  const round = f.groupName ?? (short ? roundCode(f) : f.roundName);
  return [withEvent ? f.event.name : null, round, f.court?.name, !short && f.scheduledAt && f.status !== 'completed' ? clock(f.scheduledAt) : null].filter(Boolean).join(' · ');
}


/** The live score per side as "21 · 14" (games so far, then the running points). */
function liveLine(f: FixtureView, i: number): { done: string; current: string | null } {
  const m = f.match!;
  const done = m.segments.map((s) => s[i]).join(' ');
  return { done, current: m.status === 'live' ? (m.sides[i]?.current ?? null) : null };
}

/**
 * A fixture in lists (design v2): live ones tinted with an orange border and the running score, a finished one
 * with the games, and a dashed placeholder while its entries aren't known yet.
 */
export function FixtureCard({ fixture: f, withEvent = false, mineIds = [], onPress }: { fixture: FixtureView; withEvent?: boolean; mineIds?: string[]; onPress?: () => void }) {
  const { colors } = useTheme();
  const live = f.match?.status === 'live' || f.status === 'live';
  const badge = fixtureBadge(f.status, f.match?.status);
  const finished = f.status === 'completed' && f.match;
  const placeholder = f.status === 'pending' && f.entries.some((e) => !e);
  const label = (i: number) => {
    const s = fixtureSide(f, i);
    const mine = f.entries[i]?.players.some((p) => p.userId && mineIds.includes(p.userId));
    return mine ? `You${f.entries[i]!.players.length > 1 ? ` / ${f.entries[i]!.players.filter((p) => !mineIds.includes(p.userId ?? '')).map((p) => p.displayName).join(' / ')}` : ''}` : s.name;
  };
  const open =
    onPress ??
    (() => {
      if (f.match && (live || finished)) router.push({ pathname: live ? '/match/[id]/watch' : '/match/[id]/result', params: { id: f.match.id } });
      else router.push({ pathname: '/fixture/[id]', params: { id: f.id } });
    });

  if (placeholder) {
    return (
      <Tap label={fixtureMeta(f, withEvent)} onPress={open} style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line }}>
        <T size={12} color={colors.muted}>
          {[f.roundName ?? f.stageName, f.scheduledAt ? weekdayDayMonth(f.scheduledAt) : null].filter(Boolean).join(' · ')}
        </T>
        <T size={15} w={600} color={colors.muted}>
          {fixtureSide(f, 0).name}{' '}
          <T size={15} w={400} color={colors.muted}>
            vs
          </T>{' '}
          {fixtureSide(f, 1).name}
        </T>
      </Tap>
    );
  }

  // Right of the meta line: LIVE pill, FINAL (green), the start time, or the fixture's state.
  const right = live ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99, backgroundColor: colors.liveBg }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live }} />
      <T size={11} w={700} color={colors.liveText}>
        LIVE
      </T>
    </View>
  ) : finished ? (
    <T size={11} w={700} ls={0.06} color={colors.good}>
      FINAL
    </T>
  ) : f.scheduledAt ? (
    <T size={12} w={700}>
      {clock12(f.scheduledAt)}
    </T>
  ) : badge ? (
    <Badge label={badge.label} tone={badge.tone} size="xs" />
  ) : null;

  return (
    <Tap
      label={`${label(0)} vs ${label(1)}`}
      onPress={open}
      style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: live ? colors.accentSoft : colors.card, borderWidth: live ? 2 : 1, borderColor: live ? colors.primary : colors.line }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <T size={12} w={700} color={colors.muted} flex numberOfLines={1}>
          {fixtureMeta(f, withEvent, true)}
        </T>
        {right}
      </View>
      {[0, 1].map((i) => {
        const won = f.winnerEntryId !== null && f.entries[i]?.id === f.winnerEntryId;
        const seed = fixtureSide(f, i).seed;
        const score = f.match && (live || finished) ? liveLine(f, i) : null;
        const text = [score?.done, score?.current].filter((x) => x !== null && x !== undefined && x !== '').join(' ');
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {f.entries.some((e) => e?.seed) ? (
              <T size={12} color={colors.muted} style={{ width: 24 }}>
                {seed ? `[${seed}]` : ''}
              </T>
            ) : null}
            <T size={15} w={finished && won ? 700 : 400} color={finished && !won ? colors.muted : colors.fg} flex numberOfLines={1}>
              {label(i)}
            </T>
            <D size={17} w={700} color={finished && !won ? colors.muted : colors.fg}>
              {score ? text || '-' : f.status === 'ready' || f.scheduledAt ? '-' : ''}
            </D>
          </View>
        );
      })}
    </Tap>
  );
}

export type EventTab = 'matches' | 'groups' | 'bracket' | 'entries';

function eventTabs(event: EventDetail): { key: EventTab; label: string; onPress: () => void }[] {
  const hasGroups = event.stages.some((s) => s.type === 'round_robin' || s.groups.length > 1) || event.drawFormat !== 'knockout';
  const hasBracket = event.stages.some((s) => s.type === 'knockout') || event.drawFormat !== 'round_robin';
  return [
    { key: 'matches', label: 'Matches', onPress: () => router.replace({ pathname: '/event/[id]', params: { id: event.id } }) },
    ...(hasBracket ? [{ key: 'bracket' as const, label: 'Draw', onPress: () => router.replace({ pathname: '/event/[id]/bracket', params: { id: event.id } }) }] : []),
    ...(hasGroups ? [{ key: 'groups' as const, label: 'Groups', onPress: () => router.replace({ pathname: '/event/[id]/groups', params: { id: event.id } }) }] : []),
    { key: 'entries', label: 'Entries', onPress: () => router.replace({ pathname: '/event/[id]/entries', params: { id: event.id } }) },
  ];
}

/** "Badminton · Men's Singles · 13 players · Knockout". */
export function eventSubline(event: EventDetail): string {
  const approved = event.entries.filter((e) => e.status === 'approved').length;
  return [event.sport.name, event.name, entriesNoun(event.format.playersPerSide, approved), drawFormatLabel(event.drawFormat).replace('Groups + knockout', 'Groups → KO')].join(' · ');
}

/** Design v2 event header: tournament name, the event line, share, and Matches · Draw · Groups · Entries on the orange. */
export function EventHeader({ event, active, action }: { event: EventDetail; active: EventTab; action?: { icon: IconName; label: string; onPress: () => void } }) {
  return (
    <EventHero
      title={event.tournament.name}
      sub={eventSubline(event)}
      fallback={`/tournament/${event.tournament.id}`}
      action={action ?? { icon: 'upload', label: 'Share the public page', onPress: () => shareTournament(event.tournament.name, event.tournament.slug) }}
      tabs={eventTabs(event)}
      active={active}
    />
  );
}

/** A tinted chip (event pages, cards): "● Best of 3 · 21". */
export function InfoChip({ label, dot, tone }: { label: string; dot?: string; tone?: 'progress' | 'ready' | 'neutral' }) {
  const { colors } = useTheme();
  const bg = tone === 'progress' ? withAlpha(LIVE, 0.16) : tone === 'ready' ? READY : colors.surface;
  const fg = tone === 'progress' ? colors.good : tone === 'ready' ? colors.ink : colors.fg;
  return (
    <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} /> : null}
      <T size={12} w={tone ? 800 : 600} ls={tone ? 0.04 : 0} color={fg}>
        {label}
      </T>
    </View>
  );
}
