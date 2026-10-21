import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useProfileStore } from '@/features/profile/store/profile.store';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { pickPhoto, uploadPhoto } from '@/shared/media/upload';
import { READY, useTheme } from '@/shared/theme';
import { Button, D, Field, Icon, IconButton, Notice, Row, Screen, StepDots, T } from '@/shared/ui';
import { shortName } from '@/shared/utils/format';
import { useAuthStore } from '../store/auth.store';
import { validateFullName, validateNewPassword } from '../validation';

/** 0-4 bars: 8+ characters, a letter and a number, 12+ characters, a symbol or mixed case. */
export function passwordStrength(password: string): { bars: number; label: string } {
  if (!password) return { bars: 0, label: 'At least 8 characters with a number.' };
  let bars = 0;
  if (password.length >= 8) bars += 1;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) bars += 1;
  if (password.length >= 12) bars += 1;
  if (/[^A-Za-z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) bars += 1;
  if (validateNewPassword(password)) bars = Math.min(bars, 1);
  const word = ['Too short', 'Weak', 'Okay', 'Strong', 'Very strong'][bars]!;
  return { bars, label: `${word}. At least 8 characters with a number.` };
}

/**
 * Sign-up 3/4 "About you": optional photo, full name, name on scoreboards, password.
 * `mode="edit"` is the same screen reached with Back from "What do you play?" once the account
 * exists: it saves the name and photo to the profile instead (no password).
 */
export default function SignupDetailsScreen({ mode = 'signup' }: { mode?: 'signup' | 'edit' }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const completeSignup = useAuthStore((s) => s.completeSignup);
  const profile = useProfileStore((s) => s.profile);
  const saveDetails = useProfileStore((s) => s.saveDetails);
  const editing = mode === 'edit';
  const [fullName, setFullName] = useState(editing ? (profile?.user.fullName ?? user?.fullName ?? '') : '');
  const [displayName, setDisplayName] = useState(editing ? (profile?.displayName ?? '') : '');
  const [displayTouched, setDisplayTouched] = useState(editing);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();

  const scoreboardName = displayName.trim() || shortName(fullName.trim());
  const nameError = touched ? (validateFullName(fullName) ?? serverFieldErrors.fullName) : serverFieldErrors.fullName;
  const passwordError = !editing && touched ? (validateNewPassword(password) ?? serverFieldErrors.password) : serverFieldErrors.password;
  const strength = passwordStrength(password);

  const choosePhoto = async () => {
    const picked = await pickPhoto({ square: true });
    if (picked) setPhoto(picked);
  };

  const save = () => {
    setTouched(true);
    if (validateFullName(fullName) || (!editing && validateNewPassword(password))) return;
    void submit(async () => {
      if (editing) {
        const media = photo ? await uploadPhoto(photo) : null;
        await saveDetails({ fullName: fullName.trim(), displayName: scoreboardName, ...(media ? { photoMediaId: media.id } : {}) });
        router.back();
        return;
      }
      await completeSignup({ fullName: fullName.trim(), displayName: scoreboardName, password });
      // Signed in now; the photo is saved to the new profile in the background.
      if (photo) void uploadPhoto(photo).then((media) => useProfileStore.getState().saveDetails({ photoMediaId: media.id })).catch(() => undefined);
    });
  };

  return (
    <Screen px={24} gap={24} bottom={20}>
      <Row between>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <StepDots step={3} />
        <View style={{ width: 44 }} />
      </Row>

      <Row gap={16}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? 'Change photo' : 'Add a photo'}
          onPress={() => void choosePhoto()}
          style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.raised, borderWidth: photo ? 0 : 1.5, borderStyle: 'dashed', borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' }}
        >
          {photo ? (
            <Image source={{ uri: photo.uri }} style={{ width: 76, height: 76, borderRadius: 38 }} />
          ) : (
            <Icon name="person" size={26} color={colors.fg} />
          )}
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={14} color={colors.onPrimary} strokeWidth={3} />
          </View>
        </Pressable>
        <View style={{ gap: 4, flex: 1 }}>
          <D size={40} lh={40} upper accessibilityRole="header">
            About you
          </D>
          <T size={14} color={colors.muted}>
            Photo is optional
          </T>
        </View>
      </Row>

      <View style={{ gap: 16 }}>
        <Field
          label="Full name"
          value={fullName}
          onChangeText={(v) => {
            setFullName(v);
            if (!displayTouched) setDisplayName(shortName(v.trim()));
          }}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={nameError}
        />
        <Field
          label="Name on scoreboards"
          value={displayName}
          onChangeText={(v) => {
            setDisplayTouched(true);
            setDisplayName(v);
          }}
          maxLength={40}
          hint="Short works best. Others see this during live matches."
          error={serverFieldErrors.displayName}
        />
        {editing ? null : (
          <View style={{ gap: 8 }}>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              error={passwordError}
              suffix={
                <IconButton icon="eye" label={showPassword ? 'Hide password' : 'Show password'} tone="plain" color={colors.muted} onPress={() => setShowPassword((v) => !v)} />
              }
            />
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < strength.bars ? (strength.bars >= 3 ? READY : strength.bars === 2 ? colors.warnText : colors.bad) : colors.line }} />
              ))}
            </View>
            {passwordError ? null : (
              <T size={13} color={colors.muted}>
                {strength.label}
              </T>
            )}
          </View>
        )}
        {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
      </View>

      <View style={{ marginTop: 'auto' }}>
        <Button label={editing ? 'Save' : 'Continue'} weight={700} onPress={save} loading={submitting} />
      </View>
    </Screen>
  );
}
