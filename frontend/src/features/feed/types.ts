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
  context: 'friendly' | 'tournament';
  sport: { id: string; slug: string; name: string; iconKey: string; accentColor: string };
  /** "Singles", "Doubles". */
  format: string | null;
  durationSeconds: number | null;
  result: {
    headline: string;
    winnerSideIndex: number | null;
    resultType: string | null;
    sides: { index: number; name: string; primary: string }[];
    /** Games or sets played. */
    segmentCount: number;
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
