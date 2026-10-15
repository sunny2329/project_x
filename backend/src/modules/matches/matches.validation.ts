import { z } from 'zod';

const e164 = z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'Phone must be in international format, e.g. +919876543210');

export const participantSchema = z.union([
  z.object({ playerId: z.uuid() }),
  z.object({ userId: z.uuid() }),
  z.object({
    guest: z.object({
      displayName: z.string().trim().min(1, 'Enter a name').max(80),
      phone: e164.nullish(),
    }),
  }),
]);

const sideSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  teamId: z.uuid().optional(),
  players: z.array(participantSchema).min(1, 'Each side needs a player').max(11),
});

/** Quick start: sport -> ruleset -> format (singles/doubles) -> players. */
export const createMatchSchema = z
  .object({
    sport: z.string().trim().min(1).max(40), // slug
    rulesetId: z.uuid().optional(),
    format: z.string().trim().min(1).max(30), // sport_formats.code
    sides: z.array(sideSchema).min(2).max(2),
    venueId: z.uuid().optional(),
    /** Optional overrides on top of the ruleset (e.g. who serves first), validated by the plugin. */
    rulesOverride: z.record(z.string(), z.unknown()).optional(),
    /** Present = result entered afterwards: one score per side for each game / set ([[21, 15], [21, 18]]). */
    manualScores: z.array(z.array(z.number().int().min(0).max(999)).length(2)).min(1).max(9).optional(),
  })
  .refine(
    (body) => {
      const ids = body.sides.flatMap((s) => s.players.flatMap((p) => ('playerId' in p ? [p.playerId] : 'userId' in p ? [p.userId] : [])));
      return new Set(ids).size === ids.length;
    },
    { message: 'A player can only be on one side, once', path: ['sides'] },
  );

const version = z.number().int().min(0);

export const scoreEventSchema = z.object({
  /** A plugin event, e.g. {"type": "rally_won", "sideIndex": 0}; validated by the match's plugin. */
  event: z.object({ type: z.string().min(1).max(40) }).loose(),
  version,
  /** Device-generated id; resending the same id never counts twice. */
  clientEventId: z.uuid().optional(),
});

export const versionSchema = z.object({ version });

export const retireSchema = z.object({ version, retiredSideIndex: z.number().int().min(0).max(1) });

export const walkoverSchema = z.object({
  /** Null = double walkover (neither side turned up). */
  winnerSideIndex: z.number().int().min(0).max(1).nullable(),
  reason: z.enum(['walkover', 'no_show']).default('walkover'),
});

export const confirmSchema = z.object({
  decision: z.enum(['confirmed', 'disputed']),
  comment: z.string().trim().max(500).optional(),
});

export const addScorerSchema = z.object({ userId: z.uuid() });

export const matchIdSchema = z.uuid();
export const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,32}$/);

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type ScoreEventInput = z.infer<typeof scoreEventSchema>;
export type ParticipantInputBody = z.infer<typeof participantSchema>;
