import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { authApi } from '@/features/auth/api/auth.api';
import { validateFullName, validateUsername } from '@/features/auth/validation';
import { useDebounced } from '@/shared/hooks/useCountdown';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { pickPhoto, uploadPhoto } from '@/shared/media/upload';
import { useTheme, withAlpha } from '@/shared/theme';
import { Avatar, Button, Field, Loading, Notice, Row, Screen, T, TextButton } from '@/shared/ui';
import { sameSelection, toggleSport, type SportSelection } from '../sportSelection';
import { useProfileStore } from '../store/profile.store';

/** Edit profile: photo, names, city, username, bio and the sports I play. */
export default function EditProfileScreen() {
  const { colors } = useTheme();
  const profile = useProfileStore((s) => s.profile);
  const catalogue = useProfileStore((s) => s.catalogue);
  const [fullName, setFullName] = useState(profile?.user.fullName ?? '');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [username, setUsername] = useState(profile?.user.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [photo, setPhoto] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const initialSports: SportSelection = { sportIds: profile?.sports.map((s) => s.id) ?? [], primarySportId: profile?.sports.find((s) => s.isPrimary)?.id ?? null };
  const [sports, setSports] = useState<SportSelection>(initialSports);
  const [taken, setTaken] = useState<{ for: string; reason: string | null } | null>(null);
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();

  useEffect(() => {
    void useProfileStore.getState().loadCatalogue().catch(() => undefined);
    if (!profile) void useProfileStore.getState().load().catch(() => undefined);
  }, [profile]);

  const handle = username.trim().replace(/^@/, '');
  const debounced = useDebounced(handle, 350);
  useEffect(() => {
    if (!debounced || debounced === profile?.user.username || validateUsername(debounced)) return;
    let cancelled = false;
    authApi.usernameAvailable(debounced).then((r) => !cancelled && setTaken(r.available ? null : { for: debounced, reason: r.reason }), () => undefined);
    return () => {
      cancelled = true;
    };
  }, [debounced, profile?.user.username]);

  if (!profile) return <Loading />;

  const usernameError = (handle ? validateUsername(handle) : 'Choose a username') ?? (taken?.for === handle ? (taken.reason ?? 'That username is taken') : null) ?? serverFieldErrors.username;
  const nameError = validateFullName(fullName) ?? serverFieldErrors.fullName;

  const save = () => {
    // The fields already show what's wrong.
    if (usernameError || nameError) return;
    void submit(async () => {
      const media = photo ? await uploadPhoto(photo) : null;
      const store = useProfileStore.getState();
      await store.saveDetails({
        fullName: fullName.trim(),
        displayName: displayName.trim() || fullName.trim(),
        city: city.trim(),
        bio: bio.trim(),
        ...(handle !== profile.user.username ? { username: handle } : {}),
        ...(media ? { photoMediaId: media.id } : removePhoto ? { photoMediaId: null } : {}),
      });
      if (!sameSelection(sports, initialSports)) await store.saveSports(sports.sportIds, sports.primarySportId);
      router.back();
    });
  };

  const shownPhoto = photo?.uri ?? (removePhoto ? null : profile.photoUrl);

  return (
    <Screen gap={16}>
      <Row between>
        <TextButton label="Cancel" size={16} weight={600} color={colors.muted} onPress={() => router.back()} />
        <T size={17} w={700}>
          Edit profile
        </T>
        <Button label="Save" height={40} radius={12} size={15} weight={700} inline px={18} loading={submitting} onPress={save} />
      </Row>

      <Row gap={16}>
        <Avatar name={profile.user.fullName} id={profile.user.id} photoUrl={shownPhoto} size={72} display />
        <Button
          label="Change photo"
          variant="outline"
          height={40}
          radius={12}
          size={14}
          inline
          px={14}
          onPress={() =>
            void pickPhoto({ square: true }).then((p) => {
              if (p) {
                setPhoto(p);
                setRemovePhoto(false);
              }
            })
          }
        />
        {shownPhoto ? (
          <TextButton
            label="Remove"
            size={14}
            color={colors.muted}
            onPress={() => {
              setPhoto(null);
              setRemovePhoto(true);
            }}
          />
        ) : null}
      </Row>

      <View style={{ gap: 12 }}>
        <Field label="Full name" value={fullName} onChangeText={setFullName} height={50} size={16} autoCapitalize="words" error={fullName ? nameError : 'Enter your full name'} />
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Field label="Scoreboard name" value={displayName} onChangeText={setDisplayName} height={50} size={16} maxLength={40} style={{ flex: 1 }} error={serverFieldErrors.displayName} />
          <Field label="City" value={city} onChangeText={setCity} height={50} size={16} maxLength={60} style={{ flex: 1 }} error={serverFieldErrors.city} />
        </Row>
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          height={50}
          size={16}
          autoCapitalize="none"
          autoCorrect={false}
          prefix={
            <T w={600} color={colors.faint}>
              @
            </T>
          }
          error={usernameError}
        />
        <Field label="Bio" value={bio} onChangeText={setBio} multiline height={72} size={15} maxLength={300} error={serverFieldErrors.bio} />
      </View>

      <View style={{ gap: 8 }}>
        <T size={13} w={600} color={colors.muted}>
          Sports I play
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {catalogue.map((s) => {
            const on = sports.sportIds.includes(s.id);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={s.name}
                onPress={() => setSports((sel) => toggleSport(sel, s.id))}
                style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center', backgroundColor: on ? withAlpha(s.accentColor, 0.16) : 'transparent', borderWidth: on ? 1.5 : 1, borderColor: on ? s.accentColor : colors.line }}
              >
                <T size={14} w={on ? 700 : 600} color={on ? colors.fg : colors.soft}>
                  {s.name}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
    </Screen>
  );
}
