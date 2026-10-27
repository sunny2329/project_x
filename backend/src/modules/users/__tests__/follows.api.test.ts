/*
 * Followers / following lists and "Remove follower" over HTTP: newest first, keyset paging with no
 * gaps or repeats, search, each row's relationship to the viewer (isFollowing / followsMe),
 * suspended and blocked accounts hidden from lists and counts alike, and removal undoing the follow.
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
  username: string;
}

interface Row {
  id: string;
  username: string;
  fullName: string;
  isFollowing: boolean;
  followsMe: boolean;
}

async function register(name: string): Promise<Account> {
  seq += 1;
  const suffix = String(Date.now() % 1_000_000).padStart(6, '0') + String(seq).padStart(2, '0');
  const account = { username: `f${suffix}`, fullName: name, email: `f${suffix}@example.com`, phone: `+9195${suffix}`, password: 'Sprint2026' };
  await request(ctx.app).post('/api/v1/auth/register/start').send({ phone: account.phone, username: account.username }).expect(200);
  const verify = await request(ctx.app).post('/api/v1/auth/register/verify').send({ phone: account.phone, code: TEST_OTP }).expect(200);
  const { phone: _phone, ...rest } = account;
  const res = await request(ctx.app).post('/api/v1/auth/register/complete').send({ ...rest, registrationToken: verify.body.data.registrationToken }).expect(201);
  return { userId: res.body.data.user.id, token: res.body.data.tokens.accessToken, username: account.username };
}

const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
const follow = (from: Account, to: Account) => request(ctx.app).put(`/api/v1/users/${to.userId}/follow`).set(as(from)).expect(200);
const unfollow = (from: Account, to: Account) => request(ctx.app).delete(`/api/v1/users/${to.userId}/follow`).set(as(from)).expect(200);
const page = async (viewer: Account, of: Account, list: 'followers' | 'following', query = '') =>
  (await request(ctx.app).get(`/api/v1/users/${of.userId}/${list}${query}`).set(as(viewer)).expect(200)).body.data as { users: Row[]; nextCursor: string | null };
const names = async (viewer: Account, of: Account, list: 'followers' | 'following', query = '') => (await page(viewer, of, list, query)).users.map((u) => u.username);
const counts = async (viewer: Account, of: Account) => {
  const { user } = (await request(ctx.app).get(`/api/v1/users/${of.userId}`).set(as(viewer)).expect(200)).body.data;
  return { followers: user.followers as number, following: user.following as number };
};

let alice: Account;
let bob: Account;
let cara: Account;
let dev: Account;
let esha: Account;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await register('Alice Kumar');
  bob = await register('Bob Singh');
  cara = await register('Cara Das');
  dev = await register('Dev Rao');
  esha = await register('Esha Nair');
  // Followers of Alice, oldest first: Bob, Cara, Dev. Alice follows Bob back.
  await follow(bob, alice);
  await follow(cara, alice);
  await follow(dev, alice);
  await follow(alice, bob);
}, SLOW);

afterAll(async () => {
  await ctx?.cleanup();
});

describe('access and validation', () => {
  it('needs a session', async () => {
    await request(ctx.app).get(`/api/v1/users/${alice.userId}/followers`).expect(401);
    await request(ctx.app).get(`/api/v1/users/${alice.userId}/following`).expect(401);
    await request(ctx.app).delete(`/api/v1/users/me/followers/${bob.userId}`).expect(401);
  });

  it('404s for an unknown or malformed user', async () => {
    const missing = await request(ctx.app).get('/api/v1/users/00000000-0000-4000-8000-000000000000/followers').set(as(alice)).expect(404);
    expect(missing.body.error.code).toBe('USER_NOT_FOUND');
    await request(ctx.app).get('/api/v1/users/not-a-uuid/following').set(as(alice)).expect(404);
    await request(ctx.app).delete('/api/v1/users/me/followers/not-a-uuid').set(as(alice)).expect(404);
  });

  it('rejects a bad limit or cursor', async () => {
    for (const query of ['?limit=0', '?limit=51', '?limit=x', '?cursor=abc', `?cursor=${alice.userId}`, `?q=${'x'.repeat(51)}`]) {
      const res = await request(ctx.app).get(`/api/v1/users/${alice.userId}/followers${query}`).set(as(alice)).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('gives empty lists for someone with no follows', async () => {
    expect(await page(esha, esha, 'followers')).toEqual({ users: [], nextCursor: null });
    expect(await page(esha, esha, 'following')).toEqual({ users: [], nextCursor: null });
  });
});

describe('lists', () => {
  it('lists followers and following newest first, matching the counts', async () => {
    expect(await names(alice, alice, 'followers')).toEqual([dev.username, cara.username, bob.username]);
    expect(await names(alice, alice, 'following')).toEqual([bob.username]);
    expect(await names(alice, bob, 'followers')).toEqual([alice.username]);
    expect(await names(alice, bob, 'following')).toEqual([alice.username]);
    expect(await counts(esha, alice)).toEqual({ followers: 3, following: 1 });
  });

  it("marks each row with the viewer's relationship, not the list owner's", async () => {
    const mine = (await page(alice, alice, 'followers')).users;
    expect(mine.find((u) => u.id === bob.userId)).toMatchObject({ isFollowing: true, followsMe: true });
    expect(mine.find((u) => u.id === cara.userId)).toMatchObject({ isFollowing: false, followsMe: true });

    // Esha looks at Alice's followers: she follows none of them and none follow her.
    const theirs = (await page(esha, alice, 'followers')).users;
    expect(theirs.every((u) => !u.isFollowing && !u.followsMe)).toBe(true);
    // Bob looks at the same list and finds himself in it.
    expect((await page(bob, alice, 'followers')).users.map((u) => u.id)).toContain(bob.userId);
  });

  it('pages one at a time with no gaps or repeats, even when the cursor row is unfollowed meanwhile', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let first = true;
    do {
      const query: string = `?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const p = await page(alice, alice, 'followers', query);
      seen.push(...p.users.map((u) => u.username));
      if (first) {
        // Dev (the cursor row) leaves, then comes back after the walk.
        await unfollow(dev, alice);
        first = false;
      }
      cursor = p.nextCursor;
    } while (cursor);
    expect(seen).toEqual([dev.username, cara.username, bob.username]);
    await follow(dev, alice);
  });

  it('finds people by username prefix or name, without treating % or _ as wildcards', async () => {
    expect(await names(alice, alice, 'followers', `?q=${cara.username}`)).toEqual([cara.username]);
    expect(await names(alice, alice, 'followers', `?q=@${cara.username.slice(0, 4)}`)).toEqual(
      expect.arrayContaining([cara.username]),
    );
    expect(await names(alice, alice, 'followers', '?q=singh')).toEqual([bob.username]);
    expect(await names(alice, alice, 'followers', '?q=%25')).toEqual([]);
    expect(await names(alice, alice, 'followers', '?q=_')).toEqual([]);
    expect(await names(alice, alice, 'followers', '?q=nobody')).toEqual([]);
  });
});

describe('hidden accounts', () => {
  it('hides a suspended account from lists and counts until it is reactivated', async () => {
    await ctx.pool.query('UPDATE usr_user SET status = 2 WHERE id = $1', [cara.userId]);
    expect(await names(alice, alice, 'followers')).not.toContain(cara.username);
    expect(await counts(alice, alice)).toEqual({ followers: 2, following: 1 });
    await ctx.pool.query('UPDATE usr_user SET status = 1 WHERE id = $1', [cara.userId]);
    expect(await names(alice, alice, 'followers')).toContain(cara.username);
    expect(await counts(alice, alice)).toEqual({ followers: 3, following: 1 });
  });

  it('hides people the viewer blocked or was blocked by', async () => {
    await ctx.pool.query('INSERT INTO usr_user_block (blocker_id, blocked_id) VALUES ($1, $2)', [esha.userId, dev.userId]);
    expect(await names(esha, alice, 'followers')).not.toContain(dev.username);
    expect(await names(alice, alice, 'followers')).toContain(dev.username);
    await ctx.pool.query('DELETE FROM usr_user_block WHERE blocker_id = $1 AND blocked_id = $2', [esha.userId, dev.userId]);
  });
});

describe('remove a follower', () => {
  it('removes the follow both ways round, updates counts and drops the follow notification', async () => {
    const res = await request(ctx.app).delete(`/api/v1/users/me/followers/${cara.userId}`).set(as(alice)).expect(200);
    expect(res.body.data).toEqual({ removed: true, followers: 2, following: 1 });
    expect(await names(alice, alice, 'followers')).not.toContain(cara.username);
    expect(await names(cara, cara, 'following')).toEqual([]);
    const { rows } = await ctx.pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM notification WHERE user_id = $1 AND actor_id = $2 AND notification_type_id = 1404',
      [alice.userId, cara.userId],
    );
    expect(rows[0]!.n).toBe(0);
  });

  it('is idempotent and harmless for someone who never followed', async () => {
    await request(ctx.app).delete(`/api/v1/users/me/followers/${cara.userId}`).set(as(alice)).expect(200);
    const res = await request(ctx.app).delete(`/api/v1/users/me/followers/${esha.userId}`).set(as(alice)).expect(200);
    expect(res.body.data).toMatchObject({ followers: 2 });
  });

  it("only removes the caller's own follower", async () => {
    // Alice follows Bob; Dev "removing" Alice from his followers must not touch that.
    await request(ctx.app).delete(`/api/v1/users/me/followers/${alice.userId}`).set(as(dev)).expect(200);
    expect(await names(bob, bob, 'followers')).toEqual([alice.username]);
  });

  it('lets the removed person follow again', async () => {
    await follow(cara, alice);
    expect(await names(alice, alice, 'followers')).toEqual([cara.username, dev.username, bob.username]);
  });
});
