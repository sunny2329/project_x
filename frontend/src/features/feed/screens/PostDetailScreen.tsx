import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { Avatar, Composer, EmptyState, FormMessage, IconButton, Screen, TextLink, TopBar } from '@/shared/components';
import { ApiError } from '@/shared/api/client';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { spacing, typography, useTheme } from '@/shared/theme';
import { formatRelativeTime } from '@/shared/utils/time';
import { feedApi } from '../api/feed.api';
import { PostCard } from '../components/PostCard';
import type { FeedPost, PostComment } from '../types';

const COMMENT_MAX = 1000;

/** One post with its comments and a comment box. Long-press a comment to delete it (yours, or any on your post). */
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const send = useSubmit();

  const load = useCallback(async () => {
    try {
      const [{ post: loaded }, page] = await Promise.all([feedApi.getPost(id), feedApi.comments(id)]);
      setPost(loaded);
      setComments(page.comments);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this post.');
    }
  }, [id]);

  // Reload on focus, e.g. back from a match opened from this post.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function loadMore() {
    if (!nextCursor) return;
    const page = await feedApi.comments(id, nextCursor).catch(() => null);
    if (!page) return;
    setComments((prev) => [...prev, ...page.comments]);
    setNextCursor(page.nextCursor);
  }

  async function addComment() {
    const content = draft.trim();
    if (!content) return;
    await send.submit(async () => {
      const { comment } = await feedApi.addComment(id, content);
      // Only append once every older page is loaded, so the list stays in order.
      if (!nextCursor) setComments((prev) => [...prev, comment]);
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
      setDraft('');
    });
  }

  function confirmDeleteComment(comment: PostComment) {
    const mine = comment.author.id === me?.id || post?.author.id === me?.id;
    if (!mine) return;
    Alert.alert('Delete comment?', comment.content, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void feedApi
            .deleteComment(id, comment.id)
            .then(() => {
              setComments((prev) => prev.filter((c) => c.id !== comment.id));
              setPost((prev) => (prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev));
            })
            .catch(() => undefined),
      },
    ]);
  }

  function confirmDeletePost() {
    Alert.alert('Delete post?', 'Its likes and comments are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void feedApi.deletePost(id).then(() => router.back()).catch(() => undefined) },
    ]);
  }

  // Automatic match-result posts have a match and can't be deleted.
  const canDelete = post && post.author.id === me?.id && !post.match;
  const header = (
    <TopBar
      title="Post"
      back="/"
      actions={canDelete ? <IconButton icon="trash-2" label="Delete post" onPress={confirmDeletePost} /> : undefined}
    />
  );
  const footer = post ? (
    <Composer
      value={draft}
      onChangeText={setDraft}
      onSend={() => void addComment()}
      placeholder="Add a comment…"
      sending={send.submitting}
      maxLength={COMMENT_MAX}
      leading={<Avatar name={me?.fullName ?? '?'} size={36} />}
    />
  ) : null;

  return (
    <Screen header={header} footer={footer} padded={false} onRefresh={() => void load()} refreshing={false}>
      {!post ? (
        error ? (
          <EmptyState tone="error" icon="alert-triangle" title="Post unavailable" message={error} action={{ label: 'Try again', onPress: () => void load() }} />
        ) : (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        )
      ) : (
        <>
          <PostCard post={post} standalone commentCount={post.commentCount} />
          <View style={styles.comments}>
            <FormMessage message={send.formError ?? send.serverFieldErrors.content ?? null} />
            {comments.length === 0 ? (
              <Text style={[typography.body, styles.none, { color: colors.textMuted }]}>No comments yet. Start the conversation.</Text>
            ) : (
              comments.map((comment) => (
                <Pressable
                  key={comment.id}
                  onLongPress={() => confirmDeleteComment(comment)}
                  delayLongPress={350}
                  accessibilityHint="Long-press to delete"
                  style={styles.comment}
                >
                  <Avatar name={comment.author.fullName} size={36} />
                  <View style={styles.commentBody}>
                    <Text style={[typography.body, { color: colors.text }]}>
                      <Text style={styles.commentAuthor}>{comment.author.fullName} </Text>
                      {comment.content}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{formatRelativeTime(comment.createdAt)}</Text>
                  </View>
                </Pressable>
              ))
            )}
            {nextCursor ? (
              <View style={styles.more}>
                <TextLink title="Load more comments" onPress={() => void loadMore()} />
              </View>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  comments: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, gap: spacing.lg },
  none: { textAlign: 'center', paddingVertical: spacing.lg },
  comment: { flexDirection: 'row', gap: spacing.md },
  commentBody: { flex: 1, gap: spacing.xs },
  commentAuthor: { fontWeight: '700' },
  more: { alignItems: 'center' },
});
