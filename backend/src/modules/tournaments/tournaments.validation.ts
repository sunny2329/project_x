import { z } from 'zod';
import { tiebreakersSchema } from '../../engine/tournament/index.js';
import { participantSchema } from '../matches/matches.validation.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const createTournamentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
  startsOn: isoDate.optional(),
  endsOn: isoDate.optional(),
  venueId: z.uuid().optional(),
  venueName: z.string().trim().min(2).max(120).optional(),
});

export const updateTournamentSchema = createTournamentSchema.partial().extend({
  status: z.enum(['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled']).optional(),
});

export const addStaffSchema = z.object({ userId: z.uuid(), role: z.enum(['co_organizer', 'scorer', 'referee']) });

export const addCourtSchema = z.object({ name: z.string().trim().min(1).max(60), sport: z.string().max(40).optional() });
export const courtScorerSchema = z.object({ userId: z.uuid() });

export const createEventSchema = z.object({
  name: z.string().trim().min(2).max(80),
  sport: z.string().trim().min(1).max(40),
  format: z.string().trim().min(1).max(30),
  rulesetId: z.uuid().optional(),
  /** "knockout" | "round_robin" | "groups_knockout"; its config is validated by the format. */
  drawFormat: z.string().trim().min(1).max(40),
  drawConfig: z.record(z.string(), z.unknown()).default({}),
  tiebreakers: tiebreakersSchema.optional(),
  rulesOverride: z.record(z.string(), z.unknown()).optional(),
  maxEntries: z.number().int().min(2).max(512).optional(),
});

export const updateEventSchema = z.object({
  status: z.enum(['draft', 'registration_open', 'registration_closed', 'cancelled']).optional(),
  maxEntries: z.number().int().min(2).max(512).nullable().optional(),
  drawConfig: z.record(z.string(), z.unknown()).optional(),
  tiebreakers: tiebreakersSchema.optional(),
});

export const addEntrySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  players: z.array(participantSchema).min(1).max(11),
  seed: z.number().int().min(1).max(512).optional(),
  teamId: z.uuid().optional(),
});

export const updateEntrySchema = z.object({
  status: z.enum(['pending', 'approved', 'withdrawn', 'disqualified']).optional(),
  seed: z.number().int().min(1).max(512).nullable().optional(),
});

export const drawSchema = z.object({
  /** Reproducible draw: the same seed gives the same draw for the same entries. */
  randomSeed: z.number().int().min(0).max(2 ** 31).optional(),
  preview: z.boolean().default(false),
});

export const scheduleFixtureSchema = z.object({
  courtId: z.uuid().nullable().optional(),
  scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const fixtureWalkoverSchema = z.object({
  /** Null = neither entry turned up. */
  winnerEntryId: z.uuid().nullable(),
  reason: z.enum(['walkover', 'no_show']).default('walkover'),
});

export const fixtureManualResultSchema = z.object({
  scores: z.array(z.array(z.number().int().min(0).max(999)).length(2)).min(1).max(9),
});
