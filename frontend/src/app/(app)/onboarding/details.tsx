import SignupDetailsScreen from '@/features/auth/screens/SignupDetailsScreen';

/** "About you" again, reached with Back from "What do you play?" once the account exists. */
export default function OnboardingDetails() {
  return <SignupDetailsScreen mode="edit" />;
}
