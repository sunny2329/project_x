import { Router, type RequestHandler } from 'express';
import type { Db } from '../../database/prisma.js';
import { scoringRegistry } from '../../engine/scoring/index.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';

export interface SportSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  iconKey: string;
  accentColor: string;
  formats: Array<{ code: string; name: string; playersPerSide: number; minPerSide: number; maxPerSide: number }>;
  rulesets: Array<{ id: string; slug: string; name: string; scoringModel: string; isDefault: boolean; config: unknown }>;
}

/**
 * Only active sports whose rulesets have a registered scoring plugin. Inactive sports
 * (volleyball, football, box cricket for now) never reach the app.
 */
export async function listActiveSports(db: Db): Promise<SportSummary[]> {
  const sports = await db.sport.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      formats: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      rulesets: { where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] },
    },
  });
  return sports.map((s) => ({
    id: String(s.id),
    slug: s.slug,
    name: s.name,
    category: s.category,
    iconKey: s.iconKey,
    accentColor: s.accentColor,
    formats: s.formats.map((f) => ({ code: f.code, name: f.name, playersPerSide: f.playersPerSide, minPerSide: f.minPerSide, maxPerSide: f.maxPerSide })),
    rulesets: s.rulesets
      .filter((r) => scoringRegistry.has(r.scoringModel))
      .map((r) => ({ id: r.id, slug: r.slug, name: r.name, scoringModel: r.scoringModel, isDefault: r.isDefault, config: r.config })),
  }));
}

/** `/api/v1/sports`: the active sports catalogue with formats and rulesets. */
export function createSportsRouter(db: Db, requireAuth: RequestHandler): Router {
  const router = Router();
  router.get('/', requireAuth, async (_req, res) => {
    sendSuccess(res, { sports: await listActiveSports(db) });
  });
  router.get('/:slug', requireAuth, async (req, res) => {
    const sport = (await listActiveSports(db)).find((s) => s.slug === req.params.slug);
    if (!sport) throw AppError.notFound('SPORT_NOT_FOUND', 'This sport does not exist.');
    sendSuccess(res, { sport });
  });
  return router;
}
