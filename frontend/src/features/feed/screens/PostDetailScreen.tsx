import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, TextInput, View } from 'react-native';
import { ScoreLines } from '@/features/match/components/MatchCards';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { bodyFont, useTheme } from '@/shared/theme';
import { Avatar, Button, Header, Icon, IconButton, Loading, Notice, Row, Screen, T, Tap } from '@/shared/ui';
import { ago, agoShort, shortName } from '@/shared/utils/format';
import { feedApi } from '../api/feed.api';
import { PostPhotos, resultTitle } from '../components/PostCards';
import { usePostLike } from '../hooks/usePostLike';
import type { FeedPost } from '../types';

function Actions({ post, onComment }: { post: FeedPost; onComment: () => void }) {
  const { colors } = useTheme();
  const like = usePostLike(post);
  return (
    <Row gap={10}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: like.likedByMe }}
        accessibilityLabel={like.likedByMe ? 'Unlike' : 'Like'}
        onPress={() => void like.toggle()}
        style={{ height: 40, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: like.likedByMe ? 'rgba(255,84,104,0.14)' : colors.surface }}
      >
        <Icon name="heart" size={18} color={like.likedByMe ? colors.bad : colors.fg} filled={like.likedByMe} />
        <T size={14} w={like.likedByMe ? 700 : 600} color={like.likedByMe ? colors.bad : colors.fg}>
          {like.likeCount}
        </T>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Comment" onPress={onComment} style={{ height: 40, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.surface }}>
        <Icon name="chat" size={18} color={colors.fg} />
        <T size={14} w={600}>
          {post.commentCount}
        </T>
      </Pressable>
      <IconButton
        icon="share"
        label="Share"
        size={40}
        radius={12}
        style={{ marginLeft: 'auto' }}
        onPress={() => void Share.share({ message: `${shortName(post.author.fullName)} on ProjectX: ${post.content || (post.match ? resultTitle(post) : '')}` })}
      />
    </Row>
  );
}

/** A post with its likes and comments; the composer is pinned to the bottom. */
export default function PostDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = useResource(() => feedApi.getPost(id), [id]);
  const comments = useResource(() => feedApi.comments(id), [id]);
  const [draft, setDraft] = useState('');
  const [focusKey, setFocusKey] = useState(0);
  const { submit, submitting, formError } = useSubmit();

  if (post.loading) return <Loading />;
  const p = post.data?.post;

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    void submit(async () => {
      const { comment } = await feedApi.addComment(id, content);
      setDraft('');
      comments.setData((prev) => ({ comments: [...(prev?.comments ?? []), comment], nextCursor: prev?.nextCursor ?? null }));
      post.setData((prev) => (prev ? { post: { ...prev.post, commentCount: prev.post.commentCount + 1 } } : prev));
    });
  };

  return (
    <Screen
      gap={18}
      footerBar
      footer={
        <View style={{ gap: 8 }}>
          {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
          <Row gap={10}>
            <TextInput
              key={focusKey}
              autoFocus={focusKey > 0}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment"
              placeholderTextColor={colors.faint}
              accessibilityLabel="Add a comment"
              maxLength={1000}
              onSubmitEditing={send}
              returnKeyType="send"
              style={{ flex: 1, height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, color: colors.fg, fontFamily: bodyFont(400), fontSize: 15 }}
            />
            <IconButton icon="send" label="Send" tone="primary" size={46} radius={23} onPress={send} disabled={submitting || !draft.trim()} />
          </Row>
        </View>
      }
    >
      <Header title="Post" />
      {!p ? (
        <Notice tone="error" icon="alert" text={post.error ?? 'This post is gone.'} />
      ) : (
        <>
          <View style={{ gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.raised }}>
            <Tap label={p.author.fullName} onPress={() => router.push({ pathname: '/user/[id]', params: { id: p.author.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={p.author.fullName} id={p.author.id} photoUrl={p.author.photoUrl} size={44} />
              <View>
                <T size={15} w={700}>
                  {shortName(p.author.fullName)}
                </T>
                <T size={13} color={colors.muted}>
                  @{p.author.username} · {ago(p.createdAt)}
                </T>
              </View>
            </Tap>
            {p.content ? (
              <T size={17} lh={26}>
                {p.content}
              </T>
            ) : null}
            {p.match?.result ? (
              <Tap label="Match result" onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: p.match!.id } })} style={{ gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
                <T size={12} color={colors.muted}>
                  {p.match.sport.name}
                  {p.match.format ? ` · ${p.match.format}` : ''}
                </T>
                <ScoreLines sides={p.match.result.sides} segments={p.match.result.segments} winnerSideIndex={p.match.result.winnerSideIndex} color={p.match.sport.accentColor} />
              </Tap>
            ) : null}
            <PostPhotos urls={p.media} height={220} />
            <Actions post={p} onComment={() => setFocusKey((k) => k + 1)} />
          </View>

          <View style={{ gap: 16 }}>
            {(comments.data?.comments ?? []).map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', gap: 10 }}>
                <Tap label={c.author.fullName} onPress={() => router.push({ pathname: '/user/[id]', params: { id: c.author.id } })}>
                  <Avatar name={c.author.fullName} id={c.author.id} photoUrl={c.author.photoUrl} size={34} />
                </Tap>
                <View style={{ flex: 1, gap: 4 }}>
                  <T size={13}>
                    <T size={13} w={700}>
                      {shortName(c.author.fullName)}
                    </T>{' '}
                    <T size={13} color={colors.muted}>
                      · {agoShort(c.createdAt)}
                    </T>
                  </T>
                  <T size={15} lh={22}>
                    {c.content}
                  </T>
                </View>
              </View>
            ))}
            {comments.data && !comments.data.comments.length ? (
              <T size={14} color={colors.muted}>
                No comments yet. Say something nice.
              </T>
            ) : null}
            {comments.data?.nextCursor ? (
              <Button
                label="Older comments"
                variant="ghost"
                height={40}
                onPress={() =>
                  void feedApi.comments(id, comments.data!.nextCursor!).then((r) => comments.setData((prev) => ({ comments: [...(prev?.comments ?? []), ...r.comments], nextCursor: r.nextCursor })))
                }
              />
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}
