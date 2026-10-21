import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';

/** The app resizes photos before upload; this is the hard ceiling (also a CHECK on media_files). */
export const MAX_MEDIA_BYTES = 3 * 1024 * 1024;

const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type MimeType = (typeof MIME_TYPES)[number];

export const uploadMediaSchema = z.object({
  /** The file, base64-encoded (no data: prefix). */
  data: z.string().min(16).max(Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 8),
  mimeType: z.enum(MIME_TYPES),
  width: z.number().int().min(1).max(10_000).optional(),
  height: z.number().int().min(1).max(10_000).optional(),
});

/** The public URL of a stored photo, relative to the API origin. */
export const mediaUrl = (id: string) => `/media/${id}`;

/** True when the bytes start with the signature of the declared format. */
function looksLike(bytes: Buffer, mimeType: MimeType): boolean {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP';
}

/** Photo ids the user uploaded (others' ids are ignored). */
export async function ownedMediaIds(pool: pg.Pool, userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM media_files WHERE owner_user_id = $1 AND id = ANY($2::uuid[])', [userId, ids]);
  const owned = new Set(rows.map((r) => r.id));
  return ids.filter((id) => owned.has(id));
}

/**
 * `/api/v1/media` (upload, signed in) and `/media/:id` (public, cacheable). Photos live in
 * Postgres (media_files) until a cloud store is set up; ids are unguessable uuids.
 */
export function createMediaRouters(pool: pg.Pool, requireAuth: RequestHandler): { api: Router; files: Router } {
  const api = Router();
  api.post('/', requireAuth, validateBody(uploadMediaSchema), async (req, res) => {
    const body = req.body as z.infer<typeof uploadMediaSchema>;
    const bytes = Buffer.from(body.data, 'base64');
    if (!bytes.length || bytes.length > MAX_MEDIA_BYTES) throw AppError.badRequest('MEDIA_TOO_LARGE', 'Photos can be at most 3 MB.');
    if (!looksLike(bytes, body.mimeType)) throw AppError.badRequest('MEDIA_INVALID', 'That file is not a JPEG, PNG or WebP image.');
    const { rows } = await pool.query<{ id: string }>(
      'INSERT INTO media_files (owner_user_id, mime_type, bytes, byte_size, width, height) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [req.auth!.userId, body.mimeType, bytes, bytes.length, body.width ?? null, body.height ?? null],
    );
    const id = rows[0]!.id;
    sendSuccess(res, { media: { id, url: mediaUrl(id), width: body.width ?? null, height: body.height ?? null } }, 201);
  });

  const files = Router();
  files.get('/media/:id', async (req, res) => {
    if (!z.uuid().safeParse(req.params.id).success) throw AppError.notFound('MEDIA_NOT_FOUND', 'Photo not found.');
    const { rows } = await pool.query<{ mimeType: string; bytes: Buffer }>('SELECT mime_type AS "mimeType", bytes FROM media_files WHERE id = $1', [
      req.params.id,
    ]);
    const file = rows[0];
    if (!file) throw AppError.notFound('MEDIA_NOT_FOUND', 'Photo not found.');
    // Content never changes for an id.
    res.set({ 'Content-Type': file.mimeType, 'Cache-Control': 'public, max-age=31536000, immutable', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    res.send(file.bytes);
  });

  return { api, files };
}
