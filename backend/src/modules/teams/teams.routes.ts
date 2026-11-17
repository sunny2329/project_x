import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { sendSuccess } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import type { ParticipantInput } from '../players/players.service.js';
import { participantSchema } from '../matches/matches.validation.js';
import { MAX_TEAM_MEMBERS, type TeamsService } from './teams.service.js';

const name = z.string().trim().min(1, 'Enter a team name').max(80, 'Use at most 80 characters');
const members = z.array(participantSchema).min(1, 'Add a player').max(MAX_TEAM_MEMBERS, `A team can have up to ${MAX_TEAM_MEMBERS} players`);

export const createTeamSchema = z.object({
  sport: z.string().trim().min(1, 'Pick a sport').max(40),
  name,
  members: members.optional(),
});
export const renameTeamSchema = z.object({ name });
export const addMembersSchema = z.object({ members });
export const setRoleSchema = z.object({ role: z.enum(['captain', 'player']) });
export const listTeamsQuerySchema = z.object({
  /** Whose teams; the caller's when left out. */
  userId: z.uuid().optional(),
  sport: z.string().trim().min(1).max(40).optional(),
});

const uuid = z.uuid();
function id(raw: string | string[] | undefined, what: 'team' | 'member'): string {
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) throw AppError.notFound(`${what.toUpperCase()}_NOT_FOUND`, what === 'team' ? 'This team does not exist.' : 'This player is not in the team.');
  return parsed.data;
}

/** `/api/v1/teams`: saved teams in any sport, their members and captains. */
export function createTeamsRouter(service: TeamsService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);
  const me = (req: { auth?: { userId: string } }) => req.auth!.userId;

  router.get('/', async (req, res) => {
    const query = listTeamsQuerySchema.safeParse(req.query);
    if (!query.success) throw AppError.badRequest('VALIDATION_ERROR', 'Invalid query.', z.flattenError(query.error).fieldErrors);
    sendSuccess(res, { teams: await service.listFor(me(req), query.data.userId ?? me(req), query.data.sport) });
  });
  router.post('/', validateBody(createTeamSchema), async (req, res) => {
    const body = req.body as z.infer<typeof createTeamSchema>;
    sendSuccess(res, { team: await service.create(me(req), { ...body, members: body.members as ParticipantInput[] | undefined }) }, 201);
  });
  router.get('/:id', async (req, res) => sendSuccess(res, { team: await service.get(me(req), id(req.params.id, 'team')) }));
  router.patch('/:id', validateBody(renameTeamSchema), async (req, res) => {
    sendSuccess(res, { team: await service.rename(me(req), id(req.params.id, 'team'), req.body.name) });
  });
  router.delete('/:id', async (req, res) => {
    await service.remove(me(req), id(req.params.id, 'team'));
    sendSuccess(res, { deleted: true });
  });
  router.post('/:id/members', validateBody(addMembersSchema), async (req, res) => {
    sendSuccess(res, { team: await service.addMembers(me(req), id(req.params.id, 'team'), req.body.members as ParticipantInput[]) });
  });
  /** A captain removing a player, or a player leaving (their own player id). `team` is null once you're out or it's gone. */
  router.delete('/:id/members/:playerId', async (req, res) => {
    sendSuccess(res, { team: await service.removeMember(me(req), id(req.params.id, 'team'), id(req.params.playerId, 'member')) });
  });
  router.patch('/:id/members/:playerId', validateBody(setRoleSchema), async (req, res) => {
    sendSuccess(res, { team: await service.setRole(me(req), id(req.params.id, 'team'), id(req.params.playerId, 'member'), req.body.role) });
  });
  return router;
}
