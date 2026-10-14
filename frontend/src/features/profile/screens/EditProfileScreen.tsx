import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { validateFullName } from '@/features/auth/validation';
import { FormMessage, PrimaryButton, Screen, SectionHeader, TextField, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { makePrimary, sameSelection, toggleSport, type SportSelection } from '../sportSelection';
import { useProfileStore } from '../store/profile.store';
import type { Profile } from '../types';

const BIO_MAX = 500;

/** Edit name, bio and the sports the player plays (with one primary sport). */
export default function EditProfileScreen() {
  const { colors } = useTheme();
  const profile = useProfileStore((s) => s.profile);
  const load = useProfileStore((s) => s.load);
  const loadState = useSubmit();
  const submitLoad = loadState.submit;

  useEffect(() => {
    // Opened directly (e.g. before Home finished loading): the form needs the current values.
    if (!profile) void submitLoad(load);
  }, [profile, load, submitLoad]);

  if (profile) return <EditProfileForm profile={profile} />;
  return (
    <Screen header={<TopBar title="Edit profile" back="/profile" />}>
      {loadState.formError ? <FormMessage message={loadState.formError} /> : <ActivityIndicator color={colors.primary} />}
    </Screen>
  );
}

function EditProfileForm({ profile }: { profile: Profile }) {
  const { colors } = useTheme();
  const catalogue = useProfileStore((s) => s.catalogue);
  const loadCatalogue = useProfileStore((s) => s.loadCatalogue);
  const saveDetails = useProfileStore((s) => s.saveDetails);
  const saveSports = useProfileStore((s) => s.saveSports);
  const { submitting, formError, serverFieldErrors, submit } = useSubmit();
  const catalogueState = useSubmit();

  const initialSelection = useMemo<SportSelection>(
    () => ({
      sportIds: profile.sports.map((sport) => sport.id),
      primarySportId: profile.sports.find((sport) => sport.isPrimary)?.id ?? null,
    }),
    [profile],
  );
  const [fullName, setFullName] = useState(profile.user.fullName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [selection, setSelection] = useState(initialSelection);
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    void catalogueState.submit(loadCatalogue);
    // Load once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    const error = validateFullName(fullName);
    setNameError(error);
    if (error) return;

    const nameChanged = fullName.trim() !== profile.user.fullName;
    const bioChanged = bio.trim() !== (profile.bio ?? '');
    const sportsChanged = !sameSelection(selection, initialSelection);

    const saved = await submit(async () => {
      if (nameChanged || bioChanged) {
        await saveDetails({ ...(nameChanged ? { fullName: fullName.trim() } : {}), ...(bioChanged ? { bio: bio.trim() } : {}) });
      }
      if (sportsChanged) await saveSports(selection.sportIds, selection.primarySportId);
    });
    if (saved) router.back();
  }

  return (
    <Screen header={<TopBar title="Edit profile" back="/profile" />}>

      <View style={styles.fields}>
        <TextField
          icon="user"
          placeholder="Full name"
          value={fullName}
          onChangeText={setFullName}
          error={nameError ?? serverFieldErrors.fullName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={100}
        />
        <TextField
          icon="edit-3"
          placeholder="Bio (optional)"
          value={bio}
          onChangeText={setBio}
          error={serverFieldErrors.bio}
          multiline
          maxLength={BIO_MAX}
        />
        <Text style={[typography.caption, styles.counter, { color: colors.textMuted }]}>
          {bio.length}/{BIO_MAX}
        </Text>
      </View>

      <SectionHeader title="Sports you play" />
      <Text style={[typography.body, styles.hint, { color: colors.textMuted }]}>
        Tap to add or remove. Tap the star to set your primary sport.
      </Text>

      {catalogueState.submitting && catalogue.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
      <FormMessage message={catalogueState.formError} />

      <View style={styles.sports}>
        {catalogue.map((sport) => {
          const selected = selection.sportIds.includes(sport.id);
          const primary = selection.primarySportId === sport.id;
          return (
            <Pressable
              key={sport.id}
              onPress={() => setSelection((prev) => toggleSport(prev, sport.id))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={sport.name}
              style={[
                styles.sportRow,
                { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.surfaceBorder },
              ]}
            >
              <Feather name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? colors.primary : colors.icon} />
              <Text style={[styles.sportName, { color: colors.text }]}>{sport.name}</Text>
              {selected ? (
                <Pressable
                  onPress={() => setSelection((prev) => makePrimary(prev, sport.id))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={primary ? `${sport.name} is your primary sport` : `Make ${sport.name} your primary sport`}
                  style={styles.star}
                >
                  <Feather name="star" size={18} color={primary ? colors.primary : colors.icon} />
                  {primary ? <Text style={[styles.primaryLabel, { color: colors.primary }]}>Primary</Text> : null}
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {serverFieldErrors.sportIds || serverFieldErrors.primarySportId ? (
        <FormMessage message={serverFieldErrors.sportIds ?? serverFieldErrors.primarySportId ?? null} />
      ) : null}

      <FormMessage message={formError} />
      <View style={styles.save}>
        <PrimaryButton title="Save" onPress={handleSave} loading={submitting} showChevron={false} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.md, paddingTop: spacing.lg, marginBottom: spacing.xl },
  counter: { alignSelf: 'flex-end', marginTop: -spacing.xs },
  hint: { marginTop: -spacing.sm, marginBottom: spacing.md },
  sports: { gap: spacing.sm, marginBottom: spacing.lg },
  sportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.field,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  sportName: { flex: 1, fontSize: 15, fontWeight: '600' },
  star: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  primaryLabel: { fontSize: 12, fontWeight: '700' },
  save: { marginTop: spacing.sm },
});
