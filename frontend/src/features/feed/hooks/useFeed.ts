import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { feedApi } from '../api/feed.api';
import type { FeedPost } from '../types';

interface FeedState {
  posts: FeedPost[];
  nextCursor: string | null;
  loaded: boolean;
  loadingMore: boolean;
  error: string | null;
}

const INITIAL: FeedState = { posts: [], nextCursor: null, loaded: false, loadingMore: false, error: null };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Could not load the feed.';
}

/** First page on `refresh()`, following pages on `loadMore()`. */
export function useFeed() {
  const [state, setState] = useState<FeedState>(INITIAL);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const page = await feedApi.list();
      setState({ posts: page.posts, nextCursor: page.nextCursor, loaded: true, loadingMore: false, error: null });
    } catch (error) {
      setState((prev) => ({ ...prev, loaded: true, error: messageOf(error) }));
    }
  }, []);

  const loadMore = useCallback(async () => {
    const cursor = state.nextCursor;
    if (!cursor || busy.current) return;
    busy.current = true;
    setState((prev) => ({ ...prev, loadingMore: true }));
    try {
      const page = await feedApi.list(cursor);
      setState((prev) => ({
        ...prev,
        posts: [...prev.posts, ...page.posts],
        nextCursor: page.nextCursor,
        loadingMore: false,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, loadingMore: false, error: messageOf(error) }));
    } finally {
      busy.current = false;
    }
  }, [state.nextCursor]);

  return { ...state, refresh, loadMore };
}
