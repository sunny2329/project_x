import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useCountdown } from '@/shared/hooks/useCountdown';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, Field, Icon, IconButton, Notice, Screen, T, TextButton } from '@/shared/ui';
import { prettyPhone } from '@/shared/utils/format';
import { identifierKind, normalizeIdentifier } from '../identifier';
import { useAuthStore } from '../store/auth.store';
import { validateConfirmation, validateIdentifier, validateNewPassword } from '../validation';

/**
 * "Reset your password": asks for the phone or username (prefilled from Log in), texts a code,
 * then the code and the new password twice. Resetting signs out every device.
 */
export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ identifier?: string; auto?: string }>();
  const signedIn = useAuthStore((s) => s.status === 'authenticated');
  const signOut = useAuthStore((s) => s.signOut);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const [identifier, setIdentifier] = useState(params.identifier ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const countdown = useCountdown(60);
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();
  const resend = useSubmit();

  const send = () => {
    setTouched(true);
    if (validateIdentifier(identifier)) return;
    const value = normalizeIdentifier(identifier);
    void submit(async () => {
      await requestPasswordReset(value);
      setSentTo(value);
      setTouched(false);
      countdown.restart();
    });
  };

  const reset = () => {
    setTouched(true);
    if (!sentTo || code.replace(/\D/g, '').length !== 6 || validateNewPassword(password) || validateConfirmation(password, again)) return;
    void submit(async () => {
      await resetPassword(sentTo, code.replace(/\D/g, ''), password);
      setDone(true);
    });
  };

  // From Settings > Change password: the phone is known, so the code goes out straight away.
  useEffect(() => {
    if (!params.auto || !params.identifier) return undefined;
    const timer = setTimeout(send, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) {
    return (
      <Screen px={24} gap={22} bottom={20}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
          <Icon name="check" size={28} color={colors.good} strokeWidth={2.4} />
        </View>
        <D size={44} lh={44} upper accessibilityRole="header">
          Password changed
        </D>
        <T size={15} lh={22} color={colors.muted}>
          You’re signed out on every phone. Log in again with the new password.
        </T>
        <View style={{ marginTop: 'auto' }}>
          <Button label="Log in" weight={700} onPress={() => (signedIn ? void signOut() : router.dismissTo('/login'))} />
        </View>
      </Screen>
    );
  }

  const codeError = touched && code.replace(/\D/g, '').length !== 6 ? 'Enter the 6-digit code' : serverFieldErrors.code;
  const passwordError = touched ? (validateNewPassword(password) ?? serverFieldErrors.newPassword) : serverFieldErrors.newPassword;
  const againError = touched && !passwordError ? validateConfirmation(password, again) : undefined;

  return (
    <Screen px={24} gap={22} bottom={20}>
      <IconButton icon="back" label="Back" onPress={() => router.back()} />

      <View style={{ gap: 8 }}>
        <D size={44} lh={44} upper accessibilityRole="header">
          Reset your password
        </D>
        {sentTo ? (
          <T size={15} lh={22} color={colors.muted}>
            We texted a code to <T w={700}>{identifierKind(sentTo) === 'phone' ? prettyPhone(sentTo) : `the phone on @${sentTo.replace(/^@/, '')}`}</T>.
          </T>
        ) : (
          <T size={15} lh={22} color={colors.muted}>
            Enter your phone number or username. We text a code to the phone on your account.
          </T>
        )}
      </View>

      {sentTo ? (
        <>
          <View style={{ gap: 8 }}>
            <Field
              label="6-digit code"
              value={code}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '').slice(0, 6);
                setCode(digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              display
              size={30}
              height={60}
              error={codeError}
              autoFocus
            />
            {countdown.done ? (
              <TextButton
                label="Didn’t get it? Resend code"
                size={13}
                weight={600}
                color={colors.fg}
                onPress={() =>
                  void resend.submit(async () => {
                    await requestPasswordReset(sentTo);
                    countdown.restart();
                  })
                }
              />
            ) : (
              <T size={13} color={colors.muted}>
                Didn’t get it? Resend in {countdown.label}
              </T>
            )}
          </View>
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" error={passwordError} />
          <Field label="Type it again" value={again} onChangeText={setAgain} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" error={againError} />
          <Notice tone="warn" icon="lock" text="For safety, this signs you out on every phone. Log in again with the new password." />
        </>
      ) : (
        <Field
          label="Phone or username"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          error={touched ? validateIdentifier(identifier) : undefined}
          autoFocus={!identifier}
          onSubmitEditing={send}
        />
      )}

      {formError || resend.formError ? <Notice tone="error" icon="alert" text={(formError ?? resend.formError)!} /> : null}

      <View style={{ marginTop: 'auto' }}>
        <Button label={sentTo ? 'Reset password' : 'Send code'} weight={700} onPress={sentTo ? reset : send} loading={submitting} />
      </View>
    </Screen>
  );
}
