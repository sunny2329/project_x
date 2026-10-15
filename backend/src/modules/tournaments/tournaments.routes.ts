import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { TournamentsService } from './tournaments.service.js';
import {
  addCourtSchema,
  addEntrySchema,
  addStaffSchema,
  courtScorerSchema,
  createEventSchema,
  createTournamentSchema,
  drawSchema,
  fixtureManualResultSchema,
  fixtureWalkoverSchema,
  scheduleFixtureSchema,
  updateEntrySchema,
  updateEventSchema,
  updateTournamentSchema,
} from './tournaments.validation.js';

const uuid = z.uuid();
function id(raw: string | string[] | undefined, what: string): string {
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) throw AppError.notFound(`${what.toUpperCase()}_NOT_FOUND`, `This ${what} does not exist.`);
  return parsed.data;
}

/**
 * Organizer, scorer and player routes:
 * `/api/v1/tournaments`, `/api/v1/tournament-events`, `/api/v1/entries`, `/api/v1/fixtures`, `/api/v1/courts`.
 */
export function createTournamentRouters(service: TournamentsService, requireAuth: RequestHandler) {
  const me = (req: { auth?: { userId: string } }) => req.auth!.userId;

  const tournaments = Router();
  tournaments.use(requireAuth);
  tournaments.get('/', async (req, res) => sendSuccess(res, { tournaments: await service.list(me(req)) }));
  tournaments.post('/', validateBody(createTournamentSchema), async (req, res) => {
    sendSuccess(res, { tournament: await service.create(me(req), req.body) }, 201);
  });
  tournaments.get('/:id', async (req, res) => sendSuccess(res, { tournament: await service.get(me(req), id(req.params.id, 'tournament')) }));
  tournaments.patch('/:id', validateBody(updateTournamentSchema), async (req, res) => {
    sendSuccess(res, { tournament: await service.update(me(req), id(req.params.id, 'tournament'), req.body) });
  });
  tournaments.post('/:id/staff', validateBody(addStaffSchema), async (req, res) => {
    sendSuccess(res, { tournament: await service.addStaff(me(req), id(req.params.id, 'tournament'), req.body) });
  });
  tournaments.delete('/:id/staff/:userId/:role', async (req, res) => {
    sendSuccess(res, { tournament: await service.removeStaff(me(req), id(req.params.id, 'tournament'), id(req.params.userId, 'user'), String(req.params.role)) });
  });
  tournaments.post('/:id/courts', validateBody(addCourtSchema), async (req, res) => {
    sendSuccess(res, { tournament: await service.addCourt(me(req), id(req.params.id, 'tournament'), req.body) }, 201);
  });
  tournaments.post('/:id/events', validateBody(createEventSchema), async (req, res) => {
    sendSuccess(res, { event: await service.addEvent(me(req), id(req.params.id, 'tournament'), req.body) }, 201);
  });

  const events = Router();
  events.use(requireAuth);
  events.get('/:id', async (req, res) => sendSuccess(res, { event: await service.eventDetail(me(req), id(req.params.id, 'event')) }));
  events.patch('/:id', validateBody(updateEventSchema), async (req, res) => {
    sendSuccess(res, { event: await service.updateEvent(me(req), id(req.params.id, 'event'), req.body) });
  });
  events.post('/:id/entries', validateBody(addEntrySchema), async (req, res) => {
    sendSuccess(res, { event: await service.addEntry(me(req), id(req.params.id, 'event'), req.body) }, 201);
  });
  events.post('/:id/draw', validateBody(drawSchema), async (req, res) => {
    sendSuccess(res, await service.draw(me(req), id(req.params.id, 'event'), req.body));
  });
  events.delete('/:id/draw', async (req, res) => sendSuccess(res, { event: await service.resetDraw(me(req), id(req.params.id, 'event')) }));

  const entries = Router();
  entries.use(requireAuth);
  entries.patch('/:id', validateBody(updateEntrySchema), async (req, res) => {
    sendSuccess(res, { event: await service.updateEntry(me(req), id(req.params.id, 'entry'), req.body) });
  });

  const fixtures = Router();
  fixtures.use(requireAuth);
  fixtures.get('/mine', async (req, res) => sendSuccess(res, { fixtures: await service.myScorerFixtures(me(req)) }));
  fixtures.get('/:id', async (req, res) => sendSuccess(res, { fixture: await service.fixtureView(id(req.params.id, 'fixture')) }));
  fixtures.patch('/:id', validateBody(scheduleFixtureSchema), async (req, res) => {
    sendSuccess(res, { fixture: await service.scheduleFixture(me(req), id(req.params.id, 'fixture'), req.body) });
  });
  fixtures.post('/:id/start', async (req, res) => sendSuccess(res, { match: await service.startFixture(me(req), id(req.params.id, 'fixture')) }));
  fixtures.post('/:id/walkover', validateBody(fixtureWalkoverSchema), async (req, res) => {
    sendSuccess(res, { match: await service.fixtureWalkover(me(req), id(req.params.id, 'fixture'), req.body) });
  });
  fixtures.post('/:id/result', validateBody(fixtureManualResultSchema), async (req, res) => {
    sendSuccess(res, { match: await service.fixtureManualResult(me(req), id(req.params.id, 'fixture'), req.body.scores) });
  });

  const courts = Router();
  courts.use(requireAuth);
  courts.post('/:id/scorers', validateBody(courtScorerSchema), async (req, res) => {
    sendSuccess(res, { tournament: await service.assignCourtScorer(me(req), id(req.params.id, 'court'), req.body.userId) });
  });

  return { tournaments, events, entries, fixtures, courts };
}
