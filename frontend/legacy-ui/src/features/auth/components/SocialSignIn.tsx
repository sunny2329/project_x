import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { OutlineButton } from '@/shared/components';
import { spacing, useTheme } from '@/shared/theme';
import { isAppleSignInAvailable } from '../social/apple';
import { useAuthStore } from '../store/auth.store';

type Provider = 'google' | 'apple';

interface SocialSignInProps {
  disabled?: boolean;
  /** Runs the provider sign-in through the parent's submit handler so errors show in its form. */
  onSubmit: (action: () => Promise<void>) => Promise<boolean>;
}

/** Strava-style full-width outlined "Continue with …" pills: Google, phone, and Apple on iOS devices that support it. */
export function SocialSignIn({ disabled = false, onSubmit }: SocialSignInProps) {
  const { colors } = useTheme();
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithApple = useAuthStore((s) => s.signInWithApple);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pending, setPending] = useState<Provider | null>(null);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  async function run(provider: Provider, action: () => Promise<boolean>) {
    setPending(provider);
    await onSubmit(async () => {
      await action();
    });
    setPending(null);
  }

  const busy = disabled || pending !== null;

  return (
    <View style={styles.container}>
      <OutlineButton
        title="Continue with Google"
        icon={<AntDesign name="google" size={18} color={colors.text} />}
        onPress={() => run('google', signInWithGoogle)}
        loading={pending === 'google'}
        disabled={busy}
      />
      <OutlineButton
        title="Continue with phone"
        icon={<Feather name="smartphone" size={18} color={colors.text} />}
        onPress={() => router.push('/phone')}
        disabled={busy}
      />
      {appleAvailable ? (
        <OutlineButton
          title="Continue with Apple"
          icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
          onPress={() => run('apple', signInWithApple)}
          loading={pending === 'apple'}
          disabled={busy}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
