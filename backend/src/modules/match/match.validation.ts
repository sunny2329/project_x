import { z } from 'zod';

const id = z.string().regex(/^\d{1,18}$/, 'Invalid id');
const side = z.union([z.literal(1), z.literal(2)]);
const version = z.number().int().min(0);

const sideSchema = z.object({
  name: z.string().trim().min(1).max(40, 'Team name must be at most 40 characters').optional(),
  playerIds: z.array(z.uuid('Invalid player')).min(1, 'Each side needs a player').max(11),
});

export const createMatchSchema = z
  .object({
    sportId: id,
    formatId: id,
    sides: z.tuple([sideSchema, sideSchema]),
    options: z
      .object({
        bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
        pointsToWin: z.number().int().min(5).max(50).optional(),
        periodMinutes: z.number().int().min(5).max(60).optional(),
        overs: z.number().int().min(1).max(20).optional(),
        wickets: z.number().int().min(1).max(10).optional(),
        battingFirst: side.optional(),
      })
      .default({}),
  })
  .refine((body) => new Set(body.sides.flatMap((s) => s.playerIds)).size === body.sides.flatMap((s) => s.playerIds).length, {
    message: 'A player can only be on one side, once',
    path: ['sides'],
  });

export const scoreEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('point'), side, version }),
  z.object({ type: z.literal('goal'), side, version }),
  z.object({ type: z.literal('period_end'), version }),
  z.object({
    type: z.literal('ball'),
    runs: z.number().int().min(0).max(6),
    extra: z.enum(['none', 'wide', 'no_ball']).default('none'),
    wicket: z.boolean().default(false),
    version,
  }),
  z.object({ type: z.literal('innings_end'), version }),
]);

export const versionSchema = z.object({ version });

export const matchIdSchema = z.uuid();

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type ScoreEventInput = z.infer<typeof scoreEventSchema>;
