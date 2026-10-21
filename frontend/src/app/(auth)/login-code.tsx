import { router, useLocalSearchParams } from 'expo-router';
import { CodeScreen } from '@/features/auth/screens/CodeScreen';
import { useAuthStore } from '@/features/auth/store/auth.store';

/** Log in with a texted code (no password). */
export default function LoginCode() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const verifyPhoneSignIn = useAuthStore((s) => s.verifyPhoneSignIn);
  const startPhoneSignIn = useAuthStore((s) => s.startPhoneSignIn);
  return (
    <CodeScreen
      phone={phone}
      onVerify={(code) => verifyPhoneSignIn(phone, code)}
      onResend={() => startPhoneSignIn(phone)}
      onChangeNumber={() => router.back()}
    />
  );
}
