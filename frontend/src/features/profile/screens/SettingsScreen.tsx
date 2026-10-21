import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { authApi } from '@/features/auth/api/auth.api';
import { getAppleCredential } from '@/features/auth/social/apple';
import { getGoogleIdToken } from '@/features/auth/social/google';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { LinkedIdentity, SessionInfo } from '@/features/auth/types';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useScoringPrefs } from '@/shared/prefs/scoring-prefs.store';
import { useTheme, useThemeStore, type ThemeMode } from '@/shared/theme';
import { Button, Group, GroupRow, Header, Icon, Label, Notice, Screen, Segmented, T, Toggle } from '@/shared/ui';
import { ago, prettyPhone } from '@/shared/utils/format';

function deviceLine(s: SessionInfo): string {
  if (s.current) return 'Active now';
  return s.lastUsedAt ? `Last used ${ago(s.lastUsedAt)}` : `Signed in ${ago(s.createdAt)}`;
}

/** Settings: account (phone, password, Google / Apple), devices, scoring preferences, log out. */
export default function SettingsScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const identities = useResource(() => authApi.identities(), []);
  const sessions = useResource(() => authApi.sessions(), []);
  const prefs = useScoringPrefs();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [message, setMessage] = useState<string | null>(null);
  const link = useSubmit();
  const others = useSubmit();

  const linked = (p: LinkedIdentity['provider']) => identities.data?.identities.find((i) => i.provider === p) ?? null;

  const linkProvider = (p: LinkedIdentity['provider']) =>
    void link.submit(async () => {
      if (p === 'google') {
        const token = await getGoogleIdToken();
        if (!token) return;
        identities.setData(await authApi.linkGoogle(token));
      } else {
        const credential = await getAppleCredential();
        if (!credential) return;
        identities.setData(await authApi.linkApple(credential.identityToken));
      }
    });

  const unlink = (p: LinkedIdentity['provider']) =>
    Alert.alert(`Unlink ${p === 'google' ? 'Google' : 'Apple'}?`, 'You can still log in with your phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unlink', style: 'destructive', onPress: () => void link.submit(async () => identities.setData(await authApi.unlink(p))) },
    ]);

  const providerRow = (p: LinkedIdentity['provider'], last: boolean) => {
    const id = linked(p);
    const name = p === 'google' ? 'Google' : 'Apple';
    const unavailable = p === 'apple' && Platform.OS !== 'ios' && !id;
    return (
      <GroupRow last={last} onPress={id ? () => unlink(p) : undefined} label={id ? `${name} linked` : name}>
        <T size={15} flex>
          {name}
        </T>
        {id ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="check" size={16} color={colors.good} strokeWidth={2.4} />
            <T size={14} w={600} color={colors.good}>
              Linked
            </T>
          </View>
        ) : (
          <Button label="Link" variant="outline" height={34} radius={10} size={14} inline px={14} disabled={unavailable || link.submitting} onPress={() => linkProvider(p)} />
        )}
      </GroupRow>
    );
  };

  const list = sessions.data?.sessions ?? [];

  return (
    <Screen gap={16}>
      <Header display="Settings" displaySize={32} />

      {message ? <Notice tone="info" icon="check" text={message} /> : null}
      {link.formError || others.formError ? <Notice tone="error" icon="alert" text={(link.formError ?? others.formError)!} /> : null}

      <View style={{ gap: 6 }}>
        <Label style={{ paddingLeft: 4 }}>Account</Label>
        <Group>
          <GroupRow>
            <T size={15} flex>
              Phone
            </T>
            <T size={14} color={colors.muted}>
              {user ? prettyPhone(user.phone) : ''}
            </T>
          </GroupRow>
          <GroupRow label="Change password" onPress={() => router.push({ pathname: '/settings/password', params: { identifier: user?.phone ?? '', auto: '1' } })}>
            <T size={15} flex>
              Change password
            </T>
            <Icon name="chevronRight" size={18} color={colors.muted} />
          </GroupRow>
          {providerRow('google', false)}
          {providerRow('apple', true)}
        </Group>
      </View>

      <View style={{ gap: 6 }}>
        <Label style={{ paddingLeft: 4 }}>Devices</Label>
        <Group>
          {list.map((s) => (
            <GroupRow key={s.id} minHeight={60}>
              <Icon name="phone" size={20} color={colors.fg} />
              <View style={{ flex: 1 }}>
                <T size={15}>
                  {s.deviceName ?? 'Unknown device'}
                  {s.current ? ' · this phone' : ''}
                </T>
                <T size={12} color={colors.muted}>
                  {deviceLine(s)}
                </T>
              </View>
            </GroupRow>
          ))}
          <GroupRow
            last
            label="Sign out other devices"
            onPress={
              list.some((s) => !s.current)
                ? () =>
                    void others.submit(async () => {
                      const { signedOut } = await authApi.signOutOtherDevices();
                      setMessage(signedOut ? `Signed out ${signedOut} other device${signedOut === 1 ? '' : 's'}.` : 'No other devices were signed in.');
                      await sessions.reload();
                    })
                : undefined
            }
          >
            <T size={15} w={600} color={list.some((s) => !s.current) ? colors.bad : colors.faint}>
              Sign out other devices
            </T>
          </GroupRow>
        </Group>
      </View>

      <View style={{ gap: 6 }}>
        <Label style={{ paddingLeft: 4 }}>While scoring</Label>
        <Group>
          <GroupRow minHeight={56}>
            <T size={15} flex>
              Keep screen on
            </T>
            <Toggle label="Keep screen on" value={prefs.keepAwake} onChange={(v) => prefs.set({ keepAwake: v })} />
          </GroupRow>
          <GroupRow minHeight={56} last>
            <T size={15} flex>
              Vibrate on each point
            </T>
            <Toggle label="Vibrate on each point" value={prefs.haptics} onChange={(v) => prefs.set({ haptics: v })} />
          </GroupRow>
        </Group>
      </View>

      <View style={{ gap: 6 }}>
        <Label style={{ paddingLeft: 4 }}>Appearance</Label>
        <Segmented<ThemeMode>
          options={[
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          value={mode}
          onChange={setMode}
          height={40}
          size={14}
        />
      </View>

      <Button
        label="Log out"
        variant="surface"
        height={52}
        radius={14}
        size={15}
        textColor={colors.bad}
        style={{ marginTop: 'auto' }}
        onPress={() =>
          Alert.alert('Log out?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
          ])
        }
      />
    </Screen>
  );
}
