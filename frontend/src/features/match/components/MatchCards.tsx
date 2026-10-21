import { router } from 'expo-router';
import { View } from 'react-native';
import { sportText, useTheme } from '@/shared/theme';
import { D, Dot, T, Tap } from '@/shared/ui';
import type { MatchCard } from '../types';

/** "Game 3" from a live headline ("21-17, 18-21" means the third game is on). */
export function currentUnitLabel(card: Pick<MatchCard, 'score'>, unit = 'Game'): string | null {
  const played = card.score.headline ? card.score.headline.split(',').filter((s) => s.trim()).length : 0;
  const running = card.score.sides.some((s) => s.current !== null);
  return running ? `${unit} ${played + 1}` : played ? `${unit} ${played}` : null;
}

/** Short callouts for the 236px live cards ("MATCH POINT" -> "MATCH PT"). */
function shortCallout(callout: string | null): string | null {
  if (!callout) return null;
  return callout.toUpperCase().replace('MATCH POINT', 'MATCH PT').replace('GAME POINT', 'GAME PT').replace('SET POINT', 'SET PT');
}

/** Home's "Live now" strip card: sport · game, callout, both sides with games won and the running score. */
export function LiveMatchCard({ match, width = 236 }: { match: MatchCard; width?: number }) {
  const { colors } = useTheme();
  const unit = currentUnitLabel(match);
  const callout = shortCallout(match.score.callout);
  const leading = (() => {
    const [a, b] = match.score.sides;
    const n = (s: typeof a) => Number(s?.current ?? s?.primary ?? 0);
    return n(a) === n(b) ? null : n(a) > n(b) ? 0 : 1;
  })();
  return (
    <Tap
      label={`${match.sides.map((s) => s.name).join(' vs ')}, live`}
      onPress={() => router.push({ pathname: '/match/[id]/watch', params: { id: match.id } })}
      style={{ width, padding: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 10 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Dot color={match.sport.accentColor} />
          <T size={12} color={colors.muted} numberOfLines={1} flex>
            {match.sport.name}
            {unit ? ` · ${unit}` : ''}
          </T>
        </View>
        {callout ? (
          <T size={12} w={700} color={sportText(colors, match.sport.slug)}>
            {callout}
          </T>
        ) : null}
      </View>
      {match.sides.map((side) => {
        const s = match.score.sides.find((x) => x.index === side.index);
        const dim = leading !== null && leading !== side.index;
        return (
          <View key={side.index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T size={14} w={600} color={dim ? colors.soft : colors.fg} flex numberOfLines={1}>
              {side.name.replace(/ & /g, ' / ')}
            </T>
            {s?.current !== null && s?.current !== undefined ? (
              <D size={15} color={colors.muted}>
                {s.primary}
              </D>
            ) : null}
            <D size={26} style={{ width: 32, textAlign: 'right' }} color={dim ? colors.soft : colors.fg}>
              {s?.current ?? s?.primary ?? '0'}
            </D>
          </View>
        );
      })}
    </Tap>
  );
}

/**
 * Two score rows: a sport-coloured bar on the winner, then each game / set ("21  18  21").
 * `segments` is [side 0, side 1] per game.
 */
export function ScoreLines({
  sides,
  segments,
  winnerSideIndex,
  color,
  background,
  size = 20,
  gap = 6,
}: {
  sides: { index: number; name: string }[];
  segments: number[][];
  winnerSideIndex: number | null;
  color: string;
  background?: string;
  size?: number;
  gap?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap, padding: background ? 12 : 0, borderRadius: 12, backgroundColor: background }}>
      {sides.map((side) => {
        const won = side.index === winnerSideIndex;
        return (
          <View key={side.index} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: won ? color : 'transparent' }} />
            <T size={15} w={won ? 700 : 400} color={won ? colors.fg : colors.muted} flex numberOfLines={1}>
              {side.name.replace(/ & /g, ' / ')}
            </T>
            <D size={size} w={800} color={won ? colors.fg : colors.muted}>
              {segments.map((s) => s[side.index] ?? 0).join('  ')}
            </D>
          </View>
        );
      })}
    </View>
  );
}
