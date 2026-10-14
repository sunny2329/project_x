import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { FormMessage, PrimaryButton, TextField } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing } from '@/shared/theme';
import { normalizePhone } from '@/shared/utils/phone';
import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { FooterPrompt } from '../components/FooterPrompt';
import { useAuthStore } from '../store/auth.store';
import {
  collectErrors,
  validateConfirmation,
  validateEmail,
  validateFullName,
  validateNewPassword,
  validatePhone,
  validateUsername,
  type Errors,
} from '../validation';

type Field = 'fullName' | 'username' | 'email' | 'phone' | 'password' | 'confirmPassword';

export default function SignUpScreen() {
  const startRegistration = useAuthStore((s) => s.startRegistration);
  const { submitting, formError, serverFieldErrors, submit } = useSubmit();
  const [values, setValues] = useState<Record<Field, string>>({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Errors<Field>>({});
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const set = (field: Field) => (text: string) => setValues((prev) => ({ ...prev, [field]: text }));
  const errorFor = (field: Field) => errors[field] ?? serverFieldErrors[field];

  // As on Strava, the button stays dimmed until every field has something in it.
  const filled = Object.values(values).every((value) => value.trim().length > 0);

  async function handleCreate() {
    const found = collectErrors<Field>({
      fullName: validateFullName(values.fullName),
      username: validateUsername(values.username),
      email: validateEmail(values.email),
      phone: validatePhone(values.phone),
      password: validateNewPassword(values.password),
      confirmPassword: validateConfirmation(values.password, values.confirmPassword),
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    const phone = normalizePhone(values.phone);
    const sent = await submit(() =>
      startRegistration({
        username: values.username.trim(),
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone,
        password: values.password,
      }),
    );
    if (sent) router.push({ pathname: '/verify', params: { flow: 'signup', phone } });
  }

  return (
    <AuthScreenLayout
      title="Create an Account"
      footer={<FooterPrompt prompt="Already have an account?" action="Log In" onPress={() => router.replace('/sign-in')} />}
    >
      <TextField
        placeholder="Full name"
        value={values.fullName}
        onChangeText={set('fullName')}
        error={errorFor('fullName')}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => usernameRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={usernameRef}
        placeholder="Username"
        value={values.username}
        onChangeText={set('username')}
        error={errorFor('username')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={emailRef}
        placeholder="Email"
        value={values.email}
        onChangeText={set('email')}
        error={errorFor('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={phoneRef}
        placeholder="Phone number"
        value={values.phone}
        onChangeText={set('phone')}
        error={errorFor('phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        placeholder="Password"
        value={values.password}
        onChangeText={set('password')}
        error={errorFor('password')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={confirmPasswordRef}
        placeholder="Confirm password"
        value={values.confirmPassword}
        onChangeText={set('confirmPassword')}
        error={errorFor('confirmPassword')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => (filled ? void handleCreate() : undefined)}
      />
      <FormMessage message={formError} />
      <View style={styles.primary}>
        <PrimaryButton title="Sign up" onPress={handleCreate} loading={submitting} disabled={!filled} />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  primary: { marginTop: spacing.sm },
});
