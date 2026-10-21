import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { env } from '@/shared/config/env';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, Field, IconButton, Notice, PhonePrefix, Row, Screen, Segmented, T, TextButton } from '@/shared/ui';
import { isValidPhone, normalizePhone } from '@/shared/utils/phone';
import { normalizeIdentifier } from '../identifier';
import { useAuthStore } from '../store/auth.store';
import { validateIdentifier } from '../validation';

type Tab = 'pass' | 'code';

/** "Welcome back": password or a texted code; Google / Apple for accounts that linked them in Settings. */
export default function LoginScreen() {
  const { colors } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const startPhoneSignIn = useAuthStore((s) => s.startPhoneSignIn);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithApple = useAuthStore((s) => s.signInWithApple);
  const [tab, setTab] = useState<Tab>('pass');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const { submit, submitting, formError, clearErrors } = useSubmit();
  const social = useSubmit();

  const identifierError = touched && tab === 'pass' ? validateIdentifier(identifier) : undefined;
  const passwordError = touched && tab === 'pass' && !password ? 'Enter your password' : undefined;
  const phoneError = touched && tab === 'code' && !isValidPhone(phone) ? 'Enter a valid phone number' : undefined;

  const go = () => {
    setTouched(true);
    if (tab === 'pass') {
      if (validateIdentifier(identifier) || !password) return;
      void submit(() => signIn(normalizeIdentifier(identifier), password));
    } else {
      if (!isValidPhone(phone)) return;
      const e164 = normalizePhone(phone);
      void submit(async () => {
        await startPhoneSignIn(e164);
        router.push({ pathname: '/login-code', params: { phone: e164 } });
      });
    }
  };

  return (
    <Screen px={24} gap={24} bottom={20}>
      <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />

      <D size={48} lh={46} upper accessibilityRole="header">
        Welcome back
      </D>

      <Segmented<Tab>
        options={[
          { value: 'pass', label: 'Password' },
          { value: 'code', label: 'Text me a code' },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setTouched(false);
          clearErrors();
        }}
      />

      {tab === 'pass' ? (
        <View style={{ gap: 16 }}>
          <Field
            label="Phone or username"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            error={identifierError}
          />
          <View style={{ gap: 0 }}>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              error={passwordError}
              onSubmitEditing={go}
              returnKeyType="go"
            />
            <TextButton
              label="Forgot password?"
              weight={600}
              style={{ alignSelf: 'flex-end' }}
              onPress={() => router.push({ pathname: '/forgot-password', params: identifier.trim() ? { identifier: identifier.trim() } : {} })}
            />
          </View>
        </View>
      ) : (
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          prefix={<PhonePrefix code={env.defaultCountryCode} />}
          error={phoneError}
          hint="We text a 6-digit code. No password needed."
        />
      )}

      {formError || social.formError ? <Notice tone="error" icon="alert" text={(formError ?? social.formError)!} /> : null}

      <Button label={tab === 'pass' ? 'Log in' : 'Send code'} weight={700} onPress={go} loading={submitting} />

      <Row gap={12}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <T size={13} color={colors.faint}>
          or
        </T>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </Row>

      <View style={{ gap: 0 }}>
        <Row gap={12}>
          {(['Google', 'Apple'] as const).map((provider) => (
            <Button
              key={provider}
              label={provider}
              variant="outline"
              height={52}
              radius={14}
              weight={600}
              style={{ flex: 1 }}
              disabled={provider === 'Apple' && Platform.OS !== 'ios'}
              onPress={() => void social.submit(async () => void (provider === 'Google' ? await signInWithGoogle() : await signInWithApple()))}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <T size={13} w={800} color={colors.onPrimary}>
                  {provider[0]}
                </T>
              </View>
              <T size={15} w={600}>
                {provider}
              </T>
            </Button>
          ))}
        </Row>
        <T size={12} lh={18} color={colors.muted} center style={{ marginTop: 14 }}>
          Google and Apple work once linked in Settings.
        </T>
      </View>

      <Row gap={6} style={{ marginTop: 'auto', justifyContent: 'center' }}>
        <T size={14} color={colors.muted}>
          New here?
        </T>
        <TextButton label="Create an account" onPress={() => router.replace('/signup')} />
      </Row>
    </Screen>
  );
}
