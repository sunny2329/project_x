import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FormMessage, PrimaryButton, TextLink } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing } from '@/shared/theme';
import { maskPhone } from '@/shared/utils/phone';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { OTP_LENGTH, OtpInput } from '../components/OtpInput';
import { ResendCode } from '../components/ResendCode';
import { useAuthStore } from '../store/auth.store';
import { validateCode } from '../validation';

type Flow = 'signup' | 'phone';

/** Confirms the SMS code for sign-up or phone sign-in; success switches to the signed-in stack. */
export default function VerifyCodeScreen() {
  const { flow, phone = '' } = useLocalSearchParams<{ flow: Flow; phone: string }>();
  const completeRegistration = useAuthStore((s) => s.completeRegistration);
  const resendRegistrationCode = useAuthStore((s) => s.resendRegistrationCode);
  const verifyPhoneSignIn = useAuthStore((s) => s.verifyPhoneSignIn);
  const startPhoneSignIn = useAuthStore((s) => s.startPhoneSignIn);
  const { submitting, formError, submit, clearErrors } = useSubmit();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function verify(value: string) {
    const found = validateCode(value);
    setError(found);
    if (found) return;
    const ok = await submit(() => (flow === 'signup' ? completeRegistration(value) : verifyPhoneSignIn(phone, value)));
    if (!ok) setCode('');
  }

  function handleChange(value: string) {
    setCode(value);
    setError(undefined);
    clearErrors();
    if (value.length === OTP_LENGTH) void verify(value);
  }

  const resend = () => submit(() => (flow === 'signup' ? resendRegistrationCode() : startPhoneSignIn(phone)));

  return (
    <AuthScreenLayout title="Enter the code" subtitle={`We sent a 6-digit code to ${maskPhone(phone)}.`}>
      <OtpInput value={code} onChange={handleChange} hasError={Boolean(error ?? formError)} />
      <FormMessage message={error ?? formError} />
      <View style={styles.primary}>
        <PrimaryButton title="Verify" onPress={() => verify(code)} loading={submitting} />
      </View>
      <View style={styles.resend}>
        <ResendCode onResend={resend} />
      </View>
      {flow === 'phone' ? (
        <View style={styles.resend}>
          <TextLink title="Use password instead" onPress={() => router.dismissTo('/sign-in')} disabled={submitting} />
        </View>
      ) : null}
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primary: { marginTop: spacing.sm },
  resend: { marginTop: spacing.md, alignItems: 'center' },
});
