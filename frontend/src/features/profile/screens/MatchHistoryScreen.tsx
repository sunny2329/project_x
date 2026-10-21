import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { useTheme } from '@/shared/theme';
import { Badge, Chip, D, EmptyState, Header, Label, Loading, Notice, Row, Screen, T, Tap } from '@/shared/ui';
import { monthName, shortDay } from '@/shared/utils/format';
import { profileApi } from '../api/profile.api';
import type { MatchHistoryItem } from '../types';

/** The badge on the right: rating change, or AWAITING / RETIRED / WALKOVER / DISPUTED. */
function statusOf(m: MatchHistoryItem): { label: string; tone: 'pending' | 'neutral' | 'bad' } | null {
  if (m.awaiting) return { label: m.awaiting === 'you' ? 'AWAITING\nYOU' : `AWAITING\n${m.awaiting.split(' ')[0]!.toUpperCase()}`, tone: 'pending' };
  if (m.outcome === 'disputed' || m.verification === 'disputed') return { label: 'DISPUTED', tone: 'bad' };
  if (m.resultType === 'retired') return { label: 'RETIRED', tone: 'neutral' };
  if (m.resultType === 'walkover' || m.resultType === 'no_show' || m.resultType === 'double_walkover') return { label: 'WALKOVER', tone: 'neutral' };
  if (m.outcome === 'in_progress') return { label: 'LIVE', tone: 'bad' };
  return null;
}

function title(m: MatchHistoryItem): string {
  const word = m.awaiting ? '' : m.outcome === 'won' ? 'Won' : m.outcome === 'lost' ? 'Lost' : m.outcome === 'draw' ? 'Drew' : '';
  if (m.partners.length && !m.awaiting) return `${word} with ${m.partners.join(' & ')}`;
  return [word, m.opponents.length ? `vs ${m.opponents.join(' & ')}` : ''].filter(Boolean).join(' ') || m.sport.name;
}

function subtitle(m: MatchHistoryItem): string {
  if (m.tournament) return `${shortDay(m.playedAt)} · ${m.tournament.name}${m.tournament.roundName ? ` ${m.tournament.roundName}` : ''}`;
  return `${shortDay(m.playedAt)} · ${m.sport.name}${m.format ? ` ${m.format.toLowerCase()}` : ''}`;
}

function HistoryRow({ m }: { m: MatchHistoryItem }) {
  const { colors } = useTheme();
  const status = statusOf(m);
  const lost = m.outcome === 'lost' || m.outcome === 'disputed';
  const walkover = m.resultType === 'walkover' || m.resultType === 'no_show' || m.resultType === 'double_walkover';
  const open = () => {
    if (m.awaiting === 'you') router.push({ pathname: '/match/[id]/confirm', params: { id: m.matchId } });
    else if (m.outcome === 'in_progress') router.push({ pathname: '/match/[id]', params: { id: m.matchId } });
    else router.push({ pathname: '/match/[id]/result', params: { id: m.matchId } });
  };
  return (
    <Tap label={title(m)} onPress={open} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface }}>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: m.sport.accentColor }} />
      <View style={{ flex: 1, gap: 3 }}>
        <T size={12} color={colors.muted} numberOfLines={1}>
          {subtitle(m)}
        </T>
        <T size={15} w={700} color={lost ? colors.soft : colors.fg} numberOfLines={1}>
          {title(m)}
        </T>
        <D size={18} w={800} color={walkover ? colors.muted : lost ? colors.soft : colors.fg}>
          {walkover ? 'No play' : (m.headline ?? '')}
          {m.resultType === 'retired' ? (
            <D size={14} w={800} color={colors.muted}>
              {' '}
              RETIRED
            </D>
          ) : null}
        </D>
      </View>
      {status ? (
        <Badge label={status.label} tone={status.tone} size="sm" style={{ alignSelf: 'center' }} />
      ) : m.ratingChange !== null && Math.round(m.ratingChange) !== 0 ? (
        <T size={13} w={800} color={m.ratingChange > 0 ? colors.good : colors.bad}>
          {m.ratingChange > 0 ? `+${Math.round(m.ratingChange)}` : Math.round(m.ratingChange)}
        </T>
      ) : null}
    </Tap>
  );
}

/** Every match I played, by month; filter by sport. */
export default function MatchHistoryScreen() {
  const { colors } = useTheme();
  const [sport, setSport] = useState<string | null>(null);
  const { data, error, loading, refreshing, refresh } = useResource(() => profileApi.matches(100, sport ?? undefined), [sport]);
  const all = useResource(() => profileApi.matches(100), []);

  const counts = useMemo(() => all.data?.counts ?? data?.counts ?? {}, [all.data, data]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sportsSeen = useMemo(() => {
    const map = new Map<string, { slug: string; color: string; name: string }>();
    for (const m of all.data?.matches ?? []) map.set(m.sport.slug, { slug: m.sport.slug, color: m.sport.accentColor, name: m.sport.name });
    return [...map.values()].sort((a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0));
  }, [all.data, counts]);

  const groups = useMemo(() => {
    const out: { month: string; items: MatchHistoryItem[] }[] = [];
    for (const m of data?.matches ?? []) {
      const month = monthName(m.playedAt);
      if (out.at(-1)?.month !== month) out.push({ month, items: [] });
      out.at(-1)!.items.push(m);
    }
    return out;
  }, [data]);

  return (
    <Screen gap={14} refreshing={refreshing} onRefresh={refresh}>
      <Header display="Match history" displaySize={32} />
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip label={`All · ${total}`} active={sport === null} onPress={() => setSport(null)} />
        {sportsSeen.map((s) => (
          <Chip key={s.slug} label={String(counts[s.slug] ?? 0)} dot={s.color} active={sport === s.slug} activeColor={s.color} onPress={() => setSport(s.slug)} />
        ))}
      </Row>
      {error ? <Notice tone="error" icon="alert" text={error} /> : null}
      {loading ? <Loading /> : null}
      {groups.map((g) => (
        <View key={g.month} style={{ gap: 8 }}>
          <Label>{g.month}</Label>
          {g.items.map((m) => (
            <HistoryRow key={m.matchId} m={m} />
          ))}
        </View>
      ))}
      {!loading && !groups.length ? (
        <EmptyState title="No matches yet" body="Matches you score or play show up here." />
      ) : null}
      <T size={12} color={colors.faint} center>
        {data && data.matches.length >= 100 ? 'Showing your latest 100 matches.' : ' '}
      </T>
    </Screen>
  );
}
