/*
 * The bell on Home over HTTP: likes, comments, new posts and follows create notifications for the
 * right people (never for my own actions, never across a block), taking a like or follow back
 * removes them, deleted posts and inactive actors are hidden, and reading clears the unread count.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, TEST_OTP, type TestContext } from '../../../test/harness.js';

let ctx: TestContext;
let seq = 0;
const SLOW = 240_000;

interface Account {
  userId: string;
  token: string;
}

interface Item {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
  actor: { id: string; username: string; fullName: string; photoUrl: string | null };
  postId: string | null;
}

async function register(name: string): Promise<Account> {
  seq += 1;
  const suffix = String(Date.now() % 1_000_000).padStart(6, '0') + String(seq).padStart(2, '0');
  const account = { username: `n${suffix}`, fullName: name, email: `n${suffix}@example.com`, phone: `+9196${suffix}`, password: 'Sprint2026' };
  await request(ctx.app).post('/api/v1/auth/register/start').send({ phone: account.phone, username: account.username }).expect(200);
  const verify = await request(ctx.app).post('/api/v1/auth/register/verify').send({ phone: account.phone, code: TEST_OTP }).expect(200);
  const { phone: _phone, ...rest } = account;
  const res = await request(ctx.app).post('/api/v1/auth/register/complete').send({ ...rest, registrationToken: verify.body.data.registrationToken }).expect(201);
  return { userId: res.body.data.user.id, token: res.body.data.tokens.accessToken };
}

const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
const unread = async (a: Account) => (await request(ctx.app).get('/api/v1/notifications/unread').set(as(a)).expect(200)).body.data.count as number;
const list = async (a: Account, query = '') =>
  (await request(ctx.app).get(`/api/v1/notifications${query}`).set(as(a)).expect(200)).body.data as { notifications: Item[]; unreadCount: number; nextCursor: string | null };
const post = async (a: Account, content: string, visibility: 'public' | 'followers' = 'public') =>
  (await request(ctx.app).post('/api/v1/posts').set(as(a)).send({ content, visibility }).expect(201)).body.data.post.id as string;
const follow = (from: Account, to: Account) => request(ctx.app).put(`/api/v1/users/${to.userId}/follow`).set(as(from)).expect(200);
const unfollow = (from: Account, to: Account) => request(ctx.app).delete(`/api/v1/users/${to.userId}/follow`).set(as(from)).expect(200);
const like = (a: Account, postId: string) => request(ctx.app).put(`/api/v1/posts/${postId}/like`).set(as(a)).expect(200);
const comment = (a: Account, postId: string, content: string) => request(ctx.app).post(`/api/v1/posts/${postId}/comments`).set(as(a)).send({ content }).expect(201);
const readAll = (a: Account) => request(ctx.app).post('/api/v1/notifications/read').set(as(a)).expect(200);
/** Rows in the table, whether or not the list shows them. */
async function rows(where: string, params: unknown[]): Promise<number> {
  const { rows: r } = await ctx.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM notification WHERE ${where}`, params);
  return r[0]!.n;
}

let alice: Account;
let bob: Account;
let cara: Account;
let dev: Account;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await register('Alice Kumar');
  bob = await register('Bob Singh');
  cara = await register('Cara Das');
  dev = await register('Dev Rao');
}, SLOW);

afterAll(async () => {
  await ctx?.cleanup();
});

describe('access', () => {
  it('needs a signed-in user on every endpoint', async () => {
    await request(ctx.app).get('/api/v1/notifications').expect(401);
    await request(ctx.app).get('/api/v1/notifications/unread').expect(401);
    await request(ctx.app).post('/api/v1/notifications/read').expect(401);
    await request(ctx.app).post('/api/v1/notifications/00000000-0000-4000-8000-000000000000/read').expect(401);
  });

  it('rejects a bad limit or cursor, and a malformed id', async () => {
    await request(ctx.app).get('/api/v1/notifications?limit=0').set(as(alice)).expect(400);
    await request(ctx.app).get('/api/v1/notifications?limit=51').set(as(alice)).expect(400);
    const bad = await request(ctx.app).get('/api/v1/notifications?cursor=nope').set(as(alice)).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    const res = await request(ctx.app).post('/api/v1/notifications/not-a-uuid/read').set(as(alice)).expect(404);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('starts empty for a new account', async () => {
    expect(await list(dev)).toEqual({ notifications: [], unreadCount: 0, nextCursor: null });
    expect(await unread(dev)).toBe(0);
  });
});

describe('follows', () => {
  it('tells me when someone follows me, once, and forgets it when they unfollow', async () => {
    await follow(bob, alice);
    await follow(bob, alice);
    const { notifications, unreadCount } = await list(alice);
    expect(unreadCount).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: 'follow',
      title: 'Bob Singh started following you',
      message: null,
      isRead: false,
      postId: null,
      actor: { id: bob.userId, fullName: 'Bob Singh', photoUrl: null },
    });
    expect(Number.isNaN(Date.parse(notifications[0]!.createdAt))).toBe(false);
    // Bob never sees Alice's notifications.
    expect((await list(bob)).notifications).toHaveLength(0);

    await unfollow(bob, alice);
    expect(await unread(alice)).toBe(0);
    expect(await rows('user_id = $1 AND notification_type_id = 1404', [alice.userId])).toBe(0);
    // Unfollowing someone you don't follow is harmless.
    await unfollow(bob, alice);

    await follow(bob, alice);
    expect(await rows('user_id = $1 AND actor_id = $2 AND notification_type_id = 1404', [alice.userId, bob.userId])).toBe(1);
  });

  it("can't follow yourself, so there is nothing to notify", async () => {
    await request(ctx.app).put(`/api/v1/users/${alice.userId}/follow`).set(as(alice)).expect(400);
    expect(await rows('actor_id = $1 AND user_id = $1', [alice.userId])).toBe(0);
  });
});

describe('posts, likes and comments', () => {
  it("tells every follower about a new post, public or followers-only, and nobody else", async () => {
    // Bob already follows Alice; Cara follows her too, Dev doesn't.
    await follow(cara, alice);
    const publicPost = await post(alice, 'Won my first tournament!');
    const privatePost = await post(alice, 'Friends only', 'followers');
    for (const follower of [bob, cara]) {
      const items = (await list(follower)).notifications.filter((n) => n.type === 'post');
      expect(items.map((n) => n.postId)).toEqual([privatePost, publicPost]);
      expect(items[1]).toMatchObject({ title: 'Alice Kumar shared a new post', message: 'Won my first tournament!', actor: { id: alice.userId } });
    }
    expect((await list(dev)).notifications).toHaveLength(0);
    // Not to the author either.
    expect(await rows('user_id = $1 AND notification_type_id = 1403', [alice.userId])).toBe(0);
  });

  it('cuts long post and comment text to 140 characters', async () => {
    const long = 'x'.repeat(300);
    const postId = await post(alice, long);
    const toBob = (await list(bob)).notifications.find((n) => n.postId === postId)!;
    expect(toBob.message).toHaveLength(140);
    expect(toBob.message!.endsWith('…')).toBe(true);
    await comment(bob, postId, 'y'.repeat(500));
    const toAlice = (await list(alice)).notifications.find((n) => n.type === 'comment' && n.postId === postId)!;
    expect(toAlice.message).toHaveLength(140);
  });

  it('tells the author about likes (once per person) and every comment, never about their own', async () => {
    await readAll(alice);
    const postId = await post(alice, 'Rally of the day');
    await like(bob, postId);
    await like(bob, postId);
    await like(cara, postId);
    await comment(bob, postId, 'Congrats!');
    await comment(bob, postId, 'Again!');
    await like(alice, postId);
    await comment(alice, postId, 'Thanks');

    const items = (await list(alice)).notifications.filter((n) => n.postId === postId);
    expect(items.map((n) => `${n.type}:${n.actor.id === bob.userId ? 'bob' : 'cara'}`)).toEqual(['comment:bob', 'comment:bob', 'like:cara', 'like:bob']);
    expect(items[0]).toMatchObject({ title: 'Bob Singh commented on your post', message: 'Again!' });
    expect(items[3]).toMatchObject({ title: 'Bob Singh liked your post', message: null });
    expect(await unread(alice)).toBe(4);

    // Unliking takes back only that person's like.
    await request(ctx.app).delete(`/api/v1/posts/${postId}/like`).set(as(bob)).expect(200);
    expect((await list(alice)).notifications.filter((n) => n.postId === postId).map((n) => n.type)).toEqual(['comment', 'comment', 'like']);
    expect(await unread(alice)).toBe(3);

    // Liking again after an unlike notifies again (one row).
    await like(bob, postId);
    expect(await rows('actor_id = $1 AND reference_id = $2 AND notification_type_id = 1401', [bob.userId, postId])).toBe(1);
  });

  it("creates nothing when the post isn't visible to the person acting", async () => {
    const privatePost = await post(alice, 'Followers only', 'followers');
    await request(ctx.app).put(`/api/v1/posts/${privatePost}/like`).set(as(dev)).expect(404);
    await request(ctx.app).post(`/api/v1/posts/${privatePost}/comments`).set(as(dev)).send({ content: 'hi' }).expect(404);
    expect(await rows('actor_id = $1', [dev.userId])).toBe(0);
  });

  it('keeps the comment notification when the comment is deleted, drops everything when the post is', async () => {
    const postId = await post(alice, 'Delete me');
    const created = await comment(bob, postId, 'Nice');
    await like(bob, postId);
    await request(ctx.app).delete(`/api/v1/posts/${postId}/comments/${created.body.data.comment.id}`).set(as(bob)).expect(200);
    expect((await list(alice)).notifications.filter((n) => n.postId === postId).map((n) => n.type)).toEqual(['like', 'comment']);

    await request(ctx.app).delete(`/api/v1/posts/${postId}`).set(as(alice)).expect(200);
    expect(await rows('reference_id = $1', [postId])).toBe(0);
    expect((await list(bob)).notifications.some((n) => n.postId === postId)).toBe(false);
  });

  it('match-result posts do not notify followers', async () => {
    const before = await rows('user_id = $1 AND notification_type_id = 1403', [bob.userId]);
    // The automatic result post is written straight into social_post, not through POST /posts.
    await ctx.pool.query('INSERT INTO social_post (user_id, post_type_id, content, visibility_id) VALUES ($1, 801, $2, 1201)', [alice.userId, 'Alice won 11-4']);
    expect(await rows('user_id = $1 AND notification_type_id = 1403', [bob.userId])).toBe(before);
  });
});

describe('reading', () => {
  it('marks one as read (only my own, idempotently), then all', async () => {
    const { notifications, unreadCount } = await list(alice);
    expect(unreadCount).toBeGreaterThan(1);
    const first = notifications.find((n) => !n.isRead)!;

    const others = await request(ctx.app).post(`/api/v1/notifications/${first.id}/read`).set(as(bob)).expect(404);
    expect(others.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    await request(ctx.app).post('/api/v1/notifications/00000000-0000-4000-8000-000000000000/read').set(as(alice)).expect(404);

    await request(ctx.app).post(`/api/v1/notifications/${first.id}/read`).set(as(alice)).expect(200);
    await request(ctx.app).post(`/api/v1/notifications/${first.id}/read`).set(as(alice)).expect(200);
    expect(await unread(alice)).toBe(unreadCount - 1);
    const { rows: r } = await ctx.pool.query<{ read_at: Date | null }>('SELECT read_at FROM notification WHERE id = $1', [first.id]);
    expect(r[0]!.read_at).toBeInstanceOf(Date);

    await readAll(alice);
    await readAll(alice);
    expect(await unread(alice)).toBe(0);
    expect((await list(alice)).notifications.every((n) => n.isRead)).toBe(true);
    // Reading mine leaves Bob's alone.
    expect(await unread(bob)).toBeGreaterThan(0);
  });

  it('pages newest first without gaps or repeats', async () => {
    const all = (await list(alice, '?limit=50')).notifications;
    expect(all.length).toBeGreaterThan(4);
    const sorted = [...all].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    expect(all.map((n) => n.createdAt)).toEqual(sorted.map((n) => n.createdAt));

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<typeof list>> = await list(alice, `?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      expect(page.notifications.length).toBeLessThanOrEqual(2);
      seen.push(...page.notifications.map((n) => n.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all.map((n) => n.id));
  });
});

