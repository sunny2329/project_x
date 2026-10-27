import { router } from 'expo-router';
import { View } from 'react-native';
import { sportText, useTheme, withAlpha } from '@/shared/theme';
import { D, Dot, T, Tap } from '@/shared/ui';
import { shortDay } from '@/shared/utils/format';
import type { MatchHistoryItem, PlayerSport } from '../types';

/** "72 played · 68% won". */
export function playedLine(s: Pick<PlayerSport, 'matchesPlayed' | 'matchesWon'>): string {
  const pct = s.matchesPlayed ? Math.round((s.matchesWon / s.matchesPlayed) * 100) : 0;
  return `${s.matchesPlayed} played · ${pct}% won`;
}

/** Tinted rating card per sport (two per row). */
export function SportRatingCard({ sport }: { sport: PlayerSport }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '48.5%', flexGrow: 1, padding: 14, borderRadius: 16, backgroundColor: withAlpha(sport.accentColor, 0.12), borderWidth: 1, borderColor: withAlpha(sport.accentColor, 0.35), gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Dot color={sport.accentColor} />
        <T size={12} w={700} upper color={sportText(colors, sport.slug)} numberOfLines={1}>
          {sport.name}
        </T>
      </View>
      <D size={36} lh={36}>
        {Math.round(sport.rating)}
      </D>
      <T size={12} color={colors.soft}>
        {playedLine(sport)}
      </T>
    </View>
  );
}

/** "Won with Riya S" / "Lost vs Arjun T" / "In progress". */
export function historyTitle(m: MatchHistoryItem): string {
  const word = { won: 'Won', lost: 'Lost', draw: 'Drew', in_progress: 'Playing', disputed: 'Disputed' }[m.outcome];
  if (m.partners.length) return `${word} with ${m.partners.join(' & ')}`;
  if (m.opponents.length) return `${word} vs ${m.opponents.join(' & ')}`;
  return word;
}

/** A compact match row (sport bar, title, "Today · Badminton doubles", score). */
export function MatchHistoryRow({ match, background }: { match: MatchHistoryItem; background?: string }) {
  const { colors } = useTheme();
  const sub = [shortDay(match.playedAt), `${match.sport.name}${match.format ? ` ${match.format.toLowerCase()}` : ''}`].join(' · ');
  return (
    <Tap
      label={historyTitle(match)}
      onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: match.matchId } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: background ?? colors.surface }}
    >
      <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: match.sport.accentColor }} />
      <View style={{ flex: 1 }}>
        <T size={14} w={600} numberOfLines={1}>
          {historyTitle(match)}
        </T>
        <T size={12} color={colors.muted} numberOfLines={1}>
          {sub}
        </T>
      </View>
      {match.headline ? (
        <D size={17} w={800}>
          {match.headline.replace(/,\s*/g, ' ')}
        </D>
      ) : null}
    </Tap>
  );
}

/** W / L tile. */
export function FormTile({ result, size = 30 }: { result: 'W' | 'L'; size?: number }) {
  const { colors } = useTheme();
  const won = result === 'W';
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: won ? 'rgba(74,222,128,0.16)' : 'rgba(255,84,104,0.14)', alignItems: 'center', justifyContent: 'center' }}>
      <D size={16} color={won ? colors.good : colors.bad}>
        {result}
      </D>
    </View>
  );
}

/** "12 followers · 30 following"; each half opens that list (Instagram-style). */
export function FollowCounts({ userId, username, followers, following, center = false }: { userId: string; username: string; followers: number; following: number; center?: boolean }) {
  const { colors } = useTheme();
  const open = (tab: 'followers' | 'following') =>
    router.push({ pathname: '/follows/[id]', params: { id: userId, tab, username, followers: String(followers), following: String(following) } });
  const part = (count: number, label: string, tab: 'followers' | 'following') => (
    <Tap label={`${count} ${label}`} onPress={() => open(tab)} style={{ paddingVertical: 4 }}>
      <T size={14} color={colors.soft}>
        <T size={14} w={700}>
          {count}
        </T>{' '}
        {label}
      </T>
    </Tap>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: center ? 'center' : 'flex-start' }}>
      {part(followers, followers === 1 ? 'follower' : 'followers', 'followers')}
      <T size={14} color={colors.soft}>
        ·
      </T>
      {part(following, 'following', 'following')}
    </View>
  );
}
