import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { useTheme } from '@/shared/theme';
import { D, EmptyState, Header, Loading, Row, Screen, T, Tap } from '@/shared/ui';
import { tournamentsApi } from '../api/tournaments.api';
import { EventHeader, fixtureSide } from '../components/TournamentBits';
import { InfoCallout, PickerChips } from '../components/TournamentV2';
import { groupSub, rowStatus } from '../groups';
import type { StandingRow, Tiebreaker } from '../types';

/** What a sport's major and minor totals are called in the standings. */
function totalWords(slug: string): [string, string] {
  if (slug === 'tennis' || slug === 'padel') return ['sets', 'games'];
  return slug === 'box-cricket' ? ['wins', 'runs'] : ['games', 'points'];
}

function tiebreakName(t: Tiebreaker | 'seed', [major, minor]: [string, string]): string {
  switch (t) {
    case 'match_wins':
      return 'matches won';
    case 'head_to_head':
      return 'head to head';
    case 'major_diff':
      return `${major} ±`;
    case 'minor_diff':
      return `${minor} ±`;
    case 'major_won':
      return major === 'wins' ? 'wins' : `${major} won`;
    case 'minor_won':
      return minor === 'runs' ? 'runs scored' : `${minor} won`;
    case 'seed':
      return 'seeding';
  }
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const short = (name: string) => name.split(' & ').map((p) => p.split(' ')[0]).join(' / ');

/** "Three pairs on 1 win. Arjun / Dev are 2nd on head to head." */
function tieNote(rows: StandingRow[], words: [string, string], pairs: boolean): string | null {
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
  for (const r of split) parts.push(`${short(r.name)} ${pairs ? 'are' : 'is'} ${ORDINAL[r.rank] ?? `#${r.rank}`} on ${tiebreakName(r.tiebreak!, words)}.`);
  return parts.join(' ');
}

/** Group standings (design v2): group chips, P W L ±, qualifiers tinted, "Out on tiebreak", how ties were broken, group matches. */
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
  const words = totalWords(event.sport.slug);
  const pairs = event.format.playersPerSide > 1;
  const qualifiers = event.drawFormat === 'groups_knockout' ? Number(event.drawConfig.qualifiersPerGroup ?? 2) : 0;
  const rows = group?.standings ?? [];
  const note = tieNote(rows, words, pairs);
  const order = (event.tiebreakers.length ? event.tiebreakers : (['match_wins', 'head_to_head', 'major_diff', 'minor_diff'] as Tiebreaker[])).map((t) => tiebreakName(t, words)).join(', ');
  const results = event.fixtures.filter((f) => f.groupId === group?.id && f.status === 'completed' && f.match);
  const complete = groupSub(rows, event.fixtures.filter((f) => f.groupId === group?.id)) !== 'Not started' && event.fixtures.filter((f) => f.groupId === group?.id).every((f) => f.status === 'completed' || f.status === 'bye' || f.status === 'cancelled');

  const cell = (text: string | number, opts: { w?: 400 | 700 | 800; color?: string; width?: number } = {}) => (
    <T size={14} w={opts.w ?? 400} color={opts.color} center style={{ width: opts.width ?? 34 }}>
      {text}
    </T>
  );

  return (
    <Screen edgeToEdge px={0} gap={0} refreshing={refreshing} onRefresh={refresh}>
      <EventHeader event={event} active="groups" />
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 16 }}>

      {!group ? (
        <EmptyState title="No groups yet" body="Groups appear once the draw is made." />
      ) : (
        <>
          {groups.length > 1 ? (
            <PickerChips
              items={groups.map((g) => ({ key: g.id, label: g.name, sub: groupSub(g.standings ?? [], event.fixtures.filter((f) => f.groupId === g.id)) }))}
              value={group.id}
              onChange={setGroupId}
            />
          ) : null}

          <View style={{ borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
            <Row style={{ paddingVertical: 10, paddingHorizontal: 4 }}>
              {cell('#', { width: 26, color: colors.muted, w: 700 })}
              <T size={11} w={700} ls={0.06} color={colors.muted} flex>
                {pairs ? 'PAIR' : 'PLAYER'}
              </T>
              {['P', 'W', 'L', words[0] === 'sets' ? 'S±' : words[0] === 'wins' ? 'W±' : 'G±', words[1] === 'games' ? 'G±' : words[1] === 'runs' ? 'RUN±' : 'PTS±'].map((h, i) => (
                <T key={h} size={11} w={700} ls={0.06} color={colors.muted} center style={{ width: i > 2 ? 44 : 30 }}>
                  {h}
                </T>
              ))}
            </Row>
            {rows.map((r) => {
              const status = rowStatus(r, rows, qualifiers, complete);
              const q = qualifiers > 0 && r.rank <= qualifiers && !r.withdrawn;
              return (
                <Row key={r.entryId} style={{ paddingVertical: 12, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: q ? colors.accentSoft : 'transparent' }}>
                  <D size={18} w={700} center style={{ width: 26 }}>
                    {r.rank}
                  </D>
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <T size={14} w={700} numberOfLines={1}>
                      {short(r.name)}
                      {r.withdrawn ? ' · WD' : ''}
                    </T>
                    {status ? (
                      <T size={11} w={700} color={status.tone === 'good' ? colors.good : colors.bad}>
                        {status.text}
                      </T>
                    ) : null}
                  </View>
                  {cell(r.played, { width: 30 })}
                  {cell(r.won, { width: 30 })}
                  {cell(r.lost, { width: 30 })}
                  {cell(signed(r.majorWon - r.majorLost), { width: 44 })}
                  {cell(signed(r.minorWon - r.minorLost), { width: 44 })}
                </Row>
              );
            })}
          </View>

          {note ? <InfoCallout text={note} /> : null}

          {results.length ? (
            <View style={{ gap: 8 }}>
              <T size={15} w={700}>
                Group matches
              </T>
              {results.map((f) => {
                const w = f.entries.findIndex((e) => e?.id === f.winnerEntryId);
                const winner = w < 0 ? 0 : w;
                const loser = 1 - winner;
                const score = f.match!.segments.map((s) => `${s[winner]}-${s[loser]}`).join(' ');
                return (
                  <Tap key={f.id} label="Result" onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: f.match!.id } })} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
                    <T size={14} flex numberOfLines={1}>
                      <T size={14} w={700}>
                        {short(fixtureSide(f, winner).name.replace(/ \/ /g, ' & '))}
                      </T>{' '}
                      <T size={14} color={colors.muted}>
                        bt
                      </T>{' '}
                      {short(fixtureSide(f, loser).name.replace(/ \/ /g, ' & '))}
                    </T>
                    <D size={18} w={700}>
                      {score || f.match!.headline}
                    </D>
                  </Tap>
                );
              })}
            </View>
          ) : null}

          <T size={12} lh={18} color={colors.muted}>
            {qualifiers ? `Top ${qualifiers} from each group go to the knockout. ` : ''}Tiebreakers: {order}.{rows.some((r) => r.withdrawn) ? ' WD = withdrawn: results stay, ranked last.' : ''}
          </T>
        </>
      )}
      </View>
    </Screen>
  );
}
