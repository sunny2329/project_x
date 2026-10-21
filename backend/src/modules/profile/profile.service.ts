import type pg from 'pg';
import { withTransaction } from '../../database/pool.js';
import { AppError } from '../../utils/app-error.js';
import type { AuthRepository } from '../auth/auth.repository.js';
import { toPublicUser } from '../auth/auth.types.js';
import type { ProfileRepository } from './profile.repository.js';
import type { PlayersService } from '../players/players.service.js';
import { mediaUrl, ownedMediaIds } from '../media/media.routes.js';
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
    const [user, bio, extras, sports, record, follows, ratingTrends] = await Promise.all([
      users.findUserById(pool, userId),
      repository.findBio(pool, userId),
      repository.findExtras(pool, userId),
      repository.findPlayerSports(pool, userId),
      repository.findRecord(pool, userId),
      repository.countFollows(pool, userId),
      repository.findRatingTrends(pool, userId),
    ]);
    if (!user) throw AppError.unauthorized('SESSION_REVOKED', 'Your session has ended. Please sign in again.');
    const publicUser = toPublicUser(user);
    return {
      user: publicUser,
      bio,
      displayName: extras.displayName ?? publicUser.fullName,
      city: extras.city,
      photoUrl: extras.photoUrl,
      ratingTrends,
      sports,
      record,
      ...follows,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
    const user = await this.deps.users.findUserById(this.deps.pool, userId);
    if (!user) throw AppError.unauthorized('SESSION_REVOKED', 'Your session has ended. Please sign in again.');
    const { repository, pool } = this.deps;
    if (input.username && input.username.toLowerCase() !== user.username.toLowerCase() && (await repository.isUsernameTaken(pool, input.username, userId))) {
      throw AppError.conflict('USERNAME_TAKEN', 'This username is already taken.');
    }
    let photoUrl: string | null | undefined;
    if (input.photoMediaId === null) photoUrl = null;
    else if (input.photoMediaId) {
      const [owned] = await ownedMediaIds(pool, userId, [input.photoMediaId]);
      if (!owned) throw AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', { photoMediaId: ['Upload the photo first'] });
      photoUrl = mediaUrl(owned);
    }
    // Make sure the player row exists so a new scoreboard name has somewhere to go.
    if (input.displayName !== undefined) await this.deps.players.ensureForUser(userId);
    await withTransaction(pool, (db) =>
      repository.updateProfile(db, userId, user.username, {
        fullName: input.fullName,
        bio: input.bio,
        city: input.city,
        photoUrl,
        displayName: input.displayName,
        username: input.username,
      }),
    );
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

  async getMatchHistory(userId: string, limit: number, sport?: string): Promise<{ matches: MatchHistoryItem[]; counts: Record<string, number> }> {
    const [matches, counts] = await Promise.all([
      this.deps.repository.findMatchHistory(this.deps.pool, userId, limit, sport),
      this.deps.repository.countMatchesBySport(this.deps.pool, userId),
    ]);
    return { matches, counts };
  }
}
