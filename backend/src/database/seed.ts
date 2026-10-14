import { pathToFileURL } from 'node:url';
import { StatDataType, TYPE_MASTER_ROWS } from '../modules/match/match.codes.js';
import { SPORT_RULES } from '../modules/match/scoring/sport-rules.js';
import type { Queryable } from './pool.js';
import { createPool, withTransaction } from './pool.js';

/** The six MVP sports from the product document. `code` is the stable key the app uses. */
export const SPORTS = [
  { code: 'PICKLEBALL', name: 'Pickleball', description: 'Point-based. Launch sport.' },
  { code: 'BADMINTON', name: 'Badminton', description: 'Point-based. Launch sport.' },
  { code: 'TABLE_TENNIS', name: 'Table Tennis', description: 'Point-based.' },
  { code: 'VOLLEYBALL', name: 'Volleyball', description: 'Set/rally-based.' },
  { code: 'FOOTBALL', name: 'Football', description: 'Time + goal-based.' },
  { code: 'BOX_CRICKET', name: 'Box Cricket', description: 'Over-based.' },
] as const;

/** Inserts reference data that is missing. Never updates or deletes existing rows. Returns rows inserted per table. */
export async function seedReferenceData(db: Queryable): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const insert = async (table: string, sql: string, params: unknown[]) => {
    const { rowCount } = await db.query(sql, params);
    counts[table] = (counts[table] ?? 0) + (rowCount ?? 0);
  };

  for (const sport of SPORTS) {
    await insert('mst_sport', 'INSERT INTO mst_sport (code, name, description) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING', [
      sport.code,
      sport.name,
      sport.description,
    ]);
  }

  // Lookup values use fixed ids (see match.codes.ts); refuse to run if an id already means something else.
  for (const [id, category, description] of TYPE_MASTER_ROWS) {
    await insert('type_master', 'INSERT INTO type_master (id, type_id, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [
      id,
      category,
      description,
    ]);
  }
  const { rows: clashes } = await db.query<{ id: string }>(
    `SELECT t.id FROM type_master t JOIN jsonb_to_recordset($1::jsonb) AS e(id bigint, category int) ON e.id = t.id
      WHERE t.type_id <> e.category`,
    [JSON.stringify(TYPE_MASTER_ROWS.map(([id, category]) => ({ id, category })))],
  );
  if (clashes.length) throw new Error(`type_master ids already used for other categories: ${clashes.map((row) => row.id).join(', ')}`);
  // Explicit ids bypass the sequence; move it past them so rows added later don't collide.
  await db.query("SELECT setval(pg_get_serial_sequence('type_master', 'id'), (SELECT max(id) FROM type_master))");

  for (const [code, rules] of Object.entries(SPORT_RULES)) {
    const { rows } = await db.query<{ id: string }>('SELECT id FROM mst_sport WHERE code = $1', [code]);
    const sportId = rows[0]!.id;

    for (const format of rules.formats) {
      await insert(
        'mst_sport_format',
        `INSERT INTO mst_sport_format (sport_id, format_type_id, name, description, min_players, max_players)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (sport_id, format_type_id) DO NOTHING`,
        [sportId, format.formatType, format.name, 'min_players / max_players are per side', format.minPlayers, format.maxPlayers],
      );
      await insert(
        'mst_sport_scoring',
        `INSERT INTO mst_sport_scoring (sport_id, format_id, scoring_type_id, scoring_config)
         SELECT $1, f.id, $3, $4 FROM mst_sport_format f WHERE f.sport_id = $1 AND f.format_type_id = $2
         ON CONFLICT (sport_id, format_id) DO NOTHING`,
        [sportId, format.formatType, rules.scoringType, rules.config],
      );
    }

    const config = rules.config;
    const periods = config.kind === 'rally' ? config.bestOf : config.kind === 'timed_goals' ? config.periods : 2;
    const periodName = config.kind === 'rally' ? config.periodName : config.kind === 'timed_goals' ? 'Half' : 'Innings';
    for (let no = 1; no <= periods; no += 1) {
      await insert(
        'mst_sport_period',
        `INSERT INTO mst_sport_period (sport_id, period_type_id, name, sequence_no) VALUES ($1, $2, $3, $4)
         ON CONFLICT (sport_id, period_type_id, sequence_no) DO NOTHING`,
        [sportId, rules.periodType, `${periodName} ${no}`, no],
      );
    }
    for (const event of rules.events) {
      await insert(
        'mst_sport_event',
        'INSERT INTO mst_sport_event (sport_id, event_type_id, name) VALUES ($1, $2, $3) ON CONFLICT (sport_id, event_type_id) DO NOTHING',
        [sportId, event.type, event.name],
      );
    }
    for (const stat of rules.stats) {
      await insert(
        'mst_sport_stat',
        `INSERT INTO mst_sport_stat (sport_id, stat_code, stat_name, data_type_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (sport_id, stat_code) DO NOTHING`,
        [sportId, stat.code, stat.name, StatDataType.INTEGER],
      );
    }
  }
  return counts;
}

async function main(): Promise<void> {
  const { loadEnv } = await import('../config/env.js');
  const env = loadEnv();
  const pool = createPool({ connectionString: env.DATABASE_URL_DIRECT ?? env.DATABASE_URL, max: 1 });
  try {
    const counts = await withTransaction(pool, (db) => seedReferenceData(db));
    for (const [table, inserted] of Object.entries(counts)) console.log(`${table}: ${inserted} inserted`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
