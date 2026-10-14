import { useCallback, useMemo, useRef, useState } from 'react';
import { feedApi } from '../api/feed.api';
import type { FeedPost, LikeState } from '../types';

/**
 * Like / unlike with an instant (optimistic) update, rolled back if the request fails. The local
 * value is dropped as soon as a refreshed `post` arrives with different counts.
 */
export function usePostLike(post: Pick<FeedPost, 'id' | 'likeCount' | 'likedByMe'>) {
  const source = `${post.id}:${post.likeCount}:${post.likedByMe}`;
  const [local, setLocal] = useState<(LikeState & { source: string }) | null>(null);
  const busy = useRef(false);
  const current = useMemo<LikeState>(
    () => (local?.source === source ? local : { likeCount: post.likeCount, likedByMe: post.likedByMe }),
    [local, source, post.likeCount, post.likedByMe],
  );

  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const next = { likedByMe: !current.likedByMe, likeCount: current.likeCount + (current.likedByMe ? -1 : 1) };
    setLocal({ ...next, source });
    try {
      const saved = await (current.likedByMe ? feedApi.unlike(post.id) : feedApi.like(post.id));
      setLocal({ ...saved, source });
    } catch {
      setLocal({ ...current, source });
    } finally {
      busy.current = false;
    }
  }, [current, post.id, source]);

  return { ...current, toggle };
}
