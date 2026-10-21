import Feather from '@expo/vector-icons/Feather';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { Avatar, FormMessage, ListGroup, ListRow, Screen, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { radius, spacing, typography, useTheme, useThemeStore, type ThemeMode } from '@/shared/theme';
import { useProfileStore } from '../store/profile.store';

/** Account card, account details, and log out. */
export default function SettingsScreen() {
  const { colors } = useTheme();
  const profileUser = useProfileStore((s) => s.profile?.user);
  const authUser = useAuthStore((s) => s.user);
  const user = profileUser ?? authUser;
  const signOut = useAuthStore((s) => s.signOut);
  const signOutState = useSubmit();
  if (!user) return null;

  return (
    <Screen header={<TopBar title="Settings" back="/profile" />}>
      <View style={styles.content}>
        <Pressable
          onPress={() => router.navigate('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          style={({ pressed }) => [
            styles.account,
            { backgroundColor: pressed ? colors.secondaryButtonPressed : colors.surface, borderColor: colors.surfaceBorder },
          ]}
        >
          <Avatar name={user.fullName} size={56} ring />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {user.fullName}
            </Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>@{user.username}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.icon} />
        </Pressable>

        <ListGroup title="Account">
          <ListRow icon="user" label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <ListRow icon="mail" label="Email" value={user.email ?? '—'} />
          <ListRow icon="phone" label="Phone" value={`${user.phone}${user.phoneVerified ? ' ✓' : ''}`} />
        </ListGroup>

        <AppearancePicker />

        <ListGroup title="Preferences">
          <ListRow icon="target" label="Favourite sports" onPress={() => router.push('/edit-profile')} />
        </ListGroup>

        <FormMessage message={signOutState.formError} />
        <Pressable
          onPress={() => void signOutState.submit(signOut)}
          disabled={signOutState.submitting}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => [
            styles.logout,
            { borderColor: colors.error, backgroundColor: pressed ? colors.errorSurface : 'transparent' },
            signOutState.submitting && styles.busy,
          ]}
        >
          <Feather name="log-out" size={17} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Log out</Text>
        </Pressable>
        <Text style={[typography.caption, styles.version, { color: colors.textMuted }]}>
          Project X · v{Constants.expoConfig?.version ?? '0.1.0'} (MVP)
        </Text>
      </View>
    </Screen>
  );
}

const MODES: { mode: ThemeMode; label: string; icon: 'smartphone' | 'sun' | 'moon' }[] = [
  { mode: 'system', label: 'System', icon: 'smartphone' },
  { mode: 'light', label: 'Light', icon: 'sun' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
];

/** System / Light / Dark as three cards; saved on the device. */
function AppearancePicker() {
  const { colors } = useTheme();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return (
    <View style={styles.appearance}>
      <Text style={[typography.overline, styles.groupTitle, { color: colors.textMuted }]}>Appearance</Text>
      <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
        {MODES.map((option) => {
          const selected = option.mode === mode;
          return (
            <Pressable
              key={option.mode}
              onPress={() => setMode(option.mode)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={[
                styles.mode,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  borderColor: selected ? colors.primary : colors.surfaceBorder,
                },
              ]}
            >
              <Feather name={option.icon} size={22} color={selected ? colors.primary : colors.icon} />
              <Text style={[styles.modeLabel, { color: selected ? colors.primary : colors.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appearance: { gap: spacing.sm },
  groupTitle: { marginLeft: spacing.xs },
  modes: { flexDirection: 'row', gap: spacing.sm + 2 },
  mode: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
  },
  modeLabel: { fontSize: 14, fontWeight: '700' },
  content: { paddingTop: spacing.lg, gap: spacing.xl },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700' },
  logout: {
    height: 52,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  logoutText: { fontSize: 16, fontWeight: '700' },
  busy: { opacity: 0.5 },
  version: { textAlign: 'center', marginTop: -spacing.md },
});
