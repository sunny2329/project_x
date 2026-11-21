import { router } from 'expo-router';
import { Image, View } from 'react-native';
import { ScoreLines } from '@/features/match/components/MatchCards';
import { sportText, useTheme, withAlpha } from '@/shared/theme';
import { Avatar, Icon, mediaUri, T, Tap } from '@/shared/ui';
import { ago, minutes, shortName } from '@/shared/utils/format';
import { usePostLike } from '../hooks/usePostLike';
import type { FeedPost } from '../types';

/** True when the post's author scored or organised the match without playing in it. */
export function authorIsScorer(post: FeedPost): boolean {
  return post.match !== null && post.match.authorSideIndex === null;
}

/**
 * "Kabir M won at badminton" / "lost" / "played" when the author played; otherwise the result
 * itself ("Smashers beat Aces"), since the author only scored it.
 */
export function resultTitle(post: FeedPost): string {
  const m = post.match!;
  const who = shortName(post.author.fullName);
  const sport = m.sport.name.toLowerCase();
  const winner = m.result?.winnerSideIndex;
  if (authorIsScorer(post)) {
    const [a, b] = m.result?.sides ?? [];
    if (!a || !b) return `${m.sport.name} match`;
    if (winner === null || winner === undefined) return `${a.name} drew with ${b.name}`;
    const won = winner === a.index ? a : b;
    const lost = won === a ? b : a;
    return `${won.name} beat ${lost.name}`;
  }
  if (winner === null || winner === undefined) return `${who} played ${sport}`;
  return `${who} ${winner === m.authorSideIndex ? 'won' : 'lost'} at ${sport}`;
}

/** "Summer Open · Men's Doubles · Quarter-final" for a tournament match; null for a friendly. */
export function tournamentLine(post: FeedPost): string | null {
  const t = post.match?.tournament;
  if (!t) return null;
  return [t.name, t.eventName, t.groupName ?? t.roundName].filter(Boolean).join(' · ');
}

/** Trophy + tournament, event and round, under a tournament match's title. */
export function TournamentTag({ post }: { post: FeedPost }) {
  const { colors } = useTheme();
  const line = tournamentLine(post);
  if (!line) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.raised }}>
      <Icon name="trophy" size={14} color={sportText(colors, post.match!.sport.slug)} />
      <T size={12} w={600} numberOfLines={1} style={{ flexShrink: 1 }}>
        {line}
      </T>
    </View>
  );
}

function Counts({ post }: { post: FeedPost }) {
  const { colors } = useTheme();
  const like = usePostLike(post);
  return (
    <View style={{ flexDirection: 'row', gap: 18 }}>
      <Tap label={like.likedByMe ? 'Unlike' : 'Like'} onPress={() => void like.toggle()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
        <Icon name="heart" size={17} color={like.likedByMe ? colors.bad : colors.muted} filled={like.likedByMe} />
        <T size={13} color={like.likedByMe ? colors.bad : colors.muted}>
          {like.likeCount}
        </T>
      </Tap>
      <Tap label="Comments" onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
        <Icon name="chat" size={17} color={colors.muted} />
        <T size={13} color={colors.muted}>
          {post.commentCount}
        </T>
      </Tap>
    </View>
  );
}

/** Photos under a post: one full width, two or more in a two-column grid. */
export function PostPhotos({ urls, height = 180 }: { urls: string[]; height?: number }) {
  const { colors } = useTheme();
  if (!urls.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {urls.map((url) => (
        <Image
          key={url}
          source={{ uri: mediaUri(url)! }}
          style={{ width: urls.length === 1 ? '100%' : '48.5%', height: urls.length === 1 ? height : height * 0.78, borderRadius: 14, backgroundColor: colors.raised }}
        />
      ))}
    </View>
  );
}

/** A match result post (automatic or shared): who won, the rating change and the score per game. */
export function ResultPostCard({ post }: { post: FeedPost }) {
  const { colors } = useTheme();
  const m = post.match!;
  const color = m.sport.accentColor;
  const delta = m.authorRatingChange;
  const scorer = authorIsScorer(post);
  const meta = scorer
    ? [`Scored by ${shortName(post.author.fullName)}`, m.sport.name, m.format, ago(post.createdAt)].filter(Boolean).join(' · ')
    : [m.format, ago(post.createdAt), m.venue ?? minutes(m.durationSeconds)].filter(Boolean).join(' · ');
  return (
    <Tap
      label={resultTitle(post)}
      onPress={() => router.push({ pathname: '/match/[id]/result', params: { id: m.id } })}
      style={{ gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={post.author.fullName} id={post.author.id} photoUrl={post.author.photoUrl} size={36} />
        <View style={{ flex: 1 }}>
          <T size={14} w={600} numberOfLines={1}>
            {resultTitle(post)}
          </T>
          <T size={12} color={colors.muted} numberOfLines={1}>
            {meta}
          </T>
        </View>
        {delta !== null && delta !== 0 ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: withAlpha(color, 0.16) }}>
            <T size={12} w={700} color={sportText(colors, m.sport.slug)}>
              {delta > 0 ? `+${delta}` : `${delta}`}
            </T>
          </View>
        ) : null}
      </View>
      <TournamentTag post={post} />
      {post.content && !post.isResult ? (
        <T size={15} lh={22}>
          {post.content}
        </T>
      ) : null}
      {m.result ? <ScoreLines sides={m.result.sides} segments={m.result.segments} winnerSideIndex={m.result.winnerSideIndex} color={color} background={colors.bg} /> : null}
      <PostPhotos urls={post.media} />
      <Counts post={post} />
    </Tap>
  );
}

/** A plain post: author, time, text and photos. */
export function TextPostCard({ post }: { post: FeedPost }) {
  const { colors } = useTheme();
  return (
    <Tap
      label={`Post by ${post.author.fullName}`}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      style={{ gap: 10, padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={post.author.fullName} id={post.author.id} photoUrl={post.author.photoUrl} size={36} />
        <View style={{ flex: 1 }}>
          <T size={14} w={600}>
            {shortName(post.author.fullName)}
          </T>
          <T size={12} color={colors.muted}>
            {ago(post.createdAt)}
          </T>
        </View>
      </View>
      {post.content ? (
        <T size={15} lh={22}>
          {post.content}
        </T>
      ) : null}
      <PostPhotos urls={post.media} />
      {post.likeCount || post.commentCount ? <Counts post={post} /> : null}
    </Tap>
  );
}

export function PostCard({ post }: { post: FeedPost }) {
  return post.match ? <ResultPostCard post={post} /> : <TextPostCard post={post} />;
}
