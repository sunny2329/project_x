import { apiRequest } from '@/shared/api/client';
import type { FeedPage, FeedPost, LikeState, PostComment, PostVisibility } from '../types';

/** One function per backend endpoint; see wiki.md "Posts API". */
export const feedApi = {
  list: (cursor?: string, limit = 20) =>
    apiRequest<FeedPage>(`/api/v1/feed?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`, { authenticated: true }),

  createPost: (content: string, visibility: PostVisibility) =>
    apiRequest<{ post: FeedPost }>('/api/v1/posts', { method: 'POST', body: { content, visibility }, authenticated: true }),

  getPost: (id: string) => apiRequest<{ post: FeedPost }>(`/api/v1/posts/${id}`, { authenticated: true }),

  deletePost: (id: string) => apiRequest<{ deleted: true }>(`/api/v1/posts/${id}`, { method: 'DELETE', authenticated: true }),

  like: (id: string) => apiRequest<LikeState>(`/api/v1/posts/${id}/like`, { method: 'PUT', authenticated: true }),

  unlike: (id: string) => apiRequest<LikeState>(`/api/v1/posts/${id}/like`, { method: 'DELETE', authenticated: true }),

  comments: (id: string, cursor?: string) =>
    apiRequest<{ comments: PostComment[]; nextCursor: string | null }>(
      `/api/v1/posts/${id}/comments${cursor ? `?cursor=${cursor}` : ''}`,
      { authenticated: true },
    ),

  addComment: (id: string, content: string) =>
    apiRequest<{ comment: PostComment }>(`/api/v1/posts/${id}/comments`, { method: 'POST', body: { content }, authenticated: true }),

  deleteComment: (postId: string, commentId: string) =>
    apiRequest<{ deleted: true }>(`/api/v1/posts/${postId}/comments/${commentId}`, { method: 'DELETE', authenticated: true }),
};
