import { router } from 'expo-router';
import { CodeScreen } from '@/features/auth/screens/CodeScreen';
import { useAuthStore } from '@/features/auth/store/auth.store';

/** Sign-up 2/4: the code texted to the new phone number. */
export default function SignupCode() {
  const pending = useAuthStore((s) => s.pendingSignup);
  const verifySignup = useAuthStore((s) => s.verifySignup);
  const resendSignupCode = useAuthStore((s) => s.resendSignupCode);
  return (
    <CodeScreen
      phone={pending?.phone ?? ''}
      step={2}
      onVerify={async (code) => {
        await verifySignup(code);
        router.push('/signup-details');
      }}
      onResend={resendSignupCode}
      onChangeNumber={() => router.back()}
    />
  );
}
