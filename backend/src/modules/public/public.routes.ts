import { Router } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { MatchesService } from '../matches/matches.service.js';
import type { MatchView } from '../matches/matches.types.js';
import { shareTokenSchema } from '../matches/matches.validation.js';
import type { TournamentsService } from '../tournaments/tournaments.service.js';
import { PUBLIC_PAGE_SCRIPT, publicPage } from './public.pages.js';

/** What a public viewer may see of a match: no user ids, no scoring rights. */
function publicMatch(match: MatchView) {
  const { createdByUserId: _creator, canScore: _canScore, confirmation, ...rest } = match;
  return {
    ...rest,
    canScore: false,
    confirmation: { status: confirmation.status, canConfirm: false, decisions: [] },
    sides: rest.sides.map((s) => ({ ...s, players: s.players.map((p) => ({ ...p, userId: null })) })),
    score: { ...rest.score, actions: [] },
  };
}

const slugSchema = z.string().regex(/^[a-z0-9-]{3,80}$/);

/**
 * No-login, read-only routes: `/api/v1/public/...` (JSON) and the share pages `/s/:token`
 * (live scoreboard) and `/t/:slug` (tournament: brackets, fixtures, live scores, standings).
 */
export function createPublicRouters(matches: MatchesService, tournaments: TournamentsService) {
  const api = Router();
  api.get('/matches/:token', async (req, res) => {
    const token = shareTokenSchema.safeParse(req.params.token);
    if (!token.success) throw AppError.notFound('MATCH_NOT_FOUND', 'This match does not exist.');
    sendSuccess(res, { match: publicMatch(await matches.getByShareToken(token.data)) });
  });
  api.get('/tournaments/:slug', async (req, res) => {
    const slug = slugSchema.safeParse(req.params.slug);
    if (!slug.success) throw AppError.notFound('TOURNAMENT_NOT_FOUND', 'This tournament does not exist.');
    sendSuccess(res, { tournament: await tournaments.getBySlug(slug.data) });
  });
  api.get('/tournament-events/:id', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) throw AppError.notFound('EVENT_NOT_FOUND', 'This event does not exist.');
    const event = await tournaments.eventDetail(null, id.data);
    sendSuccess(res, { event: { ...event, entries: event.entries.map((e) => ({ ...e, players: e.players.map((p) => ({ displayName: p.displayName })) })) } });
  });

  const pages = Router();
  pages.get('/public-assets/page.js', (_req, res) => {
    res.type('application/javascript').set('Cache-Control', 'public, max-age=300').send(PUBLIC_PAGE_SCRIPT);
  });
  pages.get('/s/:token', (req, res) => {
    const token = shareTokenSchema.safeParse(req.params.token);
    if (!token.success) return void res.status(404).type('html').send(publicPage('Not found', 'missing', ''));
    res.type('html').send(publicPage('Live score', 'match', token.data));
  });
  pages.get('/t/:slug', (req, res) => {
    const slug = slugSchema.safeParse(req.params.slug);
    if (!slug.success) return void res.status(404).type('html').send(publicPage('Not found', 'missing', ''));
    res.type('html').send(publicPage('Tournament', 'tournament', slug.data));
  });
  return { api, pages };
}
