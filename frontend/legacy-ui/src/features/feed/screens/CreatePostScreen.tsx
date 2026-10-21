import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { Avatar, ChoiceChips, FormMessage, Screen, TopBar } from '@/shared/components';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { radius, spacing, typography, useTheme } from '@/shared/theme';
import { feedApi } from '../api/feed.api';
import type { PostVisibility } from '../types';

const MAX_LENGTH = 2000;

const VISIBILITY: { label: string; value: PostVisibility }[] = [
  { label: 'Public', value: 'public' },
  { label: 'Followers', value: 'followers' },
];

/** "New post": text with public / followers-only visibility. "Log match" jumps to starting a match. */
export default function CreatePostScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const { submitting, formError, serverFieldErrors, submit } = useSubmit();
  const canShare = content.trim().length > 0 && !submitting;

  async function share() {
    const ok = await submit(async () => {
      await feedApi.createPost(content.trim(), visibility);
    });
    if (ok) router.back();
  }

  const shareButton = (
    <Pressable
      onPress={() => void share()}
      disabled={!canShare}
      accessibilityRole="button"
      accessibilityLabel="Share post"
      accessibilityState={{ disabled: !canShare, busy: submitting }}
      style={({ pressed }) => [
        styles.share,
        { backgroundColor: pressed ? colors.primaryPressed : colors.primary, shadowColor: colors.primary, shadowOpacity: colors.glow },
        !canShare && styles.disabled,
      ]}
    >
      <Text style={[styles.shareText, { color: colors.onPrimary }]}>{submitting ? 'Sharing…' : 'Share'}</Text>
    </Pressable>
  );

  return (
    <Screen header={<TopBar title="New post" back="/" actions={shareButton} />}>
      <View style={styles.kinds}>
        <View style={[styles.kind, { backgroundColor: colors.primary }]}>
          <Feather name="edit-3" size={14} color={colors.onPrimary} />
          <Text style={[styles.kindText, { color: colors.onPrimary }]}>Post</Text>
        </View>
        <Pressable
          onPress={() => router.navigate('/play')}
          accessibilityRole="button"
          style={[styles.kind, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: StyleSheet.hairlineWidth * 2 }]}
        >
          <Feather name="award" size={14} color={colors.text} />
          <Text style={[styles.kindText, { color: colors.text }]}>Log match</Text>
        </Pressable>
      </View>

      <View style={styles.author}>
        <Avatar name={user?.fullName ?? '?'} size={44} />
        <View style={styles.authorText}>
          <Text style={[styles.name, { color: colors.text }]}>{user?.fullName}</Text>
          <ChoiceChips accessibilityLabel="Who can see this" options={VISIBILITY} value={visibility} onChange={setVisibility} />
        </View>
      </View>

      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Share a moment from your game…"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        multiline
        autoFocus
        maxLength={MAX_LENGTH}
        accessibilityLabel="Post text"
        style={[styles.input, { color: colors.text }]}
      />
      <Text style={[typography.caption, styles.counter, { color: colors.textMuted }]}>
        {content.length}/{MAX_LENGTH}
      </Text>
      <FormMessage message={formError ?? serverFieldErrors.content ?? null} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kinds: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg, marginBottom: spacing.lg },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 36,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
  },
  kindText: { fontSize: 14, fontWeight: '700' },
  author: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  authorText: { flex: 1, gap: spacing.sm },
  name: { fontSize: 16, fontWeight: '700' },
  input: { minHeight: 160, fontSize: 17, lineHeight: 24, textAlignVertical: 'top', padding: 0 },
  counter: { alignSelf: 'flex-end', marginBottom: spacing.md },
  share: {
    height: 36,
    paddingHorizontal: spacing.lg + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  shareText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
