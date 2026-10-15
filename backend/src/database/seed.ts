import { SPORTS } from '../catalog/sports.js';
import { parseConfig, scoringRegistry } from '../engine/scoring/index.js';
import { Prisma, type Db, type DbTx } from './prisma.js';

/** type_master values the raw-SQL modules (feed, social, chat) still use as FK targets. */
const TYPE_MASTER_ROWS: ReadonlyArray<readonly [number, number, string]> = [
  [801, 8, 'Match result'],
  [802, 8, 'Post'],
  [1201, 12, 'Public'],
  [1202, 12, 'Followers'],
  [1301, 13, 'Direct'],
  [1302, 13, 'Group'],
];

/**
 * Reference data: sports (ids kept stable), formats and rulesets. Idempotent upserts by
 * natural key; never deletes. A ruleset whose plugin is not registered is refused.
 */
export async function seedReferenceData(db: DbTx): Promise<Record<string, number>> {
  const counts = { sports: 0, formats: 0, rulesets: 0, typeMaster: 0 };
  for (const sport of SPORTS) {
    const data = {
      slug: sport.slug,
      name: sport.name,
      category: sport.category,
      scoringModel: sport.scoringModel,
      isActive: sport.isActive,
      iconKey: sport.iconKey,
      accentColor: sport.accentColor,
      sortOrder: sport.sortOrder,
    };
    await db.sport.upsert({ where: { id: sport.id }, create: { id: sport.id, ...data }, update: data });
    counts.sports += 1;
    for (const [i, f] of sport.formats.entries()) {
      const fdata = { name: f.name, playersPerSide: f.playersPerSide, minPerSide: f.minPerSide ?? f.playersPerSide, maxPerSide: f.maxPerSide ?? f.playersPerSide, sortOrder: i };
      await db.sportFormat.upsert({ where: { sportId_code: { sportId: sport.id, code: f.code } }, create: { sportId: sport.id, code: f.code, ...fdata }, update: fdata });
      counts.formats += 1;
    }
    // Clear defaults first: one default per sport is a unique index.
    await db.scoringRuleset.updateMany({ where: { sportId: sport.id, isDefault: true, slug: { notIn: sport.rulesets.filter((r) => r.isDefault).map((r) => r.slug) } }, data: { isDefault: false } });
    for (const r of sport.rulesets) {
      const config = parseConfig(scoringRegistry.get(r.scoringModel), r.config) as Prisma.InputJsonValue;
      const rdata = { name: r.name, scoringModel: r.scoringModel, config, isDefault: r.isDefault ?? false, isActive: true };
      await db.scoringRuleset.upsert({ where: { sportId_slug: { sportId: sport.id, slug: r.slug } }, create: { sportId: sport.id, slug: r.slug, ...rdata }, update: rdata });
      counts.rulesets += 1;
    }
  }
  // Explicit ids bypass the sequence; move it past them.
  await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('sports', 'id'), (SELECT max(id) FROM sports))`);
  for (const [id, category, description] of TYPE_MASTER_ROWS) {
    counts.typeMaster += await db.$executeRaw`INSERT INTO type_master (id, type_id, description) VALUES (${id}, ${category}, ${description}) ON CONFLICT (id) DO NOTHING`;
  }
  await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('type_master', 'id'), (SELECT max(id) FROM type_master))`);
  return counts;
}

/**
 * One-off, idempotent copy from the legacy tables: a player row per user, "sports I play"
 * (usr_user_sport), and ratings (usr_sport_rating). Legacy rows are left untouched.
 */
export async function backfillFromLegacy(db: DbTx): Promise<Record<string, number>> {
  const players = await db.$executeRaw`
    INSERT INTO players (user_id, display_name, phone)
    SELECT u.id, coalesce(p.display_name, u.username), u.phone_country_code || u.phone_number
      FROM usr_user u LEFT JOIN usr_user_profile p ON p.user_id = u.id
     WHERE NOT EXISTS (SELECT 1 FROM players pl WHERE pl.user_id = u.id)
       AND (u.phone_country_code || u.phone_number) ~ '^\\+[1-9][0-9]{7,14}$'`;
  const playerSports = await db.$executeRaw`
    INSERT INTO player_sports (player_id, sport_id, is_primary)
    SELECT pl.id, us.sport_id::int, us.is_primary
      FROM usr_user_sport us JOIN players pl ON pl.user_id = us.user_id JOIN sports s ON s.id = us.sport_id
     ORDER BY us.is_primary
    ON CONFLICT DO NOTHING`;
  const ratings = await db.$executeRaw`
    INSERT INTO player_ratings (player_id, sport_id, system, rating, rated_matches, updated_at)
    SELECT pl.id, r.sport_id::int, 'elo', r.rating::float8, r.matches_played, now()
      FROM usr_sport_rating r JOIN players pl ON pl.user_id = r.user_id JOIN sports s ON s.id = r.sport_id
    ON CONFLICT DO NOTHING`;
  return { players, playerSports, ratings };
}

export async function seedAll(db: Db): Promise<Record<string, number>> {
  return db.$transaction(async (tx) => ({ ...(await seedReferenceData(tx)), ...(await backfillFromLegacy(tx)) }), { maxWait: 20_000, timeout: 120_000 });
}
