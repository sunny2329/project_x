import { z } from 'zod';

const sportId = z.string().regex(/^\d{1,18}$/, 'Invalid sport');

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
    /** Name on scoreboards (the player's display name). */
    displayName: z.string().trim().min(1, 'Enter a scoreboard name').max(40, 'At most 40 characters').optional(),
    username: z
      .string()
      .trim()
      .transform((value) => value.replace(/^@/, ''))
      .pipe(
        z
          .string()
          .min(3, 'Username must be at least 3 characters')
          .max(30, 'Username must be at most 30 characters')
          .regex(/^[A-Za-z0-9_.]+$/, 'Use only letters, numbers, "_" and "."')
          .regex(/[A-Za-z]/, 'Username must contain a letter'),
      )
      .optional(),
    city: optionalText(80, 'City'),
    /** A photo uploaded to /api/v1/media; null removes the photo. */
    photoMediaId: z.uuid().nullable().optional(),
    /** Empty string clears the bio. */
    bio: z
      .string()
      .trim()
      .max(500, 'Bio must be at most 500 characters')
      .transform((value) => value || null)
      .nullable()
      .optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), { message: 'Nothing to update' });

export const updateSportsSchema = z
  .object({
    sportIds: z
      .array(sportId)
      .max(10, 'Pick at most 10 sports')
      .refine((ids) => new Set(ids).size === ids.length, 'Each sport can be picked once'),
    primarySportId: sportId.nullable(),
  })
  .refine((body) => (body.sportIds.length === 0 ? body.primarySportId === null : body.primarySportId !== null), {
    message: 'Pick a primary sport',
    path: ['primarySportId'],
  })
  .refine((body) => body.primarySportId === null || body.sportIds.includes(body.primarySportId), {
    message: 'The primary sport must be one of your sports',
    path: ['primarySportId'],
  });

export const matchHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Sport slug filter. */
  sport: z.string().trim().max(40).optional(),
});


export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSportsInput = z.infer<typeof updateSportsSchema>;
