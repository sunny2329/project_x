/*
 * Design v2 tournament pieces: the orange event header with tabs on it, round/group selector
 * chips, and a panel card. Fixture cards live in TournamentBits (FixtureCard).
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { env } from '@/shared/config/env';
import { useTheme } from '@/shared/theme';
import { D, goBack, Icon, type IconName, T, Tap } from '@/shared/ui';

function HeroIcon({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Tap label={label} onPress={onPress} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={colors.onHero} />
    </Tap>
  );
}

/** The public page of a tournament (server-rendered, no login). */
export function tournamentUrl(slug: string): string {
  return `${env.apiUrl}/t/${slug}`;
}

export function shareTournament(name: string, slug: string) {
  const url = tournamentUrl(slug);
  void Share.share({ message: `${name}: draws, live scores and results\n${url}`, url }).catch(() => undefined);
}

export interface HeroTab {
  key: string;
  label: string;
  onPress: () => void;
}

/** Orange block under the status bar: ‹, title, a sub line, an action, then tabs on the orange. */
export function EventHero({
  title,
  sub,
  fallback = '/tournaments',
  action,
  tabs,
  active,
  children,
}: {
  title: string;
  sub?: string | null;
  fallback?: string;
  action?: { icon: IconName; label: string; onPress: () => void };
  tabs?: HeroTab[];
  active?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.hero, paddingTop: insets.top + 8, paddingHorizontal: 12, gap: 10, ...(tabs?.length ? {} : { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 8 }) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <HeroIcon icon="back" label="Back" onPress={() => goBack(fallback)} />
        <View style={{ flex: 1, gap: 2 }}>
          <D size={26} lh={28} color={colors.onHero} numberOfLines={2} accessibilityRole="header">
            {title}
          </D>
          {sub ? (
            <T size={12} color={colors.heroMuted} numberOfLines={2}>
              {sub}
            </T>
          ) : null}
        </View>
        {action ? <HeroIcon {...action} /> : null}
      </View>
      {children}
      {tabs?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ flexGrow: 1 }}>
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={on ? undefined : t.onPress}
                style={{ flexGrow: 1, minWidth: 80, height: 46, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: on ? colors.onHero : 'transparent' }}
              >
                <T size={15} w={on ? 700 : 500} color={on ? colors.onHero : colors.heroMuted}>
                  {t.label}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ height: 6 }} />
      )}
    </View>
  );
}

/** "R16 · 8 done", "QF · 1 live": a row of equal chips, the picked one orange. */
export function PickerChips<K extends string>({ items, value, onChange }: { items: { key: K; label: string; sub?: string }[]; value: K; onChange: (k: K) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexGrow: 1 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={[it.label, it.sub].filter(Boolean).join(', ')}
            onPress={() => onChange(it.key)}
            style={{ flexGrow: 1, minWidth: 80, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center', gap: 2, backgroundColor: on ? colors.primary : colors.card, borderWidth: 1, borderColor: on ? colors.primary : colors.line }}
          >
            <D size={17} w={700} color={on ? colors.onPrimary : colors.fg}>
              {it.label}
            </D>
            {it.sub ? (
              <T size={11} color={on ? colors.onPrimary : colors.muted} numberOfLines={1}>
                {it.sub}
              </T>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Lavender explainer (tiebreaks, rules). */
export function InfoCallout({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.infoBg }}>
      <Icon name="info" size={18} color={colors.info} />
      <T size={14} lh={20} color={colors.info} flex>
        {text}
      </T>
    </View>
  );
}

/** Open the fixture's match (watch / result) or the fixture page. */
export function openFixture(f: { id: string; status: string; match: { id: string; status: string } | null }) {
  const live = f.match?.status === 'live' || f.status === 'live';
  if (f.match && (live || f.status === 'completed')) router.push({ pathname: live ? '/match/[id]/watch' : '/match/[id]/result', params: { id: f.match.id } });
  else router.push({ pathname: '/fixture/[id]', params: { id: f.id } });
}
