import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { FormMessage, PrimaryButton, TextField } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing } from '@/shared/theme';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { OtpInput } from '../components/OtpInput';
import { ResendCode } from '../components/ResendCode';
import { useAuthStore } from '../store/auth.store';
import { collectErrors, validateCode, validateConfirmation, validateNewPassword, type Errors } from '../validation';

type Field = 'code' | 'password' | 'confirmPassword';

export default function ResetPasswordScreen() {
  const { identifier = '' } = useLocalSearchParams<{ identifier: string }>();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const { submitting, formError, serverFieldErrors, submit } = useSubmit();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors<Field>>({});
  const confirmRef = useRef<TextInput>(null);

  async function handleReset() {
    const found = collectErrors<Field>({
      code: validateCode(code),
      password: validateNewPassword(password),
      confirmPassword: validateConfirmation(password, confirmPassword),
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    const done = await submit(() => resetPassword(identifier, code, password));
    if (done) router.dismissTo({ pathname: '/sign-in', params: { reset: '1' } });
  }

  return (
    <AuthScreenLayout
      title="Set a new password"
      subtitle="Enter the code we texted you and choose a new password."
    >
      <OtpInput value={code} onChange={setCode} hasError={Boolean(errors.code)} />
      <FormMessage message={errors.code ?? null} />
      <TextField
        placeholder="New password"
        value={password}
        onChangeText={setPassword}
        error={errors.password ?? serverFieldErrors.newPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={confirmRef}
        placeholder="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleReset}
      />
      <FormMessage message={formError} />
      <View style={styles.primary}>
        <PrimaryButton title="Update password" onPress={handleReset} loading={submitting} />
      </View>
      <View style={styles.resend}>
        <ResendCode onResend={() => submit(() => requestPasswordReset(identifier))} />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primary: { marginTop: spacing.sm },
  resend: { marginTop: spacing.md },
});
