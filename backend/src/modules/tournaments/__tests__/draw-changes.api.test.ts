/*
 * Changing a draw that is under way, over HTTP against a throwaway schema: late entries (bye,
 * play-in, round-robin group), deleting and withdrawing entries, editing an entry's players.
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

async function register(name: string): Promise<Account> {
  seq += 1;
  const suffix = String(Date.now() % 1_000_000).padStart(6, '0') + String(seq).padStart(2, '0');
  const phone = `+9198${suffix}`;
  await request(ctx.app).post('/api/v1/auth/register/start').send({ phone, username: `d${suffix}` }).expect(200);
  const verify = await request(ctx.app).post('/api/v1/auth/register/verify').send({ phone, code: TEST_OTP }).expect(200);
  const res = await request(ctx.app)
    .post('/api/v1/auth/register/complete')
    .send({ username: `d${suffix}`, fullName: name, email: `d${suffix}@example.com`, password: 'Sprint2026', registrationToken: verify.body.data.registrationToken })
    .expect(201);
  return { userId: res.body.data.user.id, token: res.body.data.tokens.accessToken };
}

const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });

interface Entry {
  id: string;
  name: string;
  status: string;
  seed: number | null;
  hasMatches: boolean;
  players: Array<{ playerId: string; displayName: string }>;
}
interface Fixture {
  id: string;
  round: number;
  position: number;
  roundName: string | null;
  status: string;
  groupId: string | null;
  entries: Array<{ id: string; name: string } | null>;
  placeholders: Array<string | null>;
  winnerEntryId: string | null;
}
interface Event {
  id: string;
  status: string;
  maxEntries: number | null;
  entries: Entry[];
  fixtures: Fixture[];
  stages: Array<{ type: string; groups: Array<{ id: string; name: string; standings: Array<{ name: string; withdrawn: boolean }> | null }> }>;
}

let alice: Account;
let bob: Account;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await register('Alice Draw');
  bob = await register('Bob Draw');
}, SLOW);

afterAll(async () => {
  await ctx?.cleanup();
});

async function setup(drawFormat: string, names: string[], options: { drawConfig?: object; seeded?: boolean; maxEntries?: number } = {}): Promise<{ t: { id: string }; event: Event }> {
  const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(alice)).send({ name: `Draw changes ${seq++}` }).expect(201)).body.data.tournament;
  const created = (
    await request(ctx.app)
      .post(`/api/v1/tournaments/${t.id}/events`)
      .set(as(alice))
      .send({ name: 'Open', sport: 'badminton', format: 'singles', drawFormat, drawConfig: options.drawConfig ?? {}, ...(options.maxEntries ? { maxEntries: options.maxEntries } : {}) })
      .expect(201)
  ).body.data.event;
  // In parallel: each request is several round trips to the remote test database.
  await Promise.all(
    names.map((name, i) =>
      request(ctx.app)
        .post(`/api/v1/tournament-events/${created.id}/entries`)
        .set(as(alice))
        .send({ players: [{ guest: { displayName: name } }], ...(options.seeded ? { seed: i + 1 } : {}) })
        .expect(201),
    ),
  );
  const event = (await request(ctx.app).post(`/api/v1/tournament-events/${created.id}/draw`).set(as(alice)).send({ randomSeed: 5 }).expect(200)).body.data.event as Event;
  return { t, event };
}

const get = async (eventId: string): Promise<Event> => (await request(ctx.app).get(`/api/v1/tournament-events/${eventId}`).set(as(alice)).expect(200)).body.data.event;
const addLate = (eventId: string, name: string) => request(ctx.app).post(`/api/v1/tournament-events/${eventId}/entries`).set(as(alice)).send({ players: [{ guest: { displayName: name } }] });
const entry = (e: Event, name: string) => e.entries.find((x) => x.name === name)!;
const holding = (e: Event, name: string) => e.fixtures.filter((f) => f.entries.some((x) => x?.name === name));
const walkover = (fixtureId: string, winnerEntryId: string) => request(ctx.app).post(`/api/v1/fixtures/${fixtureId}/walkover`).set(as(alice)).send({ winnerEntryId, reason: 'walkover' }).expect(200);

describe('late entries', () => {
  it(
    'adds two play-ins to a full knockout that has started (8 + 2), and the play-in winners move on',
    async () => {
      const names = Array.from({ length: 8 }, (_, i) => `K${i + 1}`);
      const { event } = await setup('knockout', names, { seeded: true, maxEntries: 8 });
      // Seed 1 beats seed 8 before the late entries arrive.
      const opening = holding(event, 'K1')[0]!;
      await walkover(opening.id, entry(event, 'K1').id);

      expect((await addLate(event.id, 'Late A').expect(201)).body.data.event.entries).toHaveLength(9);
      const after = (await addLate(event.id, 'Late B').expect(201)).body.data.event as Event;
      expect(after.maxEntries).toBe(10);
      const playIns = after.fixtures.filter((f) => f.roundName === 'Play-in');
      expect(playIns.map((f) => f.entries.map((x) => x!.name))).toEqual([
        ['K7', 'Late A'],
        ['K6', 'Late B'],
      ]);
      expect(playIns.every((f) => f.status === 'ready' && f.round === 0)).toBe(true);
      // K7's first-round line now waits for the play-in.
      const target = after.fixtures.find((f) => f.round === 1 && f.placeholders.includes('Winner of Play-in 1'))!;
      expect(target.status).toBe('pending');

      await walkover(playIns[0]!.id, entry(after, 'Late A').id);
      const played = await get(event.id);
      const line = played.fixtures.find((f) => f.id === target.id)!;
      expect(line.status).toBe('ready');
      expect(line.entries.map((x) => x?.name)).toContain('Late A');
    },
    SLOW,
  );

  it(
    'gives a late entry a free bye before making a play-in',
    async () => {
      const { event } = await setup('knockout', ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'], { seeded: true });
      const after = (await addLate(event.id, 'Late').expect(201)).body.data.event as Event;
      expect(after.fixtures.filter((f) => f.roundName === 'Play-in')).toHaveLength(0);
      const first = holding(after, 'Late')[0]!;
      expect(first).toMatchObject({ round: 1, status: 'ready' });
      // The weaker of the two bye-holders (seed 2) gives up the bye; seed 1 keeps it.
      expect(first.entries.map((x) => x?.name)).toContain('B2');
      expect(holding(after, 'B1').find((f) => f.round === 1)!.status).toBe('bye');
    },
    SLOW,
  );

  it(
    'puts a late entry into a round robin with a match against everyone, and approves a pending sign-up into the draw',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(alice)).send({ name: 'League late' }).expect(201)).body.data.tournament;
      const created = (await request(ctx.app).post(`/api/v1/tournaments/${t.id}/events`).set(as(alice)).send({ name: 'Open', sport: 'badminton', format: 'singles', drawFormat: 'round_robin' }).expect(201)).body.data.event;
      await request(ctx.app).patch(`/api/v1/tournament-events/${created.id}`).set(as(alice)).send({ status: 'registration_open' }).expect(200);
      // Bob signs up himself; he waits for approval while the draw is made.
      await request(ctx.app).post(`/api/v1/tournament-events/${created.id}/entries`).set(as(bob)).send({ players: [{ userId: bob.userId }] }).expect(201);
      await Promise.all(['R1', 'R2', 'R3', 'R4'].map((name) => addLate(created.id, name).expect(201)));
      const drawn = (await request(ctx.app).post(`/api/v1/tournament-events/${created.id}/draw`).set(as(alice)).send({ randomSeed: 2 }).expect(200)).body.data.event as Event;
      expect(drawn.fixtures).toHaveLength(6);
      const first = drawn.fixtures[0]!;
      await walkover(first.id, first.entries[0]!.id);

      // After the draw only organizers can add.
      await request(ctx.app).post(`/api/v1/tournament-events/${created.id}/entries`).set(as(bob)).send({ players: [{ userId: bob.userId }] }).expect(409);

      const late = (await addLate(created.id, 'R5').expect(201)).body.data.event as Event;
      expect(late.fixtures).toHaveLength(10);
      expect(holding(late, 'R5')).toHaveLength(4);
      expect(holding(late, 'R5').every((f) => f.status === 'ready' && f.round >= 1)).toBe(true);
      expect(late.stages[0]!.groups[0]!.standings).toHaveLength(5);

      const pending = late.entries.find((x) => x.status === 'pending')!;
      const approved = (await request(ctx.app).patch(`/api/v1/entries/${pending.id}`).set(as(alice)).send({ status: 'approved' }).expect(200)).body.data.event as Event;
      expect(approved.fixtures).toHaveLength(15);
      expect(approved.fixtures.filter((f) => f.entries.some((x) => x?.id === pending.id))).toHaveLength(5);
    },
    SLOW,
  );

  it(
    'refuses late entries once the event has finished',
    async () => {
      const { event } = await setup('knockout', ['F1', 'F2'], { seeded: true });
      await walkover(event.fixtures[0]!.id, entry(event, 'F1').id);
      expect((await get(event.id)).status).toBe('completed');
      const res = await addLate(event.id, 'Too late').expect(409);
      expect(res.body.error.code).toBe('EVENT_FINISHED');
    },
    SLOW,
  );
});

describe('deleting and withdrawing entries', () => {
  it(
    'deletes an entry that has not played: its opponent moves on; one that has played can only be withdrawn',
    async () => {
      const { event } = await setup('knockout', ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'], { seeded: true });
      // D8 never turns up for the first round: delete it.
      const gone = (await request(ctx.app).delete(`/api/v1/entries/${entry(event, 'D8').id}`).set(as(alice)).expect(200)).body.data.event as Event;
      expect(gone.entries.map((x) => x.name)).not.toContain('D8');
      const d1 = holding(gone, 'D1');
      expect(d1.find((f) => f.round === 1)).toMatchObject({ status: 'bye', winnerEntryId: entry(gone, 'D1').id });
      expect(d1.some((f) => f.round === 2)).toBe(true);

      // Bob can't delete; D4 v D5 is played, so D4 can't be deleted but can withdraw.
      await request(ctx.app).delete(`/api/v1/entries/${entry(gone, 'D2').id}`).set(as(bob)).expect(403);
      const qf = holding(gone, 'D4').find((f) => f.round === 1)!;
      await walkover(qf.id, entry(gone, 'D4').id);
      const blocked = await request(ctx.app).delete(`/api/v1/entries/${entry(gone, 'D4').id}`).set(as(alice)).expect(409);
      expect(blocked.body.error.code).toBe('ENTRY_HAS_MATCHES');

      const withdrawn = (await request(ctx.app).patch(`/api/v1/entries/${entry(gone, 'D4').id}`).set(as(alice)).send({ status: 'withdrawn' }).expect(200)).body.data.event as Event;
      expect(entry(withdrawn, 'D4')).toMatchObject({ status: 'withdrawn', hasMatches: true });
      // D1 goes through to the final without playing D4.
      const semi = withdrawn.fixtures.find((f) => f.round === 2 && f.entries.some((x) => x?.name === 'D1'))!;
      expect(semi).toMatchObject({ status: 'bye', winnerEntryId: entry(withdrawn, 'D1').id });
      expect(withdrawn.fixtures.find((f) => f.roundName === 'Final')!.entries[0]!.name).toBe('D1');

      // A withdrawn entry can't be approved back into the draw.
      const back = await request(ctx.app).patch(`/api/v1/entries/${entry(gone, 'D4').id}`).set(as(alice)).send({ status: 'approved' }).expect(409);
      expect(back.body.error.code).toBe('ENTRY_WAS_IN_DRAW');
    },
    SLOW,
  );

  it(
    'won’t withdraw an entry while its match is live',
    async () => {
      const { event } = await setup('knockout', ['L1', 'L2', 'L3', 'L4'], { seeded: true });
      await request(ctx.app).post(`/api/v1/fixtures/${holding(event, 'L1')[0]!.id}/start`).set(as(alice)).send({}).expect(200);
      const res = await request(ctx.app).patch(`/api/v1/entries/${entry(event, 'L1').id}`).set(as(alice)).send({ status: 'withdrawn' }).expect(409);
      expect(res.body.error.code).toBe('MATCH_LIVE');
      expect(entry(await get(event.id), 'L1').status).toBe('approved');
    },
    SLOW,
  );

  it(
    'removes a late play-in entry and gives the slot back',
    async () => {
      const { event } = await setup('knockout', ['P1', 'P2', 'P3', 'P4'], { seeded: true });
      const added = (await addLate(event.id, 'Late').expect(201)).body.data.event as Event;
      expect(added.fixtures.filter((f) => f.roundName === 'Play-in')).toHaveLength(1);
      const removed = (await request(ctx.app).delete(`/api/v1/entries/${entry(added, 'Late').id}`).set(as(alice)).expect(200)).body.data.event as Event;
      expect(removed.fixtures.filter((f) => f.roundName === 'Play-in')).toHaveLength(0);
      expect(removed.fixtures.filter((f) => f.status === 'ready')).toHaveLength(2);
      expect(removed.entries).toHaveLength(4);
    },
    SLOW,
  );

  it(
    'cancels a withdrawn entry’s group matches, ranks it last and keeps it out of the knockout',
    async () => {
      const { event } = await setup('groups_knockout', ['G1', 'G2', 'G3', 'G4'], { seeded: true, drawConfig: { groupCount: 1, qualifiersPerGroup: 2 } });
      const g1 = entry(event, 'G1');
      // G1 wins one match, then withdraws.
      const g1Match = holding(event, 'G1').find((f) => f.groupId)!;
      await walkover(g1Match.id, g1.id);
      const after = (await request(ctx.app).patch(`/api/v1/entries/${g1.id}`).set(as(alice)).send({ status: 'withdrawn' }).expect(200)).body.data.event as Event;
      const g1Fixtures = holding(after, 'G1').filter((f) => f.groupId);
      expect(g1Fixtures.filter((f) => f.status === 'cancelled')).toHaveLength(2);
      expect(g1Fixtures.filter((f) => f.status === 'completed')).toHaveLength(1);

      // Play the rest of the group: the lower number wins.
      // One at a time: the last one finishes the group and fills the knockout.
      for (const f of after.fixtures.filter((x) => x.groupId && x.status === 'ready')) {
        const [a, b] = f.entries as [{ id: string; name: string }, { id: string; name: string }];
        await walkover(f.id, a.name < b.name ? a.id : b.id);
      }
      const done = await get(event.id);
      const table = done.stages[0]!.groups[0]!.standings!;
      expect(table.at(-1)).toMatchObject({ name: 'G1', withdrawn: true });
      const final = done.fixtures.find((f) => f.roundName === 'Final')!;
      expect(final.entries.map((x) => x?.name).sort()).toEqual(['G2', 'G3']);
    },
    SLOW,
  );

  it(
    'deletes a late round-robin entry and its matches',
    async () => {
      const { event } = await setup('round_robin', ['A', 'B', 'C']);
      const added = (await addLate(event.id, 'D').expect(201)).body.data.event as Event;
      expect(added.fixtures).toHaveLength(6);
      const removed = (await request(ctx.app).delete(`/api/v1/entries/${entry(added, 'D').id}`).set(as(alice)).expect(200)).body.data.event as Event;
      expect(removed.fixtures).toHaveLength(3);
      expect(removed.stages[0]!.groups[0]!.standings).toHaveLength(3);
    },
    SLOW,
  );
});

describe('editing an entry', () => {
  it(
    'changes an entry’s players and name after the draw, but not into another entry',
    async () => {
      const { event } = await setup('knockout', ['E1', 'E2', 'E3', 'E4'], { seeded: true });
      const e1 = entry(event, 'E1');
      const swapped = (
        await request(ctx.app).patch(`/api/v1/entries/${e1.id}`).set(as(alice)).send({ players: [{ userId: bob.userId }], name: 'Bob stands in' }).expect(200)
      ).body.data.event as Event;
      const changed = swapped.entries.find((x) => x.id === e1.id)!;
      expect(changed).toMatchObject({ name: 'Bob stands in', seed: 1 });
      expect(changed.players.map((p) => p.displayName)).toEqual(['Bob Draw']);
      // The bracket follows the entry, so it shows the new name.
      expect(holding(swapped, 'Bob stands in')).toHaveLength(1);

      // Back to the players' names.
      const plain = (await request(ctx.app).patch(`/api/v1/entries/${e1.id}`).set(as(alice)).send({ name: null }).expect(200)).body.data.event as Event;
      expect(plain.entries.find((x) => x.id === e1.id)!.name).toBe('Bob Draw');

      const e2 = entry(event, 'E2');
      const clash = await request(ctx.app).patch(`/api/v1/entries/${e2.id}`).set(as(alice)).send({ players: [{ userId: bob.userId }] }).expect(400);
      expect(clash.body.error.details.players[0]).toMatch(/already entered/);
      await request(ctx.app).patch(`/api/v1/entries/${e2.id}`).set(as(alice)).send({ players: [{ guest: { displayName: 'X' } }, { guest: { displayName: 'Y' } }] }).expect(400);
      await request(ctx.app).patch(`/api/v1/entries/${e2.id}`).set(as(bob)).send({ name: 'Mine now' }).expect(403);
      await request(ctx.app).patch(`/api/v1/entries/${e2.id}`).set(as(alice)).send({}).expect(400);
    },
    SLOW,
  );
});
