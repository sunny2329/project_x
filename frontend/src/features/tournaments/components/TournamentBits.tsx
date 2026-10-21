import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { LIVE, READY, sportText, useTheme } from '@/shared/theme';
import { Badge, D, T, Tap } from '@/shared/ui';
import { clock, weekdayDayMonth } from '@/shared/utils/format';
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

/** "Group A · Court 2 · 10:30". */
export function fixtureMeta(f: FixtureView, withEvent = false): string {
  return [withEvent ? f.event.name : null, f.groupName ?? f.roundName, f.court?.name, f.scheduledAt && f.status !== 'completed' ? clock(f.scheduledAt) : null].filter(Boolean).join(' · ');
}

/** The live score per side as "21 · 14" (games so far, then the running points). */
function liveLine(f: FixtureView, i: number): { done: string; current: string | null } {
  const m = f.match!;
  const done = m.segments.map((s) => s[i]).join(' ');
  return { done, current: m.status === 'live' ? (m.sides[i]?.current ?? null) : null };
}

/**
 * A fixture in lists: LIVE (red border) with the running score, READY with "vs", a finished one
 * with the games, and a dashed placeholder while its entries aren't known yet.
 */
export function FixtureCard({ fixture: f, withEvent = false, mineIds = [], onPress }: { fixture: FixtureView; withEvent?: boolean; mineIds?: string[]; onPress?: () => void }) {
  const { colors } = useTheme();
  const live = f.match?.status === 'live' || f.status === 'live';
  const badge = fixtureBadge(f.status, f.match?.status);
  const finished = f.status === 'completed' && f.match;
  const placeholder = f.status === 'pending' && f.entries.some((e) => !e);
  const tint = sportText(colors, f.event.sport.slug);
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

  return (
    <Tap
      label={`${label(0)} vs ${label(1)}`}
      onPress={open}
      style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: live ? LIVE : colors.line }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T size={12} color={colors.muted} flex numberOfLines={1}>
          {fixtureMeta(f, withEvent)}
        </T>
        {finished ? (
          <T size={12} color={colors.muted}>
            Final
          </T>
        ) : badge ? (
          <Badge label={badge.label} tone={badge.tone} size="xs" />
        ) : null}
      </View>
      {[0, 1].map((i) => {
        const won = f.winnerEntryId !== null && f.entries[i]?.id === f.winnerEntryId;
        const score = f.match && (live || finished) ? liveLine(f, i) : null;
        return (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <T w={finished ? (won ? 700 : 400) : i === 0 || live ? 700 : 600} color={finished && !won ? colors.muted : live && i === 1 ? colors.soft : colors.fg} flex numberOfLines={1}>
              {label(i)}
            </T>
            {score ? (
              <D size={18} color={finished && !won ? colors.muted : live && i === 1 ? colors.soft : colors.fg}>
                {score.done}
                {score.current !== null ? (
                  <D size={18} color={i === 0 ? tint : colors.soft}>
                    {score.done ? ' · ' : ''}
                    {score.current}
                  </D>
                ) : null}
              </D>
            ) : i === 0 && f.status === 'ready' ? (
              <T color={colors.muted}>vs</T>
            ) : null}
          </View>
        );
      })}
    </Tap>
  );
}

export type EventTab = 'matches' | 'groups' | 'bracket' | 'entries';

/** Matches · Groups · Bracket · Entries (Groups and Bracket only when the draw has them). */
export function EventTabs({ event, active }: { event: EventDetail; active: EventTab }) {
  const { colors } = useTheme();
  const hasGroups = event.stages.some((s) => s.type === 'round_robin' || s.groups.length > 1) || event.drawFormat !== 'knockout';
  const hasBracket = event.stages.some((s) => s.type === 'knockout') || event.drawFormat !== 'round_robin';
  const tabs: { key: EventTab; label: string; go: () => void }[] = [
    { key: 'matches', label: 'Matches', go: () => router.replace({ pathname: '/event/[id]', params: { id: event.id } }) },
    ...(hasGroups ? [{ key: 'groups' as const, label: 'Groups', go: () => router.push({ pathname: '/event/[id]/groups', params: { id: event.id } }) }] : []),
    ...(hasBracket ? [{ key: 'bracket' as const, label: 'Bracket', go: () => router.push({ pathname: '/event/[id]/bracket', params: { id: event.id } }) }] : []),
    { key: 'entries', label: 'Entries', go: () => router.push({ pathname: '/event/[id]/entries', params: { id: event.id } }) },
  ];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.raised }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={on ? undefined : t.go} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: on ? 2 : 0, borderBottomColor: colors.primary }}>
            <T size={14} w={on ? 700 : 600} color={on ? colors.fg : colors.muted}>
              {t.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tinted chip (event pages, cards): "● Best of 3 · 21". */
export function InfoChip({ label, dot, tone }: { label: string; dot?: string; tone?: 'progress' | 'ready' | 'neutral' }) {
  const { colors } = useTheme();
  const bg = tone === 'progress' ? 'rgba(255,84,104,0.16)' : tone === 'ready' ? READY : colors.surface;
  const fg = tone === 'progress' ? colors.bad : tone === 'ready' ? colors.ink : colors.fg;
  return (
    <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 8, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} /> : null}
      <T size={12} w={tone ? 800 : 600} ls={tone ? 0.04 : 0} color={fg}>
        {label}
      </T>
    </View>
  );
}
