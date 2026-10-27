import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { LIVE, sportText, useTheme } from '@/shared/theme';
import { Button, Chip, D, EmptyState, Header, Icon, Loading, Row, Screen, T, Tap } from '@/shared/ui';
import { clock, weekdayDay } from '@/shared/utils/format';
import { tournamentsApi } from '../api/tournaments.api';
import { fixtureSide } from '../components/TournamentBits';
import type { FixtureView } from '../types';

const CARD_W = 180;
const CARD_H = 76;
const GAP_X = 48;
const GAP_Y = 20;

/** "QF 1", "SF 2", "FINAL". */
function shortRound(name: string | null, position: number): string {
  if (!name) return `M${position}`;
  if (/^final$/i.test(name)) return 'FINAL';
  const words = name.match(/\b([A-Za-z])/g)?.join('').toUpperCase() ?? name;
  return `${words.replace(/F$/, 'F')} ${position}`;
}

/** The footer line on a bracket card: "QF 1 · FINAL", "LIVE · COURT 2", "READY · COURT 4 · 11:30", "SF 1 · WAITING". */
function cardFoot(f: FixtureView): { text: string; tone: 'muted' | 'live' | 'ready' | 'accent' } {
  const tag = shortRound(f.roundName, f.position);
  if (f.match?.status === 'live' || f.status === 'live') return { text: ['LIVE', f.court?.name?.toUpperCase()].filter(Boolean).join(' · '), tone: 'live' };
  if (f.status === 'ready') return { text: ['READY', f.court?.name?.toUpperCase(), f.scheduledAt ? clock(f.scheduledAt) : null].filter(Boolean).join(' · '), tone: 'ready' };
  if (f.status === 'bye') return { text: `${tag} · BYE`, tone: 'muted' };
  if (f.status === 'completed') return { text: `${tag} · FINAL`, tone: 'muted' };
  if (tag === 'FINAL' && f.scheduledAt) return { text: `FINAL · ${weekdayDay(f.scheduledAt).toUpperCase().split(' ')[0]} ${clock(f.scheduledAt)}`, tone: 'accent' };
  return { text: `${tag} · WAITING`, tone: tag === 'FINAL' ? 'accent' : 'muted' };
}

function BracketCard({ f, slug, x, y }: { f: FixtureView; slug: string; x: number; y: number }) {
  const { colors } = useTheme();
  const live = f.match?.status === 'live' || f.status === 'live';
  const final = /^final$/i.test(f.roundName ?? '');
  const foot = cardFoot(f);
  const footColor = { muted: colors.muted, live: colors.bad, ready: colors.good, accent: colors.primary }[foot.tone];
  const open = f.match ? () => router.push({ pathname: live ? '/match/[id]/watch' : '/match/[id]/result', params: { id: f.match!.id } }) : () => router.push({ pathname: '/fixture/[id]', params: { id: f.id } });
  return (
    <Tap
      label={`${fixtureSide(f, 0).name} vs ${fixtureSide(f, 1).name}`}
      onPress={open}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: CARD_W,
        height: CARD_H,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: final ? colors.accentDeep : colors.surface,
        borderWidth: live ? 1.5 : 1,
        borderColor: live ? LIVE : final ? colors.accentLine : colors.line,
        justifyContent: 'space-between',
      }}
    >
      {[0, 1].map((i) => {
        const side = fixtureSide(f, i);
        const won = f.winnerEntryId !== null && f.entries[i]?.id === f.winnerEntryId;
        const lost = f.status === 'completed' && !won;
        const segs = f.match?.segments ?? [];
        const current = live ? f.match?.sides[i]?.current : null;
        const advanced = f.status === 'bye' && !side.placeholder;
        return (
          <Row key={i} gap={6}>
            <T size={13} color={colors.muted} style={{ width: 14 }}>
              {side.seed ?? ''}
            </T>
            <T size={13} w={side.placeholder ? 400 : won || live || f.status === 'ready' ? 700 : 600} italic={side.placeholder} color={side.placeholder ? colors.faint : lost ? colors.muted : colors.fg} flex numberOfLines={1}>
              {side.name}
            </T>
            {advanced ? (
              <T size={11} w={800} color={colors.good}>
                ADV
              </T>
            ) : segs.length || current ? (
              <D size={15} w={900} color={lost ? colors.muted : colors.fg}>
                {segs.map((s) => s[i]).join(' ')}
                {current !== null && current !== undefined ? (
                  <D size={15} color={i === 0 ? sportText(colors, slug) : colors.fg}>
                    {segs.length ? ' ' : ''}
                    {current}
                  </D>
                ) : null}
              </D>
            ) : null}
          </Row>
        );
      })}
      <Row gap={6}>
        {foot.tone === 'live' ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: LIVE }} /> : null}
        <T size={10} w={foot.tone === 'muted' ? 400 : 800} ls={0.06} color={footColor} numberOfLines={1}>
          {foot.text}
        </T>
      </Row>
    </Tap>
  );
}

