import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { FormMessage, OrDivider, PrimaryButton, TextField, TextLink } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing } from '@/shared/theme';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { FooterPrompt } from '../components/FooterPrompt';
import { SocialSignIn } from '../components/SocialSignIn';
import { normalizeIdentifier } from '../identifier';
import { useAuthStore } from '../store/auth.store';
import { collectErrors, validateIdentifier, type Errors } from '../validation';

type Field = 'identifier' | 'password';

/** Strava-style "Log In" screen that keeps username / email / phone + password sign-in. */
export default function SignInScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const { submitting, formError, submit } = useSubmit();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors<Field>>({});
  const passwordRef = useRef<TextInput>(null);
  // As on Strava, the button stays dimmed until both fields have something in them.
  const filled = identifier.trim().length > 0 && password.length > 0;

  async function handleSignIn() {
    const found = collectErrors<Field>({
      identifier: validateIdentifier(identifier),
      password: password ? undefined : 'Enter your password',
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    await submit(() => signIn(normalizeIdentifier(identifier), password));
  }

  return (
    <AuthScreenLayout
      title="Log In to ProjectX"
      footer={<FooterPrompt prompt="New here?" action="Create an account" onPress={() => router.push('/sign-up')} />}
    >
      <FormMessage message={reset && !formError ? 'Password updated. Log in with your new password.' : null} tone="info" />
      <TextField
        placeholder="Username, email or phone"
        value={identifier}
        onChangeText={setIdentifier}
        error={errors.identifier}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => (filled ? void handleSignIn() : undefined)}
      />
      <View style={styles.forgotRow}>
        <TextLink title="Forgot password?" onPress={() => router.push('/forgot-password')} />
      </View>
      <FormMessage message={formError} />
      <PrimaryButton title="Log In" onPress={handleSignIn} loading={submitting} disabled={!filled} />
      <View style={styles.divider}>
        <OrDivider />
      </View>
      <SocialSignIn disabled={submitting} onSubmit={submit} />
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  forgotRow: { alignItems: 'flex-end', marginBottom: spacing.xs },
  divider: { marginVertical: spacing.md },
});
