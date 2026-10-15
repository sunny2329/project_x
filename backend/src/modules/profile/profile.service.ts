import type pg from 'pg';
import { withTransaction } from '../../database/pool.js';
import { AppError } from '../../utils/app-error.js';
import type { AuthRepository } from '../auth/auth.repository.js';
import { toPublicUser } from '../auth/auth.types.js';
import type { ProfileRepository } from './profile.repository.js';
import type { PlayersService } from '../players/players.service.js';
import type { MatchHistoryItem, Profile } from './profile.types.js';
import type { UpdateProfileInput, UpdateSportsInput } from './profile.validation.js';

export interface ProfileServiceDeps {
  pool: pg.Pool;
  repository: ProfileRepository;
  users: Pick<AuthRepository, 'findUserById'>;
  players: Pick<PlayersService, 'ensureForUser'>;
}

export class ProfileService {
  constructor(private readonly deps: ProfileServiceDeps) {}

  async getProfile(userId: string): Promise<Profile> {
    const { repository, pool, users } = this.deps;
    const [user, bio, sports, record, follows] = await Promise.all([
      users.findUserById(pool, userId),
      repository.findBio(pool, userId),
      repository.findPlayerSports(pool, userId),
      repository.findRecord(pool, userId),
      repository.countFollows(pool, userId),
    ]);
    if (!user) throw AppError.unauthorized('SESSION_REVOKED', 'Your session has ended. Please sign in again.');
    return { user: toPublicUser(user), bio, sports, record, ...follows };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
    const user = await this.deps.users.findUserById(this.deps.pool, userId);
    if (!user) throw AppError.unauthorized('SESSION_REVOKED', 'Your session has ended. Please sign in again.');
    await withTransaction(this.deps.pool, (db) => this.deps.repository.updateProfile(db, userId, user.username, input));
    return this.getProfile(userId);
  }

  async updateSports(userId: string, input: UpdateSportsInput): Promise<Profile> {
    const { repository, pool } = this.deps;
    if ((await repository.countActiveSports(pool, input.sportIds)) !== input.sportIds.length) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { sportIds: ['Unknown sport'] });
    }
    const player = await this.deps.players.ensureForUser(userId);
    await withTransaction(pool, (db) => repository.replacePlayerSports(db, player.playerId, input.sportIds, input.primarySportId));
    return this.getProfile(userId);
  }

  getMatchHistory(userId: string, limit: number): Promise<MatchHistoryItem[]> {
    return this.deps.repository.findMatchHistory(this.deps.pool, userId, limit);
  }
}
