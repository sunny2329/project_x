import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { SPORT_COLORS, useTheme, withAlpha } from '@/shared/theme';
import { Button, D, Icon, IconButton, Notice, Row, Screen, sportIcon, StepDots, T } from '@/shared/ui';
import { profileApi } from '../api/profile.api';
import { toggleSport, type SportSelection } from '../sportSelection';
import { useProfileStore } from '../store/profile.store';

/** The racket sports the app is built for; any not yet switched on in the catalogue show "Coming soon". */
const ROSTER: { slug: string; name: string }[] = [
  { slug: 'badminton', name: 'Badminton' },
  { slug: 'table-tennis', name: 'Table tennis' },
  { slug: 'pickleball', name: 'Pickleball' },
  { slug: 'padel', name: 'Padel' },
  { slug: 'tennis', name: 'Tennis' },
  { slug: 'volleyball', name: 'Volleyball' },
];

/** Sign-up 4/4 "What do you play?": a rating per sport, starting at 1000. Then claim guest matches, or Home. */
export default function PickSportsScreen() {
  const { colors } = useTheme();
  const catalogue = useProfileStore((s) => s.catalogue);
  const loadCatalogue = useProfileStore((s) => s.loadCatalogue);
  const saveSports = useProfileStore((s) => s.saveSports);
  const finishOnboarding = useAuthStore((s) => s.finishOnboarding);
  const [selection, setSelection] = useState<SportSelection>({ sportIds: [], primarySportId: null });
  const { submit, submitting, formError } = useSubmit();

  useEffect(() => {
    void loadCatalogue().catch(() => undefined);
  }, [loadCatalogue]);

  const tiles = useMemo(() => {
    const active = new Map(catalogue.map((s) => [s.slug, s]));
    const known = ROSTER.map((r) => ({ ...r, sport: active.get(r.slug) ?? null }));
    const extra = catalogue.filter((s) => !ROSTER.some((r) => r.slug === s.slug)).map((s) => ({ slug: s.slug, name: s.name, sport: s }));
    return [...known.filter((t) => t.sport), ...extra, ...known.filter((t) => !t.sport)];
  }, [catalogue]);

  const count = selection.sportIds.length;

  const next = () =>
    void submit(async () => {
      if (count) await saveSports(selection.sportIds, selection.primarySportId);
      const { matches } = await profileApi.claimable().catch(() => ({ matches: [] }));
      if (matches.length) router.push('/onboarding/claim');
      else finishOnboarding();
    });

  return (
    <Screen px={24} gap={24} bottom={20}>
      <Row between>
        <IconButton icon="back" label="Back" onPress={() => router.push('/onboarding/details')} />
        <StepDots step={4} />
        <View style={{ width: 44 }} />
      </Row>

      <View style={{ gap: 8 }}>
        <D size={44} lh={44} upper accessibilityRole="header">
          What do you play?
        </D>
        <T size={15} lh={22} color={colors.muted}>
          Pick any. You get a rating for each sport, starting at 1000.
        </T>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map(({ slug, name, sport }) => {
          const color = sport?.accentColor ?? SPORT_COLORS[slug] ?? colors.primary;
          const on = !!sport && selection.sportIds.includes(sport.id);
          if (!sport) {
            return (
              <View key={slug} style={{ width: '47.5%', flexGrow: 1, height: 118, padding: 16, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, justifyContent: 'space-between' }}>
                <Icon name={sportIcon(slug)} size={30} color={colors.muted} />
                <View style={{ gap: 2 }}>
                  <T size={17} w={700} color={colors.muted}>
                    {name}
                  </T>
                  <T size={12} color={colors.muted}>
                    Coming soon
                  </T>
                </View>
              </View>
            );
          }
          return (
            <Pressable
              key={slug}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={name}
              onPress={() => setSelection((s) => toggleSport(s, sport.id))}
              style={({ pressed }) => ({
                width: '47.5%',
                flexGrow: 1,
                height: 118,
                padding: 16,
                borderRadius: 20,
                backgroundColor: on ? withAlpha(color, 0.14) : colors.surface,
                borderWidth: on ? 2 : 1,
                borderColor: on ? color : colors.line,
                justifyContent: 'space-between',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon name={sportIcon(slug)} size={30} color={on ? color : colors.fg} />
              <T size={17} w={700}>
                {name}
              </T>
              {on ? (
                <View style={{ position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={14} color={colors.ink} strokeWidth={3} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}

      <View style={{ marginTop: 'auto', gap: 12 }}>
        <Button label={`Continue · ${count} selected`} weight={700} onPress={next} loading={submitting} disabled={!count} />
        <Button label="Skip for now" variant="ghost" height={44} weight={600} onPress={finishOnboarding} />
      </View>
    </Screen>
  );
}
