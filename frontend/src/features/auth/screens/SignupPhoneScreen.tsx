import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { env } from '@/shared/config/env';
import { useDebounced } from '@/shared/hooks/useCountdown';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, Field, Icon, IconButton, Notice, PhonePrefix, Row, Screen, StepDots, T, TextButton } from '@/shared/ui';
import { isValidPhone, normalizePhone } from '@/shared/utils/phone';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import { validateUsername } from '../validation';

/** Sign-up 1/4: phone number (the login) and a username, checked as you type. */
export default function SignupPhoneScreen() {
  const { colors } = useTheme();
  const pending = useAuthStore((s) => s.pendingSignup);
  const startSignup = useAuthStore((s) => s.startSignup);
  const [phone, setPhone] = useState(pending?.phone.replace(env.defaultCountryCode, '') ?? '');
  const [username, setUsername] = useState(pending?.username ?? '');
  const [touched, setTouched] = useState(false);
  const [availability, setAvailability] = useState<{ for: string; available: boolean; reason: string | null } | null>(null);
  const { submit, submitting, formError, serverFieldErrors } = useSubmit();

  const handle = username.trim().replace(/^@/, '');
  const debounced = useDebounced(handle, 350);
  useEffect(() => {
    if (!debounced || validateUsername(debounced)) return;
    let cancelled = false;
    authApi.usernameAvailable(debounced).then(
      (r) => !cancelled && setAvailability({ for: debounced, ...r }),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const formatError = handle ? validateUsername(handle) : undefined;
  const checked = availability?.for === handle ? availability : null;
  const usernameError = formatError ?? (checked && !checked.available ? checked.reason : null) ?? serverFieldErrors.username ?? null;
  const phoneError = touched && !isValidPhone(phone) ? 'Enter a valid phone number' : serverFieldErrors.phone ?? null;
  const canSend = isValidPhone(phone) && !!handle && !formatError && checked?.available !== false;

  const send = () => {
    setTouched(true);
    if (!canSend) return;
    void submit(async () => {
      await startSignup(normalizePhone(phone), handle);
      router.push('/signup-code');
    });
  };

  return (
    <Screen px={24} gap={28} bottom={20}>
      <Row between>
        <IconButton icon="back" label="Back" onPress={() => router.back()} />
        <StepDots step={1} />
        <View style={{ width: 44 }} />
      </Row>

      <View style={{ gap: 8 }}>
        <D size={44} lh={44} upper accessibilityRole="header">
          Create your account
        </D>
        <T size={15} lh={22} color={colors.muted}>
          Your phone number is your login. We text you a code to check it’s yours.
        </T>
      </View>

      <View style={{ gap: 18 }}>
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          prefix={<PhonePrefix code={env.defaultCountryCode} />}
          error={phoneError}
          size={17}
          autoFocus
        />
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          prefix={
            <T w={600} color={colors.faint}>
              @
            </T>
          }
          suffix={checked?.available && !formatError ? <View style={{ paddingRight: 10 }}><Icon name="check" size={20} color={colors.good} strokeWidth={2.4} /></View> : undefined}
          error={handle ? usernameError : null}
          success={checked?.available && !formatError ? `@${handle} is free` : null}
        />
        {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
      </View>

      <View style={{ marginTop: 'auto', gap: 16 }}>
        <T size={13} lh={19} color={colors.muted} center>
          By continuing you agree to the Terms and Privacy Policy.
        </T>
        <Button label="Send code" weight={700} onPress={send} loading={submitting} disabled={!canSend} />
        <Row gap={6} style={{ justifyContent: 'center' }}>
          <T size={14} color={colors.muted}>
            Already have an account?
          </T>
          <TextButton label="Log in" onPress={() => router.replace('/login')} />
        </Row>
      </View>
    </Screen>
  );
}
