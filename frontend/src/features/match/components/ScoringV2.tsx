/*
 * Design v2 live scoring pieces (racket sports): header, game chips, call-the-score banner,
 * info banner, the two side cards and the footer.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Button, D, Icon, IconButton, T, type IconName } from '@/shared/ui';
import type { MatchView, ScoreSummary } from '../types';
import { LivePill } from '@/features/feed/components/HomeBits';

/** ‹  "Badminton · Singles" over the rules, LIVE · rallies, share. */
export function ScoringHeader({ match, rallies, live, onBack, onShare }: { match: MatchView; rallies: number; live: boolean; onBack?: () => void; onShare: () => void }) {
  const { colors } = useTheme();
  const rules = [match.ruleset.name, match.court?.name].filter(Boolean).join(' · ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {onBack ? <IconButton icon="back" label="Leave scoring" tone="plain" onPress={onBack} /> : <View style={{ width: 8 }} />}
      <View style={{ flex: 1, gap: 1 }}>
        <D size={20} lh={22} numberOfLines={1}>
          {match.sport.name} · {match.format.name}
        </D>
        {rules ? (
          <T size={12} color={colors.muted} numberOfLines={2}>
            {rules}
          </T>
        ) : null}
      </View>
      {live ? <LivePill label={rallies ? `LIVE · ${rallies}` : 'LIVE'} /> : null}
      <IconButton icon="upload" label="Share live scoreboard" tone="plain" onPress={onShare} />
    </View>
  );
}

/** "G1 21-17" chips, then the one in play ("G2 now"); optional note on the right. */
export function GameChips({ score, note }: { score: ScoreSummary; note?: string | null }) {
  const { colors } = useTheme();
  const short = score.totals.majorLabel === 'Sets' ? 'S' : 'G';
  const done = score.segments.filter((s) => s.complete);
  const chip = (key: string, label: string, now = false) => (
    <View key={key} style={{ height: 32, paddingHorizontal: 10, borderRadius: 10, justifyContent: 'center', backgroundColor: now ? colors.fg : colors.surface, borderWidth: now ? 0 : 1, borderColor: colors.line }}>
      <D size={15} w={600} color={now ? colors.bg : colors.muted}>
        {label}
      </D>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {done.map((s) => chip(String(s.sequence), `${short}${s.sequence} ${s.display.join('-')}`))}
      {!score.complete ? chip('now', `${short}${done.length + 1} now`, true) : null}
      {note ? (
        <T size={12} color={colors.muted} style={{ marginLeft: 'auto' }} numberOfLines={1}>
          {note}
        </T>
      ) : null}
    </View>
  );
}

/** Orange block: "CALL THE SCORE / Server 2 · Aarav · left court" and "7 - 4 - 2"; "MATCH OVER" when decided. */
export function CallBlock({ title, detail, value }: { title: string; detail?: string | null; value?: string | null }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel={[title, value, detail].filter(Boolean).join(', ')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.hero }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={11} w={700} ls={0.08} color={colors.onHero}>
          {title}
        </T>
        {detail ? (
          <T size={12} color={colors.heroMuted} numberOfLines={1}>
            {detail}
          </T>
        ) : null}
      </View>
      {value ? (
        <D size={40} lh={42} color={colors.onHero}>
          {value}
        </D>
      ) : null}
    </View>
  );
}

/** Lavender strip: "Tiebreak · first to 7, win by 2", "Match point", "20-all". */
export function InfoBanner({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.infoBg, alignItems: 'center' }}>
      <T size={13} w={700} color={colors.info}>
        {text}
      </T>
    </View>
  );
}

/** One side: name, a sub line, the serve pill, the big number, what a tap does. The serving side is tinted. */
export function SideCard({
  name,
  sub,
  value,
  pill,
  hint,
  active,
  winner,
  dim,
  label,
  icon,
  onPress,
}: {
  /** Shown in the serve pill (the sport's icon). */
  icon?: IconName;
  name: string;
  sub?: string | null;
  value: string;
  pill: { text: string; tone: 'filled' | 'outline' | 'plain' } | null;
  hint: string | null;
  active: boolean;
  winner?: boolean;
  dim?: boolean;
  label: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const pillView: ReactNode = winner ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99, backgroundColor: colors.primary }}>
      <Icon name="cup" size={13} color={colors.onPrimary} />
      <T size={11} w={700} ls={0.06} color={colors.onPrimary}>
        WINNER
      </T>
    </View>
  ) : pill?.tone === 'filled' ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99, backgroundColor: colors.primary }}>
      {icon ? <Icon name={icon} size={12} color={colors.onPrimary} /> : null}
      <T size={11} w={700} ls={0.06} color={colors.onPrimary}>
        {pill.text}
      </T>
    </View>
  ) : pill?.tone === 'outline' ? (
    <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 99, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>
      <T size={11} w={700} ls={0.06} color={colors.muted}>
        {pill.text}
      </T>
    </View>
  ) : pill ? (
    <T size={12} color={colors.muted}>
      {pill.text}
    </T>
  ) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 150,
        padding: 18,
        paddingBottom: 12,
        borderRadius: 22,
        backgroundColor: active ? colors.accentSoft : colors.surface,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.primary : colors.line,
        opacity: dim ? 0.45 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={17} w={700} numberOfLines={1}>
            {name}
          </T>
          {sub ? (
            <T size={12} color={colors.muted} numberOfLines={1}>
              {sub}
            </T>
          ) : null}
        </View>
        {pillView}
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <D size={140} lh={128} color={colors.fg} adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </D>
      </View>
      <T size={12} color={colors.muted} center style={{ minHeight: 16 }}>
        {hint ?? ''}
      </T>
    </Pressable>
  );
}

/** Undo · a middle action · ⋯ (match menu). */
export function ScoringFooter({ canUndo, onUndo, middle, onMenu }: { canUndo: boolean; onUndo: () => void; middle: { label: string; icon: 'swap'; onPress: () => void }; onMenu: () => void }) {
  const { colors } = useTheme();
  const box = { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card } as const;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Button label="Undo" icon="undo" variant="surface" height={56} size={15} weight={700} disabled={!canUndo} style={{ flex: 1, ...box }} onPress={onUndo} />
      <Button label={middle.label} icon={middle.icon} variant="surface" height={56} size={15} weight={700} style={{ flex: 1, ...box }} onPress={middle.onPress} />
      <IconButton icon="dots" label="Match menu" size={56} radius={16} style={box} onPress={onMenu} />
    </View>
  );
}