/** Knockout bracket: one column per round with lines into the next; tap a round to scroll to it. */
export default function BracketScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refreshing, refresh } = useResource(() => tournamentsApi.event(id), [id], { poll: 15_000 });
  const scroller = useRef<ScrollViewInstance>(null);
  const [round, setRound] = useState<number | null>(null);
  const event = data?.event;

  const layout = useMemo(() => {
    if (!event) return null;
    const stage = [...event.stages].reverse().find((s) => s.type === 'knockout');
    if (!stage) return null;
    const all = event.fixtures.filter((f) => f.stageId === stage.id);
    // A 3rd-place match sits outside the tree.
    const third = all.find((f) => /3rd|third/i.test(f.roundName ?? ''));
    const tree = all.filter((f) => f !== third);
    const rounds = [...new Set(tree.map((f) => f.round))].sort((a, b) => a - b);
    const columns = rounds.map((r) => tree.filter((f) => f.round === r).sort((a, b) => a.position - b.position));
    const first = columns[0]?.length ?? 0;
    const height = Math.max(1, first) * (CARD_H + GAP_Y) - GAP_Y;
    const pos = columns.map((col, c) =>
      col.map((_, i) => {
        const slot = (height + GAP_Y) / col.length;
        return { x: c * (CARD_W + GAP_X), y: slot * i + (slot - GAP_Y - CARD_H) / 2 };
      }),
    );
    return { stage, columns, pos, third, height, width: columns.length * (CARD_W + GAP_X) - GAP_X };
  }, [event]);

  if (loading) return <Loading />;
  if (!event) {
    return (
      <Screen>
        <Header display="Bracket" />
        <EmptyState title="Event not found" body={error ?? undefined} />
      </Screen>
    );
  }

  const line = colors.line2;
  return (
    <Screen px={0} gap={16} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ paddingHorizontal: 20 }}>
        <Header kicker={`${event.tournament.name} · ${event.name}`} display="Bracket" />
      </View>

      {!layout ? (
        <View style={{ paddingHorizontal: 20 }}>
          <EmptyState title="No bracket yet" body={event.drawFormat === 'groups_knockout' ? 'The knockout bracket appears when the groups finish.' : 'The bracket appears once the draw is made.'} />
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {layout.columns.map((col, c) => (
              <Chip
                key={c}
                label={col[0]?.roundName ?? `Round ${c + 1}`}
                active={(round ?? 0) === c}
                height={34}
                onPress={() => {
                  setRound(c);
                  scroller.current?.scrollTo({ x: c * (CARD_W + GAP_X), animated: true });
                }}
              />
            ))}
          </ScrollView>

          <ScrollView
            ref={scroller}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 4 }}
            onScroll={(e) => setRound(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP_X)))}
            scrollEventThrottle={64}
          >
            <View style={{ width: layout.width, height: layout.height }}>
              {/* Connectors: from each pair of cards into the card they feed. */}
              {layout.columns.slice(0, -1).map((col, c) =>
                col.map((_, i) => {
                  if (i % 2) return null;
                  const a = layout.pos[c]![i]!;
                  const b = layout.pos[c]![i + 1] ?? a;
                  const next = layout.pos[c + 1]![Math.floor(i / 2)];
                  if (!next) return null;
                  const ya = a.y + CARD_H / 2;
                  const yb = b.y + CARD_H / 2;
                  const x0 = a.x + CARD_W;
                  const mid = x0 + GAP_X / 2;
                  return (
                    <View key={`${c}-${i}`} pointerEvents="none">
                      <View style={{ position: 'absolute', left: x0, top: ya - 1, width: GAP_X / 2, height: 2, backgroundColor: line }} />
                      <View style={{ position: 'absolute', left: x0, top: yb - 1, width: GAP_X / 2, height: 2, backgroundColor: line }} />
                      <View style={{ position: 'absolute', left: mid - 1, top: ya - 1, width: 2, height: yb - ya + 2, backgroundColor: line }} />
                      <View style={{ position: 'absolute', left: mid, top: next.y + CARD_H / 2 - 1, width: GAP_X / 2, height: 2, backgroundColor: line }} />
                    </View>
                  );
                }),
              )}
              {layout.columns.map((col, c) => col.map((f, i) => <BracketCard key={f.id} f={f} slug={event.sport.slug} x={layout.pos[c]![i]!.x} y={layout.pos[c]![i]!.y} />))}
            </View>
          </ScrollView>

          <View style={{ gap: 10, paddingHorizontal: 20 }}>
            {layout.third ? (
              <Tap
                label="3rd place match"
                onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: layout.third!.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line }}
              >
                <Icon name="cup" size={18} color={colors.muted} />
                <T size={13} color={colors.muted} flex>
                  3rd place · {fixtureSide(layout.third, 0).name} vs {fixtureSide(layout.third, 1).name}
                </T>
              </Tap>
            ) : null}
            <Row gap={16}>
              <T size={12} color={colors.muted}>
                Numbers are seeds
              </T>
              <T size={12} color={colors.muted}>
                Winners move on by themselves
              </T>
            </Row>
            {event.podium?.champion ? (
              <Button label="See the podium" icon="trophy" height={48} radius={14} size={14} onPress={() => router.push({ pathname: '/event/[id]/podium', params: { id: event.id } })} />
            ) : (
              <Button label="Podium appears after the final" variant="outline" height={48} radius={14} size={14} disabled />
            )}
          </View>
        </>
      )}
    </Screen>
  );
}
