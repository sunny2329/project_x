import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { READY, useTheme } from '@/shared/theme';
import { D, EmptyState, Header, Icon, Label, Loading, Row, Screen, T, Tap } from '@/shared/ui';
import { tournamentsApi } from '../api/tournaments.api';
import { fixtureSide } from '../components/TournamentBits';
import type { StandingRow, Tiebreaker } from '../types';

const SET_SPORTS = new Set(['tennis', 'padel']);

function tiebreakName(t: Tiebreaker | 'seed', sets: boolean): string {
  switch (t) {
    case 'match_wins':
      return 'matches won';
    case 'head_to_head':
      return 'head to head';
    case 'major_diff':
      return sets ? 'sets ±' : 'games ±';
    case 'minor_diff':
      return sets ? 'games ±' : 'points ±';
    case 'major_won':
      return sets ? 'sets won' : 'games won';
    case 'minor_won':
      return sets ? 'games won' : 'points won';
    case 'seed':
      return 'seeding';
  }
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const short = (name: string) => name.split(' & ').map((p) => p.split(' ')[0]).join(' / ');

/** "Three pairs on 1 win. Arjun / Dev are 2nd on head to head." */
function tieNote(rows: StandingRow[], sets: boolean, pairs: boolean): string | null {
  const split = rows.filter((r) => r.tiebreak && r.tiebreak !== 'match_wins');
  if (!split.length) return null;
  const parts: string[] = [];
  const byWins = new Map<number, StandingRow[]>();
  for (const r of rows) byWins.set(r.won, [...(byWins.get(r.won) ?? []), r]);
  for (const [wins, level] of byWins) {
    if (level.length < 2) continue;
    const count = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][level.length] ?? String(level.length);
    parts.push(`${count} ${pairs ? 'pairs' : 'players'} on ${wins} win${wins === 1 ? '' : 's'}.`);
  }
  for (const r of split) parts.push(`${short(r.name)} ${pairs ? 'are' : 'is'} ${ORDINAL[r.rank] ?? `#${r.rank}`} on ${tiebreakName(r.tiebreak!, sets)}.`);
  return parts.join(' ');
}

/** Group standings: P, W, L, games ±, points ±, qualifiers marked Q, and how ties were broken. */
export default function GroupsScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refreshing, refresh } = useResource(() => tournamentsApi.event(id), [id], { poll: 20_000 });
  const [groupId, setGroupId] = useState<string | null>(null);
  const event = data?.event;

  if (loading) return <Loading />;
  if (!event) {
    return (
      <Screen>
        <Header display="Groups" />
        <EmptyState title="Event not found" body={error ?? undefined} />
      </Screen>
    );
  }

  const stage = event.stages.find((s) => s.type === 'round_robin');
  const groups = stage?.groups ?? [];
  const group = groups.find((g) => g.id === groupId) ?? groups[0] ?? null;
  const sets = SET_SPORTS.has(event.sport.slug);
  const pairs = event.format.playersPerSide > 1;
  const qualifiers = event.drawFormat === 'groups_knockout' ? Number(event.drawConfig.qualifiersPerGroup ?? 2) : 0;
  const rows = group?.standings ?? [];
  const note = tieNote(rows, sets, pairs);
  const order = (event.tiebreakers.length ? event.tiebreakers : (['match_wins', 'head_to_head', 'major_diff', 'minor_diff'] as Tiebreaker[])).map((t) => tiebreakName(t, sets)).join(', ');
  const results = event.fixtures.filter((f) => f.groupId === group?.id && f.status === 'completed' && f.match);

  const cell = (text: string | number, opts: { w?: 400 | 700 | 800; color?: string; width?: number } = {}) => (
    <T size={14} w={opts.w ?? 400} color={opts.color} center style={{ width: opts.width ?? 34 }}>
      {text}
    </T>
  );

  return (
    <Screen gap={16} refreshing={refreshing} onRefresh={refresh}>
      <Header kicker={`${event.tournament.name} · ${event.name}`} display={groups.length > 1 ? 'Groups' : 'Table'} />

      {!group ? (
        <EmptyState title="No groups yet" body="Groups appear once the draw is made." />
      ) : (
        <>
          {groups.length > 1 ? (
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
              {groups.map((g) => {
                const on = g.id === group.id;
                return (
                  <Pressable
                    key={g.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={g.name}
                    onPress={() => setGroupId(g.id)}
                    style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: on ? colors.primary : 'transparent', borderWidth: on ? 0 : 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <D size={20} w={on ? 900 : 800} color={on ? colors.onPrimary : colors.fg}>
                      {g.name.replace(/^Group\s+/i, '')}
                    </D>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={{ borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
            <Row style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
              {cell('#', { width: 26, color: colors.muted, w: 700 })}
              <T size={11} w={700} ls={0.06} color={colors.muted} flex>
                {pairs ? 'PAIR' : 'PLAYER'}
              </T>
              {['P', 'W', 'L', sets ? 'S±' : 'G±', sets ? 'G±' : 'PTS±'].map((h, i) => (
                <T key={h} size={11} w={700} ls={0.06} color={colors.muted} center style={{ width: i > 2 ? 44 : 30 }}>
                  {h}
                </T>
              ))}
            </Row>
            {rows.map((r) => {
              const q = qualifiers > 0 && r.rank <= qualifiers;
              return (
                <Row key={r.entryId} style={{ paddingVertical: 12, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.raised, backgroundColor: q ? 'rgba(74,222,128,0.07)' : 'transparent' }}>
                  {q ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: READY }} /> : null}
                  {cell(r.rank, { width: 26, w: q ? 800 : 400 })}
                  <Row gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <T size={14} w={q ? 700 : 400} color={q ? colors.fg : colors.soft} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {short(r.name)}
                    </T>
                    {q ? (
                      <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: READY }}>
                        <T size={10} w={800} color={colors.ink}>
                          Q
                        </T>
                      </View>
                    ) : null}
                  </Row>
                  {cell(r.played, { width: 30 })}
                  {cell(r.won, { width: 30, w: q ? 800 : 400 })}
                  {cell(r.lost, { width: 30 })}
                  {cell(signed(r.majorWon - r.majorLost), { width: 44 })}
                  {cell(signed(r.minorWon - r.minorLost), { width: 44 })}
                </Row>
              );
            })}
          </View>

          <Row gap={10} style={{ alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.raised }}>
            <Icon name="info" size={18} color={colors.soft} />
            <T size={13} lh={19} color={colors.soft} flex>
              {note ? `${note} ` : ''}Order of tiebreaks: {order}.
            </T>
          </Row>

          {results.length ? (
            <View style={{ gap: 8 }}>
              <Label>{group.name} results</Label>
              {results.map((f) => {
                const w = f.entries.findIndex((e) => e?.id === f.winnerEntryId);
                const winner = w < 0 ? 0 : w;
                const loser = 1 - winner;
                const score = f.match!.segments.map((s) => `${s[winner]}-${s[loser]}`).join(' ');
                return (
                  <Tap key={f.id} label="Result" onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: f.match!.id } })} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface }}>
                    <T size={14} flex numberOfLines={1}>
                      <T size={14} w={700}>
                        {short(fixtureSide(f, winner).name.replace(/ \/ /g, ' & '))}
                      </T>{' '}
                      <T size={14} color={colors.muted}>
                        bt
                      </T>{' '}
                      {short(fixtureSide(f, loser).name.replace(/ \/ /g, ' & '))}
                    </T>
                    <D size={16} w={800}>
                      {score || f.match!.headline}
                    </D>
                  </Tap>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
