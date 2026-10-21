import { useState } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, CheckBox, D, Dot, Icon, Loading, Notice, Screen, T, Tap } from '@/shared/ui';
import { dayMonth, plural } from '@/shared/utils/format';
import { profileApi } from '../api/profile.api';
import type { ClaimableMatch } from '../types';

/** "Won vs Arjun T" / "Lost with Meera J". */
export function claimLine(m: Pick<ClaimableMatch, 'outcome' | 'partners' | 'opponents'>): string {
  const outcome = m.outcome === 'won' ? 'Won' : m.outcome === 'lost' ? 'Lost' : m.outcome === 'drawn' ? 'Drew' : 'Played';
  return m.partners.length ? `${outcome} with ${m.partners.join(' & ')}` : `${outcome} vs ${m.opponents.join(' & ') || 'a guest'}`;
}

/** After sign-up, when friends scored matches with this phone number as a guest: add them to my record. */
export default function ClaimMatchesScreen() {
  const { colors } = useTheme();
  const finishOnboarding = useAuthStore((s) => s.finishOnboarding);
  const { data, error, loading } = useResource(() => profileApi.claimable(), []);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const { submit, submitting, formError } = useSubmit();

  if (loading) return <Loading />;
  const matches = data?.matches ?? [];
  const chosen = matches.filter((m) => !skipped.has(m.matchId));
  const guestIds = [...new Set(chosen.map((m) => m.guestPlayerId))];

  const toggle = (id: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Screen px={24} gap={24} top={20} bottom={20}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="trophy" size={28} color={colors.fg} />
      </View>

      <View style={{ gap: 8 }}>
        <D size={44} lh={44} upper accessibilityRole="header">
          You’ve already played {plural(matches.length, 'match', 'matches')}
        </D>
        <T size={15} lh={22} color={colors.muted}>
          Friends scored these with you as a guest, using your phone number. Add them to build your record.
        </T>
      </View>

      {error ? <Notice tone="error" icon="alert" text={error} /> : null}

      <View style={{ gap: 10 }}>
        {matches.map((m) => {
          const on = !skipped.has(m.matchId);
          return (
            <Tap
              key={m.matchId}
              label={claimLine(m)}
              onPress={() => toggle(m.matchId)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
            >
              <CheckBox on={on} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Dot color={m.sport.accentColor} />
                  <T size={12} color={colors.muted} flex numberOfLines={1}>
                    {m.sport.name} · {dayMonth(m.playedAt)} · scored by {m.scoredBy}
                  </T>
                </View>
                <T size={15} w={600}>
                  {claimLine(m)}
                </T>
                {m.headline ? (
                  <D size={18} w={800} ls={0.02}>
                    {m.headline}
                  </D>
                ) : null}
              </View>
            </Tap>
          );
        })}
      </View>

      <T size={13} lh={19} color={colors.muted}>
        Matches played as a guest count in your record but don’t change your rating.
      </T>

      {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}

      <View style={{ marginTop: 'auto', gap: 12 }}>
        <Button
          label={chosen.length ? `Add ${plural(chosen.length, 'match', 'matches')} to my profile` : 'Continue'}
          weight={700}
          loading={submitting}
          onPress={() =>
            void submit(async () => {
              if (guestIds.length) await profileApi.claim(guestIds);
              finishOnboarding();
            })
          }
        />
        <Button label="These aren’t mine" variant="ghost" height={44} weight={600} onPress={finishOnboarding} />
      </View>
    </Screen>
  );
}
