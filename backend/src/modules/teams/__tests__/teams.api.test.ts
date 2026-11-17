/*
 * Saved teams over HTTP: one person in many teams across sports (and several in one sport),
 * captains managing members and roles, leaving and hand-over, deleting, blocked accounts, and
 * using a team as a match side (same sport only, record and recent matches on the team page).
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
  playerId: string;
}

interface Member {
  playerId: string;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  role: 'captain' | 'player';
}

interface Team {
  id: string;
  name: string;
  sport: { slug: string; name: string };
  memberCount: number;
  myRole: 'captain' | 'player' | null;
  record: { played: number; won: number; lost: number; drawn: number };
  preview: Array<{ displayName: string }>;
  members: Member[];
  canManage: boolean;
  recentMatches: Array<{ matchId: string; outcome: string | null; opponent: string; headline: string | null }>;
}

async function register(name: string): Promise<Account> {
  seq += 1;
  const suffix = String(Date.now() % 1_000_000).padStart(6, '0') + String(seq).padStart(2, '0');
  const account = { username: `t${suffix}`, fullName: name, email: `t${suffix}@example.com`, phone: `+9196${suffix}`, password: 'Sprint2026' };
  await request(ctx.app).post('/api/v1/auth/register/start').send({ phone: account.phone, username: account.username }).expect(200);
  const verify = await request(ctx.app).post('/api/v1/auth/register/verify').send({ phone: account.phone, code: TEST_OTP }).expect(200);
  const { phone: _phone, ...rest } = account;
  const res = await request(ctx.app)
    .post('/api/v1/auth/register/complete')
    .send({ ...rest, registrationToken: verify.body.data.registrationToken })
    .expect(201);
  const token = res.body.data.tokens.accessToken as string;
  const me = await request(ctx.app)
    .get('/api/v1/players/me')
    .set({ Authorization: `Bearer ${token}` })
    .expect(200);
  return { userId: res.body.data.user.id, token, username: account.username, playerId: me.body.data.player.playerId };
}

const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
const api = () => request(ctx.app);
const create = (a: Account, body: object) => api().post('/api/v1/teams').set(as(a)).send(body);
const createOk = async (a: Account, body: object): Promise<Team> => (await create(a, body).expect(201)).body.data.team;
const get = async (a: Account, id: string): Promise<Team> => (await api().get(`/api/v1/teams/${id}`).set(as(a)).expect(200)).body.data.team;
const list = async (a: Account, query = ''): Promise<Team[]> => (await api().get(`/api/v1/teams${query}`).set(as(a)).expect(200)).body.data.teams;
const add = (a: Account, id: string, members: object[]) => api().post(`/api/v1/teams/${id}/members`).set(as(a)).send({ members });
const removeMember = (a: Account, id: string, playerId: string) => api().delete(`/api/v1/teams/${id}/members/${playerId}`).set(as(a));
const setRole = (a: Account, id: string, playerId: string, role: string) => api().patch(`/api/v1/teams/${id}/members/${playerId}`).set(as(a)).send({ role });
const roles = (t: Team) => Object.fromEntries(t.members.map((m) => [m.displayName, m.role]));

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
}, SLOW);

describe('creating teams', () => {
  it(
    'makes the creator captain and adds registered players and guests in one go',
    async () => {
      const team = await createOk(alice, { sport: 'badminton', name: '  Smash Bros  ', members: [{ userId: bob.userId }, { guest: { displayName: 'Ravi' } }] });
      expect(team).toMatchObject({ name: 'Smash Bros', sport: { slug: 'badminton' }, memberCount: 3, myRole: 'captain', canManage: true, record: { played: 0, won: 0 } });
      expect(team.members.map((m) => [m.displayName, m.role, m.isGuest])).toEqual([
        ['Alice Kumar', 'captain', false],
        ['Bob Singh', 'player', false],
        ['Ravi', 'player', true],
      ]);
      expect(team.preview.map((p) => p.displayName)).toEqual(['Alice Kumar', 'Bob Singh', 'Ravi']);

      // Bob sees the same team, as a player who can't manage it; Cara (not in it) can still view it.
      expect(await get(bob, team.id)).toMatchObject({ myRole: 'player', canManage: false });
      expect(await get(cara, team.id)).toMatchObject({ myRole: null, canManage: false, memberCount: 3 });
    },
    SLOW,
  );

  it(
    'rejects a missing name, an unknown sport, too many players and the same player twice in the list',
    async () => {
      expect((await create(alice, { sport: 'badminton', name: '   ' }).expect(400)).body.error.details.name).toBeDefined();
      expect((await create(alice, { sport: 'curling', name: 'Stones' }).expect(400)).body.error.details.sport).toEqual(['Pick a sport']);
      expect((await create(alice, { name: 'No sport' }).expect(400)).body.error.details.sport).toBeDefined();
      const many = Array.from({ length: 30 }, (_, i) => ({ guest: { displayName: `G${i}` } }));
      expect((await create(alice, { sport: 'basketball', name: 'Too big', members: many }).expect(400)).body.error.details.members).toEqual(['A team can have up to 30 players']);
      // Listing yourself or a teammate twice is not an error: they're in the team once.
      const team = await createOk(alice, { sport: 'tennis', name: 'Dupes', members: [{ userId: alice.userId }, { userId: bob.userId }, { userId: bob.userId }] });
      expect(team.memberCount).toBe(2);
    },
    SLOW,
  );

  it(
    'answers 404 for a team id that is not a uuid or does not exist',
    async () => {
      expect((await api().get('/api/v1/teams/not-a-uuid').set(as(alice)).expect(404)).body.error.code).toBe('TEAM_NOT_FOUND');
      await api().get('/api/v1/teams/0190a5a0-0000-7000-8000-000000000000').set(as(alice)).expect(404);
      await api().get('/api/v1/teams').expect(401);
    },
    SLOW,
  );
});

describe('many teams across sports', () => {
  it(
    'lists every team a person is in, any sport, several per sport, filtered by sport on request',
    async () => {
      const hoops = await createOk(cara, { sport: 'basketball', name: 'Hoop Dreams', members: [{ userId: dev.userId }] });
      const ttA = await createOk(cara, { sport: 'table-tennis', name: 'Alpha Spin' });
      const ttB = await createOk(dev, { sport: 'table-tennis', name: 'Backhand Club', members: [{ userId: cara.userId }] });

      const mine = await list(cara);
      expect(mine.map((t) => [t.name, t.sport.slug, t.myRole])).toEqual([
        ['Alpha Spin', 'table-tennis', 'captain'],
        ['Backhand Club', 'table-tennis', 'player'],
        ['Hoop Dreams', 'basketball', 'captain'],
      ]);
      expect((await list(cara, '?sport=table-tennis')).map((t) => t.id)).toEqual([ttA.id, ttB.id]);
      expect(await list(cara, '?sport=padel')).toEqual([]);

      // Someone else's teams, with the viewer's own role in each.
      const devsAsSeenByCara = await list(cara, `?userId=${dev.userId}`);
      expect(devsAsSeenByCara.map((t) => [t.name, t.myRole])).toEqual([
        ['Backhand Club', 'player'],
        ['Hoop Dreams', 'captain'],
      ]);
      expect(devsAsSeenByCara.find((t) => t.id === hoops.id)?.memberCount).toBe(2);
      await api().get('/api/v1/teams?userId=nope').set(as(cara)).expect(400);
    },
    SLOW,
  );
});

describe('captains and members', () => {
  it(
    'lets only captains rename, add players, change roles and delete',
    async () => {
      const team = await createOk(alice, { sport: 'pickleball', name: 'Dinkers', members: [{ userId: bob.userId }] });
      for (const res of [
        await api().patch(`/api/v1/teams/${team.id}`).set(as(bob)).send({ name: 'Bob’s team' }),
        await add(bob, team.id, [{ userId: cara.userId }]),
        await setRole(bob, team.id, bob.playerId, 'captain'),
        await api().delete(`/api/v1/teams/${team.id}`).set(as(bob)),
        await removeMember(bob, team.id, alice.playerId),
        await add(cara, team.id, [{ userId: cara.userId }]),
      ]) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('NOT_TEAM_CAPTAIN');
      }
      const renamed = (await api().patch(`/api/v1/teams/${team.id}`).set(as(alice)).send({ name: 'Kitchen Kings' }).expect(200)).body.data.team as Team;
      expect(renamed.name).toBe('Kitchen Kings');
      await api()
        .patch(`/api/v1/teams/${team.id}`)
        .set(as(alice))
        .send({ name: 'x'.repeat(81) })
        .expect(400);
    },
    SLOW,
  );

  it(
    'skips players already in the team, and reopens the membership of someone who left',
    async () => {
      const team = await createOk(alice, { sport: 'padel', name: 'Wall Ball', members: [{ userId: bob.userId }] });
      const again = (await add(alice, team.id, [{ userId: bob.userId }, { playerId: bob.playerId }]).expect(200)).body.data.team as Team;
      expect(again.memberCount).toBe(2);

      expect((await removeMember(bob, team.id, bob.playerId).expect(200)).body.data.team).toBeNull();
      expect((await list(bob)).map((t) => t.id)).not.toContain(team.id);
      expect((await get(alice, team.id)).memberCount).toBe(1);

      const back = (await add(alice, team.id, [{ playerId: bob.playerId }]).expect(200)).body.data.team as Team;
      expect(roles(back)).toEqual({ 'Alice Kumar': 'captain', 'Bob Singh': 'player' });
      expect((await list(bob)).map((t) => t.id)).toContain(team.id);
      await add(alice, team.id, []).expect(400);
    },
    SLOW,
  );

  it(
    'caps a team at 30 players',
    async () => {
      const team = await createOk(alice, { sport: 'basketball', name: 'Big Squad', members: Array.from({ length: 29 }, (_, i) => ({ guest: { displayName: `Sub ${i}` } })) });
      expect(team.memberCount).toBe(30);
      expect((await add(alice, team.id, [{ userId: bob.userId }]).expect(400)).body.error.details.members).toEqual(['A team can have up to 30 players']);
      expect((await get(alice, team.id)).memberCount).toBe(30);
    },
    SLOW,
  );

  it(
    'makes members captains, never a guest, and never demotes the last captain',
    async () => {
      const team = await createOk(alice, { sport: 'tennis', name: 'Aces', members: [{ userId: bob.userId }, { guest: { displayName: 'Guest Gita' } }] });
      const gita = team.members.find((m) => m.isGuest)!;
      expect((await setRole(alice, team.id, gita.playerId, 'captain').expect(400)).body.error.details.role).toBeDefined();
      expect((await setRole(alice, team.id, alice.playerId, 'player').expect(409)).body.error.code).toBe('LAST_CAPTAIN');
      await setRole(alice, team.id, bob.playerId, 'boss').expect(400);
      expect((await setRole(alice, team.id, cara.playerId, 'captain').expect(404)).body.error.code).toBe('MEMBER_NOT_FOUND');

      const two = (await setRole(alice, team.id, bob.playerId, 'captain').expect(200)).body.data.team as Team;
      expect(roles(two)).toEqual({ 'Alice Kumar': 'captain', 'Bob Singh': 'captain', 'Guest Gita': 'player' });
      // With two captains, one can step down; Bob can now manage the team.
      expect(roles((await setRole(bob, team.id, alice.playerId, 'player').expect(200)).body.data.team)).toMatchObject({ 'Alice Kumar': 'player', 'Bob Singh': 'captain' });
      expect((await get(bob, team.id)).canManage).toBe(true);
    },
    SLOW,
  );

  it(
    'lets a captain remove a player, and answers 404 for someone not in the team',
    async () => {
      const team = await createOk(alice, { sport: 'table-tennis', name: 'Loopers', members: [{ userId: bob.userId }, { userId: cara.userId }] });
      const after = (await removeMember(alice, team.id, cara.playerId).expect(200)).body.data.team as Team;
      expect(after.members.map((m) => m.displayName)).toEqual(['Alice Kumar', 'Bob Singh']);
      expect((await removeMember(alice, team.id, cara.playerId).expect(404)).body.error.code).toBe('MEMBER_NOT_FOUND');
      await removeMember(alice, team.id, 'nope').expect(404);
    },
    SLOW,
  );
});

describe('leaving and deleting', () => {
  it(
    'hands the captaincy to the longest-standing registered member when the last captain leaves',
    async () => {
      const team = await createOk(alice, { sport: 'badminton', name: 'Handover', members: [{ guest: { displayName: 'Early Guest' } }, { userId: bob.userId }] });
      await add(alice, team.id, [{ userId: cara.userId }]).expect(200);
      expect((await removeMember(alice, team.id, alice.playerId).expect(200)).body.data.team).toBeNull();
      const now = await get(bob, team.id);
      expect(roles(now)).toEqual({ 'Bob Singh': 'captain', 'Early Guest': 'player', 'Cara Das': 'player' });
      expect(now.canManage).toBe(true);
    },
    SLOW,
  );

  it(
    'deletes the team when the last registered member leaves',
    async () => {
      const team = await createOk(alice, { sport: 'badminton', name: 'Only Guests Left', members: [{ guest: { displayName: 'Ghost' } }] });
      await removeMember(alice, team.id, alice.playerId).expect(200);
      await api().get(`/api/v1/teams/${team.id}`).set(as(alice)).expect(404);
    },
    SLOW,
  );

  it(
    'deletes a team for its captain, keeping its matches with their side names',
    async () => {
      const team = await createOk(alice, { sport: 'table-tennis', name: 'Short Lived' });
      const match = (
        await api()
          .post('/api/v1/matches')
          .set(as(alice))
          .send({
            sport: 'table-tennis',
            format: 'singles',
            manualScores: [[11, 4]],
            rulesOverride: { bestOf: 1 },
            sides: [{ name: 'Short Lived', teamId: team.id, players: [{ userId: alice.userId }] }, { players: [{ userId: bob.userId }] }],
          })
          .expect(201)
      ).body.data.match;
      expect((await api().delete(`/api/v1/teams/${team.id}`).set(as(alice)).expect(200)).body.data).toEqual({ deleted: true });
      await api().get(`/api/v1/teams/${team.id}`).set(as(alice)).expect(404);
      await api().delete(`/api/v1/teams/${team.id}`).set(as(alice)).expect(404);
      const side = await ctx.db.matchSide.findFirstOrThrow({ where: { matchId: match.id, sideIndex: 0 } });
      expect(side).toMatchObject({ name: 'Short Lived', teamId: null });
    },
    SLOW,
  );
});

describe('teams in matches', () => {
  it(
    'accepts a team of the match’s sport only, and shows the result on the team page',
    async () => {
      const team = await createOk(alice, { sport: 'pickleball', name: 'Paddle Pals', members: [{ userId: bob.userId }] });
      const body = (teamId: string) => ({
        sport: 'pickleball',
        format: 'doubles',
        manualScores: [[11, 6]],
        sides: [{ name: 'Paddle Pals', teamId, players: [{ userId: alice.userId }, { userId: bob.userId }] }, { players: [{ userId: cara.userId }, { userId: dev.userId }] }],
      });
      const other = await createOk(alice, { sport: 'tennis', name: 'Wrong Sport' });
      expect((await api().post('/api/v1/matches').set(as(alice)).send(body(other.id)).expect(400)).body.error.details.teamId).toEqual(['That team plays a different sport']);
      expect((await api().post('/api/v1/matches').set(as(alice)).send(body('0190a5a0-0000-7000-8000-000000000000')).expect(400)).body.error.details.teamId).toEqual(['That team no longer exists']);

      const match = (await api().post('/api/v1/matches').set(as(alice)).send(body(team.id)).expect(201)).body.data.match;
      const page = await get(bob, team.id);
      expect(page.recentMatches).toEqual([expect.objectContaining({ matchId: match.id, outcome: 'won', opponent: 'Cara Das & Dev Rao', headline: '11-6' })]);
      expect(page.record).toMatchObject({ played: 1, won: 1, lost: 0 });
    },
    SLOW,
  );
});

describe('blocked accounts', () => {
  it(
    'can’t be added to your team, and don’t see each other’s teams',
    async () => {
      const team = await createOk(dev, { sport: 'tennis', name: 'Private Court' });
      await ctx.pool.query('INSERT INTO usr_user_block (blocker_id, blocked_id) VALUES ($1, $2)', [alice.userId, dev.userId]);
      expect((await add(dev, team.id, [{ userId: alice.userId }]).expect(400)).body.error.details.members).toEqual(['Some players could not be found']);
      expect((await add(dev, team.id, [{ playerId: alice.playerId }]).expect(400)).body.error.details.members).toEqual(['Some players could not be found']);
      await create(dev, { sport: 'tennis', name: 'Sneaky', members: [{ userId: alice.userId }] }).expect(400);
      expect(await list(alice, `?userId=${dev.userId}`)).toEqual([]);
      expect(await list(dev, `?userId=${alice.userId}`)).toEqual([]);
      expect((await get(dev, team.id)).memberCount).toBe(1);
    },
    SLOW,
  );
});
