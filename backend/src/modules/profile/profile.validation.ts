import { z } from 'zod';

const sportId = z.string().regex(/^\d{1,18}$/, 'Invalid sport');

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
    /** Empty string clears the bio. */
    bio: z
      .string()
      .trim()
      .max(500, 'Bio must be at most 500 characters')
      .transform((value) => value || null)
      .nullable()
      .optional(),
  })
  .refine((body) => body.fullName !== undefined || body.bio !== undefined, { message: 'Nothing to update' });

export const updateSportsSchema = z
  .object({
    sportIds: z
      .array(sportId)
      .max(6, 'Pick at most 6 sports')
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
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const playerSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(50),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSportsInput = z.infer<typeof updateSportsSchema>;
