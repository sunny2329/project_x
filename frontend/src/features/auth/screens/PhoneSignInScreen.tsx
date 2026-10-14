import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FormMessage, PrimaryButton, TextField } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing } from '@/shared/theme';
import { normalizePhone } from '@/shared/utils/phone';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { useAuthStore } from '../store/auth.store';
import { validatePhone } from '../validation';

export default function PhoneSignInScreen() {
  const startPhoneSignIn = useAuthStore((s) => s.startPhoneSignIn);
  const { submitting, formError, serverFieldErrors, submit } = useSubmit();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function handleSend() {
    const found = validatePhone(phone);
    setError(found);
    if (found) return;
    const normalized = normalizePhone(phone);
    const sent = await submit(() => startPhoneSignIn(normalized));
    if (sent) router.push({ pathname: '/verify', params: { flow: 'phone', phone: normalized } });
  }

  return (
    <AuthScreenLayout title="Continue with phone" subtitle="We'll text a 6-digit code to your number.">
      <TextField
        placeholder="Phone number"
        value={phone}
        onChangeText={setPhone}
        error={error ?? serverFieldErrors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
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
