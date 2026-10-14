/** Mirrors FeedPost in backend/src/modules/feed/feed.repository.ts. */
export interface FeedPost {
  id: string;
  content: string | null;
  createdAt: string;
  author: { id: string; username: string; fullName: string };
  match: FeedMatch | null;
  visibility: PostVisibility;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

/** Mirrors FeedMatch in backend/src/modules/feed/feed.repository.ts. */
export interface FeedMatch {
  id: string;
  sport: { code: string; name: string };
  /** "Singles", "Doubles", "Team". */
  format: string | null;
  durationSeconds: number | null;
  result: {
    summary: string;
    /** 1 or 2; null on a draw. */
    winnerSide: 1 | 2 | null;
    sides: { no: 1 | 2; name: string; headline: number }[];
    /** Games, sets, halves or innings played. */
    periodCount: number;
  } | null;
}

export type PostVisibility = 'public' | 'followers';

export interface FeedPage {
  posts: FeedPost[];
  /** Pass back to get the next page; null when there are no more posts. */
  nextCursor: string | null;
}

/** Mirrors PostComment in backend/src/modules/social/social.repository.ts. */
export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; fullName: string };
}

export interface LikeState {
  likeCount: number;
  likedByMe: boolean;
}
