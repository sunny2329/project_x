/*
 * Design v2 Home pieces: the "Start a friendly match" hero, a live-now card, a tournament row
 * and a recent-result row.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import type { MatchCard } from '@/features/match/types';
import type { MatchHistoryItem } from '@/features/profile/types';
import type { TournamentListItem } from '@/features/tournaments/types';
import { signed } from '@/shared/rating';
import { useTheme } from '@/shared/theme';
import { D, Icon, sportIcon, T, Tap } from '@/shared/ui';
import { resultLine, resultTitle } from '../home';

export function LivePill({ label = 'LIVE' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 99, backgroundColor: colors.liveBg }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live }} />
      <T size={11} w={700} color={colors.liveText}>
        {label}
      </T>
    </View>
  );
}

/** Orange card: title, "+" button, one chip per sport (each opens setup on that sport). */
export function StartMatchHero({ sports }: { sports: { slug: string; name: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.hero, borderRadius: 22, padding: 20, gap: 14 }}>
      {/* Title row and chips are separate buttons (no button inside a button on the web). */}
      <Tap label="Start a friendly match" onPress={() => router.push('/match/new')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <D size={28} lh={28} color={colors.onHero}>
            Start a friendly match
          </D>
          <T size={13} color={colors.heroMuted}>
            Score live in 3 taps. Guests welcome.
          </T>
        </View>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.onHero, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={22} color={colors.primary} strokeWidth={2.4} />
        </View>
      </Tap>
      {sports.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sports.map((s) => (
            <Tap
              key={s.slug}
              label={`Start a ${s.name} match`}
              onPress={() => router.push({ pathname: '/match/new', params: { sport: s.slug } })}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 99, backgroundColor: colors.heroChip }}
            >
              <T size={12} color={colors.onHero}>
                {s.name}
              </T>
            </Tap>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Full-width live card: context line + LIVE, then each side with games won and the current score. */
export function LiveNowCard({ match }: { match: MatchCard }) {
  const { colors } = useTheme();
  const [a, b] = match.score.sides;
  const num = (s: typeof a) => Number.parseFloat(s?.current ?? s?.primary ?? '');
  const leading = Number.isNaN(num(a)) || Number.isNaN(num(b)) || num(a) === num(b) ? null : num(a) > num(b) ? 0 : 1;
  return (
    <Tap
      label={`${match.sides.map((s) => s.name).join(' vs ')}, live`}
      onPress={() => router.push({ pathname: '/match/[id]/watch', params: { id: match.id } })}
      style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <T size={12} color={colors.muted} flex numberOfLines={1}>
          {[match.sport.name, match.context === 'tournament' ? 'Tournament' : 'Friendly', match.score.callout].filter(Boolean).join(' · ')}
        </T>
        <LivePill />
      </View>
      {match.sides.map((side) => {
        const s = match.score.sides.find((x) => x.index === side.index);
        const lead = leading === side.index;
        return (
          <View key={side.index} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <T size={15} w={lead ? 700 : 400} flex numberOfLines={1}>
              {side.name}
            </T>
            {s?.current !== null && s?.current !== undefined ? (
              <D size={16} w={500} color={colors.muted}>
                {s.primary}
              </D>
            ) : null}
            <D size={22} color={lead ? colors.primary : colors.fg} right style={{ minWidth: 26 }}>
              {s?.current ?? s?.primary ?? ''}
            </D>
          </View>
        );
      })}
    </Tap>
  );
}

export function TournamentRow({ tournament: t, line }: { tournament: TournamentListItem; line: string }) {
  const { colors } = useTheme();
  const multi = t.sports.length > 1;
  return (
    <Tap
      label={t.name}
      onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={multi || !t.sports[0] ? 'trophy' : sportIcon(t.sports[0].iconKey)} size={22} color={colors.accentText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} w={700} numberOfLines={1}>
          {t.name}
        </T>
        <T size={12} color={colors.muted} numberOfLines={2}>
          {line}
        </T>
      </View>
      <Icon name="chevronRight" size={18} color={colors.muted} />
    </Tap>
  );
}

export function ResultRow({ match: m, last }: { match: MatchHistoryItem; last?: boolean }) {
  const { colors } = useTheme();
  const change = m.ratingChange === null ? null : Math.round(m.ratingChange);
  return (
    <Tap
      label={resultTitle(m)}
      onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: m.matchId } })}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T size={14} w={500} numberOfLines={1}>
          {resultTitle(m)}
        </T>
        <T size={12} color={colors.muted} numberOfLines={1}>
          {resultLine(m)}
        </T>
      </View>
      {change !== null ? (
        <View style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: change >= 0 ? colors.goodBg : colors.badBg }}>
          <T size={12} w={700} color={change >= 0 ? colors.good : colors.bad}>
            {signed(change)}
          </T>
        </View>
      ) : null}
    </Tap>
  );
}