describe('blocks and inactive accounts', () => {
  it('hides notifications across a block and creates none while blocked', async () => {
    const postId = await post(alice, 'Block test');
    await like(dev, postId);
    expect((await list(alice)).notifications.some((n) => n.actor.id === dev.userId)).toBe(true);

    await ctx.pool.query('INSERT INTO usr_user_block (blocker_id, blocked_id) VALUES ($1, $2)', [alice.userId, dev.userId]);
    expect((await list(alice)).notifications.some((n) => n.actor.id === dev.userId)).toBe(false);
    expect(await unread(alice)).toBe(0);

    // Dev can no longer see the post, and a follow while blocked adds nothing.
    await request(ctx.app).put(`/api/v1/posts/${postId}/like`).set(as(dev)).expect(404);
    await request(ctx.app).put(`/api/v1/users/${alice.userId}/follow`).set(as(dev));
    expect(await rows('user_id = $1 AND actor_id = $2 AND notification_type_id = 1404', [alice.userId, dev.userId])).toBe(0);

    // Alice posting doesn't reach Dev either, even if Dev followed earlier.
    await ctx.pool.query('INSERT INTO usr_user_follow (follower_id, following_id, status_id) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING', [dev.userId, alice.userId]);
    const next = await post(alice, 'After the block');
    expect(await rows('user_id = $1 AND reference_id = $2', [dev.userId, next])).toBe(0);

    await ctx.pool.query('DELETE FROM usr_user_block WHERE blocker_id = $1 AND blocked_id = $2', [alice.userId, dev.userId]);
    expect((await list(alice)).notifications.some((n) => n.actor.id === dev.userId)).toBe(true);
  });

  it("hides a suspended actor's notifications until they're active again", async () => {
    await readAll(alice);
    const postId = await post(alice, 'Suspension test');
    await like(cara, postId);
    expect(await unread(alice)).toBe(1);

    await ctx.pool.query('UPDATE usr_user SET status = 2 WHERE id = $1', [cara.userId]);
    expect(await unread(alice)).toBe(0);
    expect((await list(alice)).notifications.some((n) => n.actor.id === cara.userId)).toBe(false);

    await ctx.pool.query('UPDATE usr_user SET status = 1 WHERE id = $1', [cara.userId]);
    expect(await unread(alice)).toBe(1);
  });
});
