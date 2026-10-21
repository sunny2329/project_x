import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { sportIcon } from '@/features/match/format';
import { Avatar } from '@/shared/components';
import { spacing, typography, useTheme } from '@/shared/theme';
import { formatActivityTime, formatDuration, timeOfDay } from '@/shared/utils/time';
import { usePostLike } from '../hooks/usePostLike';
import type { FeedMatch, FeedPost } from '../types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface PostCardProps {
  post: FeedPost;
  /** On the post's own screen: the text and comment count don't navigate again. */
  standalone?: boolean;
  /** Replaces the comment count shown, e.g. after comments were added on the post screen. */
  commentCount?: number;
}

function matchStats(match: FeedMatch): { label: string; value: string }[] {
  const stats: { label: string; value: string }[] = [];
  const result = match.result;
  if (result && result.sides.length === 2) {
    const [a, b] = [...result.sides].sort((x, y) => x.index - y.index);
    stats.push({ label: 'Score', value: `${a!.primary}–${b!.primary}` });
  }
  if (match.durationSeconds !== null) stats.push({ label: 'Time', value: formatDuration(match.durationSeconds) });
  if (result && result.segmentCount > 0) stats.push({ label: 'Played', value: result.headline });
  return stats;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * A Strava-style activity card: author with time and format, a big title ("Morning Pickleball")
 * and stats row for match results, the text, a likes / comments line, then like, comment and share.
 */
export function PostCard({ post, standalone = false, commentCount }: PostCardProps) {
  const { colors } = useTheme();
  const like = usePostLike(post);
  const match = post.match;
  const comments = commentCount ?? post.commentCount;
  const openPost = standalone ? undefined : () => router.push({ pathname: '/post/[id]', params: { id: post.id } });
  // Match results open the scoreboard; written posts open the post with its comments.
  const openBody = match ? () => router.push({ pathname: '/match/[id]', params: { id: match.id } }) : openPost;
  const title = match ? `${timeOfDay(post.createdAt)} ${match.sport.name}` : null;
  const stats = match ? matchStats(match) : [];
  const details = [formatActivityTime(post.createdAt), match?.format, post.visibility === 'followers' ? 'Followers' : null].filter(Boolean);

  function share() {
    const message = [title, post.content].filter(Boolean).join('\n');
    void Share.share({ message: message || `${post.author.fullName} on ProjectX` }).catch(() => undefined);
  }

  return (
    <View style={[styles.post, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Avatar name={post.author.fullName} size={44} />
        <View style={styles.author}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {post.author.fullName}
          </Text>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name={match ? sportIcon(match.sport) : 'pencil-outline'}
              size={14}
              color={colors.textMuted}
            />
            <Text style={[styles.details, { color: colors.textMuted }]} numberOfLines={1}>
              {details.join(' · ')}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={openBody}
        disabled={!openBody}
        accessibilityRole={openBody ? 'button' : undefined}
        accessibilityHint={match ? 'Opens the scoreboard' : 'Opens the post'}
        style={({ pressed }) => [styles.body, pressed && openBody ? { opacity: 0.7 } : null]}
      >
        {title ? <Text style={[typography.activityTitle, { color: colors.text }]}>{title}</Text> : null}
        {post.content ? (
          <Text style={[match ? styles.description : styles.content, { color: match ? colors.textMuted : colors.text }]}>{post.content}</Text>
        ) : null}
        {stats.length ? (
          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                <Text style={[typography.stat, { color: colors.text }]}>{stat.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>

      {like.likeCount > 0 || comments > 0 ? (
        <Pressable onPress={openPost} disabled={!openPost} accessibilityRole={openPost ? 'button' : undefined} style={styles.counts}>
          <Text style={[styles.countText, { color: colors.textMuted }]}>{like.likeCount > 0 ? plural(like.likeCount, 'like') : ''}</Text>
          <Text style={[styles.countText, { color: colors.textMuted }]}>{comments > 0 ? plural(comments, 'comment') : ''}</Text>
        </Pressable>
      ) : null}

      <View style={[styles.actions, { borderTopColor: colors.divider }]}>
        <Action
          icon={like.likedByMe ? 'thumb-up' : 'thumb-up-outline'}
          label={like.likedByMe ? 'Unlike' : 'Like'}
          selected={like.likedByMe}
          color={like.likedByMe ? colors.primary : colors.text}
          onPress={() => void like.toggle()}
        />
        <Action icon="comment-outline" label="Comment" color={colors.text} onPress={openPost} />
        <Action icon="share-variant-outline" label="Share" color={colors.text} onPress={share} />
      </View>
    </View>
  );
}

interface ActionProps {
  icon: IconName;
  label: string;
  color: string;
  onPress: (() => void) | undefined;
  selected?: boolean;
}

function Action({ icon, label, color, onPress, selected }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
    >
      <MaterialCommunityIcons name={icon} size={24} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  post: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  author: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  details: { ...typography.caption, flexShrink: 1 },
  body: { gap: spacing.sm },
  content: { fontSize: 15, lineHeight: 22 },
  description: { fontSize: 14, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.xl + 4, marginTop: spacing.xs },
  stat: { gap: 2 },
  statLabel: { fontSize: 12 },
  counts: { flexDirection: 'row', justifyContent: 'space-between' },
  countText: { fontSize: 13 },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: -spacing.screen },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
});
