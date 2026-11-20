import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { useNow } from '@/shared/hooks/useNow';
import { useResource } from '@/shared/hooks/useResource';
import { sportText, useTheme, withAlpha } from '@/shared/theme';
import { Button, D, Dot, EmptyState, Header, IconButton, Loading, Row, Screen, T } from '@/shared/ui';
import { clockLower, minutes, shortName } from '@/shared/utils/format';
import { matchApi, shareUrl } from '../api/match.api';
import { LivePill } from '@/features/feed/components/HomeBits';
import { HoopsSpectator } from '../components/basketball/Spectator';
import { ThisOver } from '../components/CricketBoard';
import { segmentShort } from '../components/Scoreboard';
import type { MatchView } from '../types';

const POLL_MS = 4_000;


/** Read-only live score: refreshes every 4 s, no scoring buttons. */
export function SpectatorView({ match, reload }: { match: MatchView; reload: () => Promise<unknown> }) {
  const { colors } = useTheme();
  const now = useNow(1000);
  const [updatedAt, setUpdatedAt] = useState(now);
  const ago = Math.max(0, Math.round((now - updatedAt) / 1000));
  const details = useResource(() => matchApi.details(match.id), [match.id]);

  useFocusEffect(
    useCallback(() => {
      if (match.status !== 'live') return undefined;
      const t = setInterval(() => void reload().then(() => setUpdatedAt(Date.now())), POLL_MS);
      return () => clearInterval(t);
    }, [match.status, reload]),
  );

  useEffect(() => {
    if (match.status !== 'live' && match.status !== 'scheduled') router.replace({ pathname: '/match/[id]/result', params: { id: match.id } });
  }, [match.status, match.id]);

  const score = match.score;
  const tint = sportText(colors, match.sport.slug);
  const overs = score.scoringModel === 'overs';
  // Cricket's big number already is the period in play; only finished ones get a column.
  const segs = overs ? score.segments.filter((s) => s.complete) : score.segments;
  const columns = segs.map((s) => ({ key: s.sequence, label: segmentShort(score, s), seg: s }));
  const ratingOf = (playerId: string) => details.data?.details.players.find((p) => p.playerId === playerId)?.rating ?? null;
  const avg = (i: number) => {
    const rs = (match.sides[i]?.players ?? []).map((p) => ratingOf(p.playerId)).filter((r): r is number => r !== null);
    return rs.length ? Math.round(rs.reduce((a, b) => a + b, 0) / rs.length) : null;
  };
  const [a0, a1] = [avg(0), avg(1)];
  const scorers = details.data?.details.scorers.map((s) => shortName(s.name)).join(', ');
  const elapsed = match.startedAt ? minutes((now - Date.parse(match.startedAt)) / 1000) : null;
  const share = () => void Share.share({ message: `Watch live: ${match.sides.map((s) => s.name).join(' vs ')}\n${shareUrl(match)}`, url: shareUrl(match) });

  return (
    <Screen gap={18}>
      <Row between>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Row gap={8}>
          <LivePill />
          <T size={12} color={colors.muted}>
            Updated {ago < 2 ? 'just now' : `${ago}s ago`}
          </T>
        </Row>
        <IconButton icon="share" label="Share" onPress={share} />
      </Row>

      <View style={{ gap: 4 }}>
        <Row gap={8}>
          <Dot color={match.sport.accentColor} />
          <T size={13} w={700} upper color={tint}>
            {match.sport.name} · {match.format.name}
          </T>
        </Row>
        <T size={14} color={colors.muted}>
          {[match.ruleset.name, [match.court?.name, match.venue?.name].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
        </T>
      </View>

      {score.scoringModel === 'baskets' && score.game ? (
        <HoopsSpectator match={match} />
      ) : (
        <>
          <View style={{ borderRadius: 24, backgroundColor: colors.hero, paddingHorizontal: 18, paddingVertical: 4 }}>
            {[0, 1].map((i) => {
              const side = score.sides[i]!;
              const prev = overs ? '' : columns.filter((c) => c.seg.complete).map((c) => c.seg.display[i]).join(' ');
              const sub = [side.serving ? `● ${overs ? 'Batting' : 'Serving'}${side.serveNote ? ` · ${side.serveNote}` : ''}` : null].filter(Boolean).join('');
              const name = match.sides[i]?.players.length === 1 ? match.sides[i]!.players[0]!.displayName : (match.sides[i]?.players.map((p) => shortName(p.displayName)).join(' & ') || match.sides[i]?.name) ?? '';
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: withAlpha(colors.onHero, 0.35) }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={17} w={700} color={colors.onHero} numberOfLines={2}>
                      {name}
                    </T>
                    {sub ? (
                      <T size={12} color={colors.heroMuted}>
                        {sub}
                      </T>
                    ) : null}
                  </View>
                  {prev ? (
                    <D size={20} w={500} color={colors.heroMuted}>
                      {prev}
                    </D>
                  ) : null}
                  <D size={overs ? 38 : 56} lh={overs ? 40 : 52} color={colors.onHero} right style={{ minWidth: 64 }} numberOfLines={1}>
                    {side.current ?? side.primary}
                  </D>
                </View>
              );
            })}
          </View>
          {score.callout && score.scoringModel !== 'side_out' ? (
            <View style={{ alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: colors.accentSoft }}>
              <T size={13} w={700} color={colors.accentText}>
                {score.callout}
              </T>
            </View>
          ) : null}

          {overs ? <ThisOver marks={score.ticker ?? []} /> : null}
        </>
      )}

      <View style={{ gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.surface }}>
        {match.startedAt ? (
          <Row between>
            <T size={14} color={colors.muted}>
              Started
            </T>
            <T size={14} w={600}>
              {clockLower(match.startedAt)}
              {elapsed ? ` · ${elapsed}` : ''}
            </T>
          </Row>
        ) : null}
        {scorers ? (
          <Row between>
            <T size={14} color={colors.muted}>
              Scored by
            </T>
            <T size={14} w={600}>
              {scorers}
            </T>
          </Row>
        ) : null}
        {a0 !== null && a1 !== null ? (
          <Row between>
            <T size={14} color={colors.muted}>
              Ratings
            </T>
            <T size={14} w={600}>
              {match.sides[0]!.players.length > 1 ? `${a0} avg vs ${a1} avg` : `${a0} vs ${a1}`}
            </T>
          </Row>
        ) : null}
      </View>

      <View style={{ marginTop: 'auto', gap: 10 }}>
        {match.canScore ? (
          <Button label="Resume scoring" variant="outline" onPress={() => router.replace({ pathname: '/match/[id]', params: { id: match.id } })} />
        ) : (
          <T size={13} color={colors.muted} center>
            You’re watching. Only the scorer can change the score.
          </T>
        )}
        <Button label="Share live link" icon="share" weight={800} onPress={share} />
      </View>
    </Screen>
  );
}

/** /match/[id]/watch: the spectator screen from Home's live strip. */
export default function SpectatorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<MatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(
    () =>
      matchApi.get(id).then(
        (r) => {
          setMatch(r.match);
          setError(null);
        },
        (e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the match.'),
      ),
    [id],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  if (!match) {
    return error ? (
      <Screen>
        <Header />
        <EmptyState title="Couldn’t load the match" body={error} />
      </Screen>
    ) : (
      <Loading />
    );
  }
  return <SpectatorView match={match} reload={reload} />;
}
