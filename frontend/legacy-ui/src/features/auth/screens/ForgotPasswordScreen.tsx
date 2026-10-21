import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FormMessage, PrimaryButton, TextField } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing } from '@/shared/theme';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { normalizeIdentifier } from '../identifier';
import { useAuthStore } from '../store/auth.store';
import { validateIdentifier } from '../validation';

export default function ForgotPasswordScreen() {
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const { submitting, formError, submit } = useSubmit();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function handleSend() {
    const found = validateIdentifier(identifier);
    setError(found);
    if (found) return;
    const normalized = normalizeIdentifier(identifier);
    const sent = await submit(() => requestPasswordReset(normalized));
    if (sent) router.push({ pathname: '/reset-password', params: { identifier: normalized } });
  }

  return (
    <AuthScreenLayout
      title="Forgot your password?"
      subtitle="Enter your username, email or phone. We'll text a code to the phone number on your account."
    >
      <TextField
        placeholder="Username, email or phone"
        value={identifier}
        onChangeText={setIdentifier}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={handleSend}
      />
      <FormMessage message={formError} />
      <View style={styles.primary}>
        <PrimaryButton title="Send code" onPress={handleSend} loading={submitting} />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primary: { marginTop: spacing.sm },
});
