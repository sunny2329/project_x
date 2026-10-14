# Pivot plan: racket sports first (tournaments + friendly matches)

_Status: **draft, waiting for the owner's approval**. Nothing in the database or code has been
changed. Written 2026-10-14. Schema draft: [schema.prisma](schema.prisma)._

---

## 1. Audit findings (Step 1)

### 1.1 What the repo is today

| Area | Today |
| --- | --- |
| Backend | Node 22 + Express 5 + TypeScript, **raw SQL through `pg`** (no ORM). Modules: auth, profile, match, feed, social, chat. Vitest. |
| Frontend | Expo 57 / React Native 0.86 / expo-router, Zustand. Native only (no web target). Jest. |
| Database | Neon Postgres 18.6, database `project_x`, **46 tables created by hand by the owner**. The wiki rule: "the backend never creates or alters tables". |
| Prisma | **Not used anywhere.** No `schema.prisma`, no Prisma migrations. |
| Migrations | `backend/src/database/migrate.ts` + `migrations/001_auth.sql`: an old runner for the abandoned `neondb` database (`users`, `auth_sessions` ...). Never applied to `project_x` (there is no `schema_migrations` table). **Dead code.** |
| Proposed SQL | `docs/sql/2026-09-29_messaging_and_indexes.sql` (chat tables + indexes): **never applied**. The chat module's code targets tables that don't exist. |
| Seeds | `backend/src/database/seed.ts`: `mst_sport` (6 sports), `type_master` (34 lookup codes), `mst_sport_format/_scoring/_period/_event/_stat` from `scoring/sport-rules.ts`. |
| Scoring | `backend/src/modules/match/scoring/`: pure engines `rally.ts` (pickleball, badminton, TT, volleyball), `timed-goals.ts` (football), `overs.ts` (box cricket), and a `switch` in `replay()`. No serve tracking, no side-out, no tennis. |
| Live path | `match/live/`: Redis (or in-memory) live store with version checks plus a background persister into Postgres. Sport-agnostic and well tested. **Worth keeping.** |
| Match API | `GET /matches/setup`, `GET /matches/live`, `POST /matches`, `GET /matches/:id`, `POST /:id/events`, `/undo`, `/finish`, `/abandon`. Only the creator can score. Elo K=32 (`rating.ts`). Every player must be a registered user. |
| Tournaments | Designed in `docs/scoring-and-tournaments.md` (corporate focus, 6 sports). **Nothing is built.** |
| Tests | Backend: 26 unit tests pass (scoring, rating, live, rate-limit). The auth API tests need the real DB, and **`tsc` fails**: `auth/__tests__/test-app.ts` imports the deleted `providers/sms-verification.js`. Frontend: 64 tests pass, typecheck is clean. |
| Git | `master` has **no commits**; the whole repo is untracked. `.env` files and `dist/` are ignored. |

### 1.2 Data in the live database (`project_x`, read-only check)

| Table | Rows | Notes |
| --- | --- | --- |
| `usr_user` / `usr_user_profile` | 5 / 5 | Created 2026-09-26 to 09-29; these look like dev/test accounts |
| `auth_session`, `auth_login_log`, `auth_otp`, `auth_password_history` | 27, 29, 6, 5 | |
| `mst_sport` | 6 | ids 1-6: PICKLEBALL, BADMINTON, TABLE_TENNIS, VOLLEYBALL, FOOTBALL, BOX_CRICKET |
| `mst_sport_format/_scoring/_period/_event/_stat`, `type_master` | 9/9/20/8/16, 34 | Seeded reference data |
| `match_master` | 3 | **All still `live` (602)**: 1 badminton, 1 pickleball, 1 box cricket. None finished. |
| `match_score_event`, `match_period`, `match_score_state`, `match_team`, `match_participant` ... | 10, 3, 9, 6, 6 | Belong to those 3 matches |
| `match_result`, `match_stat_snapshot*`, `usr_sport_stat_history` | 0 | No match was ever completed |
| `usr_sport_rating`, `usr_sport_stats`, `usr_user_sport` | 2, 2, 2 | Badminton + pickleball, so defaults only (no completed matches) |
| `social_post`, comments, likes, follows, blocks, notifications, media | 0 | |

**Conclusion:** the database holds real structure but almost no real data. The only rows that
would be lost by retiring the old match tables are **3 unfinished test matches** (10 score events).
Users and auth data are untouched by this plan.

**Environment gotcha found during the audit:** this shell exports `PGHOST/PGPORT=5433/PGDATABASE=aterpv2`
for another project. The Neon URLs in `backend/.env` have no port, so `pg` takes **5433** from the
environment and times out. Fix: put `:5432` in both URLs (proposed in task 0).

### 1.3 Everything tied to volleyball, football and box cricket

| Where | What |
| --- | --- |
| DB rows | `mst_sport` ids 4, 5, 6; their `mst_sport_format/_scoring/_period/_event/_stat` rows; `type_master` codes 202-204 (scoring), 303-304 (half, innings), 402-405 (goal, period end, ball, innings end); 1 live box-cricket `match_master` with its events |
| `backend/src/database/seed.ts` | `SPORTS` list (VOLLEYBALL, FOOTBALL, BOX_CRICKET), period naming logic per kind |
| `match/scoring/timed-goals.ts` | Football engine (60 lines) |
| `match/scoring/overs.ts` | Box cricket engine (150 lines) |
| `match/scoring/rally.ts` | `decidingPoints` (volleyball deciding set to 15), `periodName: 'Set'` |
| `match/scoring/types.ts` | `TimedGoalsConfig`, `OversConfig`, `CricketView`, `InningsView`, goal/ball/innings events |
| `match/scoring/index.ts` | `switch (config.kind)` over the 3 engines |
| `match/scoring/sport-rules.ts` | VOLLEYBALL, FOOTBALL, BOX_CRICKET rules; `applyOptions` cases for `timed_goals`/`overs` |
| `match/match.codes.ts` | `ScoringType.SET/TIME_GOAL/OVER`, `PeriodType.HALF/INNINGS`, `ScoreEventType.GOAL/PERIOD_END/BALL/INNINGS_END` |
| `match/match.validation.ts` | `goal`, `period_end`, `ball`, `innings_end` events; `periodMinutes`, `overs`, `wickets`, `battingFirst` options |
| `match/match.service.ts` | `EVENT_TYPE_ID`, `toScoreEvents`, `toEngineEvent`, `scoreFor` (cricket/goal branches), `resultPost` ("tied") |
| `match/live/live-store.ts` | `periodStarts` comment (football clock) |
| `match/scoring/scoring.test.ts` | Volleyball test, 2 football tests, 6 box-cricket tests |
| Frontend `features/match/types.ts` | `TimedGoalsConfig`, `OversConfig`, cricket view and events |
| Frontend `features/match/format.ts` | Icons/colours for the 3 sports, rules text, options, "Tied", chase text, cricket headline |
| Frontend `ScoringControls.tsx` | `FootballControls`, `CricketControls`, `switch` on kind |
| Frontend `Scoreboard.tsx` | Football clock, cricket "this over" balls, batting indicator |
| Frontend `LiveMatchCard.tsx` | Batting side, football leader highlight |
| Frontend `PlayScreen.tsx` | Overs-specific "batting first" option |
| Frontend `PostCard.tsx` | `PERIOD_LABELS` for VOLLEYBALL/FOOTBALL/BOX_CRICKET, "Runs" label |
| Frontend `__tests__/format.test.ts`, `ScoringControls.test.tsx`, `fixtures.ts` | Football/cricket cases |
| Frontend `auth/components/WelcomeArt.tsx` | Decorative "Football 998" card |
| Docs | `scoring-and-tournaments.md` (6-sport design), `database-design.md`, `wiki.md` |

---

## 2. Decisions this plan makes (please confirm or overrule)

1. **Prisma takes over schema management, starting from a baseline.** `prisma db pull`
   introspects all 46 existing tables into `schema.prisma`. A `0_baseline` migration is generated
   from them and marked as already applied (`prisma migrate resolve --applied`), so Prisma never
   recreates or drops them. New tables arrive as normal Prisma migrations. This replaces the wiki
   rule "the owner creates tables by hand"; migrations are still applied only by you (or by me
   once you say so) with `prisma migrate deploy`.
2. **`prisma migrate dev` never runs against `project_x`.** Development uses a **Neon branch**
   (`dev`), and tests use throwaway schemas (as the auth tests already do).
3. **The new core lives in new, plural, snake_case tables** (`sports`, `matches`, `match_sides` ...).
   No name collides with the singular legacy tables, so old and new can coexist during the switch.
4. **Existing modules keep their raw-SQL repositories** (auth, profile, feed, social, chat).
   The new modules (sports, players, matches, tournaments) use Prisma Client through
   `@prisma/adapter-pg`, sharing the same `pg` driver. Profile/feed queries that read match
   history and ratings move to the new tables.
5. **Open sets are `varchar` + Zod/registry validation, closed sets are Postgres enums.** Sport
   category, scoring model, tournament format, stage type, segment type and event type must grow
   without a migration (your rule: "adding a sport needs only a plugin, a Sport row, and a
   ruleset"). Status and role fields are enums.
6. **Undo keeps the log append-only:** undo sets `voided_at` on the newest non-voided event
   instead of deleting it, then replays. Nothing is ever deleted, and the undo is auditable.
7. **The engines are pure TypeScript under `backend/src/engine/`** (`scoring/`, `tournament/`,
   `rating/`) with zero imports from Express, `pg`, Prisma or the rest of the app (enforced by an
   ESLint `no-restricted-imports` rule). Each can later move into a shared package used by the app
   for optimistic scoring. The frontend talks to the API only through `ScoreSummary` JSON.
8. **Guests and claiming:** every person who plays is a `players` row; a user account is
   optional (`players.user_id`). At sign-up, if a guest `players` row has the same **verified**
   phone, it is linked to the new user, with no merge needed. If an existing user claims another guest
   later (OTP to the guest's phone), the guest's rows are re-pointed to the user's player and the
   guest row is kept with `merged_into_id`.
9. **Public links are served by the backend as lightweight HTML pages** (`/s/:shareToken` for a
   match, `/t/:slug` for a tournament) that poll a public JSON endpoint. The app has no web target,
   and this avoids adding react-native-web plus a second deploy. (See open question Q3.)

---

## 3. What happens to each part of the code

### 3.1 Refactored into the generic core

| Today | Becomes |
| --- | --- |
| `match/scoring/types.ts` (`ScoringEngine`, `ScoreView`) | `engine/scoring/plugin.ts`: `ScoringPlugin` interface + generic `ScoreSummary` |
| `match/scoring/index.ts` (`switch` on kind) | `engine/scoring/registry.ts` (`scoringModel` → plugin) + `replay.ts` |
| `match/scoring/rally.ts` | `engine/scoring/plugins/rally.ts` (rewritten: serve tracking, badminton serve court, TT serve rotation, deciding-game points kept for volleyball) |
| (new) | `engine/scoring/plugins/side-out.ts` (traditional pickleball), `engine/scoring/plugins/tennis.ts` (tennis, padel) |
| `match/rating.ts` | `engine/rating/elo.ts` behind a `RatingSystem` interface (Glicko-2 slot) |
| `match/live/*` | Kept; its event and job shapes move from `typeId/side/data` to `type/sideIndex/payload` |
| `match/match.service.ts`, `match.repository.ts` | Rewritten on Prisma + the plugin registry; no sport branches |
| `match/match.validation.ts` | Generic envelope `{type, sideIndex?, participantId?, payload, version, clientEventId}`, with the payload checked by `plugin.eventSchema` |
| `database/seed.ts` | Prisma seed: sports, formats and rulesets (rulesets validated by each plugin's `configSchema`) |
| Frontend `ScoringControls`, `Scoreboard`, `LiveMatchCard`, `format.ts`, `PostCard` | Rendered only from `ScoreSummary` (sides, current score, server marker, segments, callout, **actions**). Sport icons and colours come from `sports.icon_key` / `accent_color`. |
| Frontend `PlayScreen` | Quick start: sport → ruleset → singles/doubles → players (search or guest) → start |

### 3.2 Stays as is

Auth, profile (except its match/rating queries), social, chat (still waiting on its SQL), feed
(except the result-post source), live store/persister core, theme, shared components and the
existing frontend auth/profile tests.

### 3.3 Disabled (kept, not deleted)

- **Sports rows:** volleyball, football and box cricket are seeded into `sports` with
  `is_active = false`, keeping ids 4-6. Every sport list in the API filters `is_active`, and the
  API refuses to create matches or tournament events for inactive sports.
- **Volleyball** keeps working technically: it is a rally-model sport (sets to 25, deciding
  set to 15), so it gets a ruleset and only needs `is_active = true` to come back.
- **Football and box cricket engines** move to `engine/scoring/parked/` with a README ("not in MVP;
  port to the plugin interface before activating"). They are not registered, so these two sports
  get **no rulesets** until a plugin exists. Their tests move with them and keep running against
  the old engine API, so the logic doesn't rot.
- **Legacy tables** (`mst_sport*`, `type_master`, `match_master`, `match_team`,
  `match_participant`, `match_team_member`, `match_period`, `match_score_event`,
  `match_score_state`, `match_correction`, `match_result`, `match_stat_snapshot*`,
  `match_report`, `usr_sport_rating`, `usr_sport_stats`, `usr_sport_stat_history`) are **left in
  place and frozen**: no code writes to them after the switch. Dropping them is a separate,
  later decision that needs your explicit approval.

### 3.4 Removed (truly dead or conflicting); please approve this list

| File | Why |
| --- | --- |
| `backend/src/database/migrate.ts`, `backend/src/database/migrations/001_auth.sql` | Old runner for the abandoned `neondb` schema; conflicts with Prisma migrations. The wiki already lists it for deletion. |
| `backend/src/modules/match/scoring/index.ts`, `types.ts`, `sport-rules.ts` | Replaced by the registry, the plugin interface and seeded rulesets (the parked engines keep a private copy of the types they need) |
| `backend/src/modules/match/match.codes.ts` (match/scoring codes) | `type_master` codes replaced by enums/varchar keys. `PostType`/`PostVisibility`/`ConversationType` move to the feed/chat modules, which still use them. |
| Frontend `FootballControls`, `CricketControls`, the cricket/football parts of `Scoreboard`, `format.ts`, `LiveMatchCard`, `PostCard` and their tests | Replaced by generic `ScoreSummary` rendering; they would conflict with it |
| `backend/src/modules/auth/__tests__/test-app.ts` import of `sms-verification.js` | Points at a deleted file and breaks `tsc`. I'll fix the import rather than delete the harness. |

---

## 4. Schema and migration strategy

The full draft is in **[schema.prisma](schema.prisma)** (passes `prisma validate` on Prisma
**7.10.0**). Note: npm's `latest` tag currently points at an `8.0.0` release candidate with a
different CLI, so the plan pins `prisma@7.10.0`.

### 4.1 Model map

```
sports ─┬─ sport_formats (singles / doubles / team, players per side)
        └─ scoring_rulesets (config jsonb, validated by plugin.configSchema)

players (guest or linked to usr_user) ── team_members ── teams ── team_stats
venues ── courts

matches (context, status, scoring_mode, result_type, verification, share_token,
         scoring_model + ruleset_config SNAPSHOT, version, summary cache)
  ├─ match_sides (side_index, team?, tournament entry?, outcome)
  │    └─ match_participants (player, position, sort_order)
  ├─ match_segments (self-referencing: set → game → tiebreak …) ── match_segment_scores
  ├─ match_events (append-only, sequence, type, payload jsonb, voided_at)
  ├─ match_scorers, match_confirmations
  └─ player_rating_history

player_ratings, player_sport_stats   (per player per sport)

tournaments ─┬─ tournament_staff (organizer / co_organizer / scorer / referee)
             ├─ courts ── court_scorers
             └─ tournament_events (category: sport, format, ruleset, format key + config,
                  │                tiebreakers, rules_override)
                  ├─ tournament_entries ── tournament_entry_members ── players
                  └─ tournament_stages ── stage_groups ── stage_group_entries
                                        └─ fixtures (round, position, entry1/2, sources,
                                           next/loser-next fixture + slot, court, time,
                                           match_id → matches, winner_entry)
```

**Design points worth checking:**
- `matches.ruleset_config` + `scoring_model` are copied at creation; replays never read the ruleset row.
- `match_segments` and `matches.summary` are **projections** rebuilt from `match_events` after
  every change (same idea as today's `match_period`/`match_score_state`). They exist for queries
  (game scores in history, standings) and can always be rebuilt.
- Composite FKs keep denormalised ids honest: `match_participants(side_id, match_id)` →
  `match_sides(id, match_id)`, and `tournament_entry_members(entry_id, event_id)` →
  `tournament_entries(id, event_id)`. This gives "a player once per match" and "one entry per
  player per category" as plain unique constraints.
- Walkover / no-show / retirement: the fixture's `matches` row gets `status = walkover` or
  `retired` and `result_type = walkover | no_show | retired | double_walkover`. Walkovers create a
  match with no events, so the player's history shows "W/O". Byes create no match
  (`fixtures.status = bye`). Walkovers and no-shows never change ratings.
- Constraints Prisma can't express (partial unique "one default ruleset per sport", `UNIQUE NULLS
  NOT DISTINCT` on segments and fixtures, CHECKs) are hand-written into the migration SQL.

### 4.2 Migrations, in order

| # | Migration | Destructive? |
| --- | --- | --- |
| 0 | `0_baseline`: introspected snapshot of the 46 existing tables, **marked applied, never executed** | No |
| 1 | `1_core_schema`: all new enums and tables above | No (create only) |
| 2 | `2_reference_data` (Prisma seed, idempotent upserts): `sports` ids 1-8 (1-3 and new 7 padel, 8 tennis active; 4-6 inactive), `sport_formats`, default `scoring_rulesets` | No |
| 3 | `3_backfill` (SQL, idempotent): one `players` row per `usr_user` (5); copy the 2 `usr_sport_rating` and 2 `usr_sport_stats` rows into `player_ratings` / `player_sport_stats` | No (copies; the source rows stay) |
| 4 | `4_repoint_fks` (**needs your approval**): (A) `usr_user_sport.sport_id` FK from `mst_sport` → `sports` (same ids, 2 rows, values unchanged); (B) `social_post.match_id` FK from `match_master` → `matches` (0 rows use it). Only the constraints change; no column or data is dropped. | Constraint swap only |
| later | Drop the frozen legacy match/mst tables (3 unfinished test matches) | **Yes: separate approval, not part of this pivot** |

The 3 unfinished legacy matches are **not migrated** (they are test data and one is box cricket).
They stay readable in the frozen tables until you decide to drop them.

Rollback: migrations 1-3 only add, so rolling back means dropping the new tables. Migration 4 is
reversible by swapping the two FKs back.

---

## 5. Engine design

### 5.1 Scoring plugin interface (`engine/scoring/plugin.ts`)

```ts
export interface SideInfo { index: number; playerCount: number }

export interface ScoringPlugin<Config, State, Event> {
  scoringModel: string;                       // "rally" | "side_out" | "tennis"
  configSchema: ZodType<Config>;
  eventSchema: ZodType<Event>;
  /** Which side sizes the model supports (padel: doubles only, via its ruleset config). */
  validateSides(config: Config, sides: SideInfo[]): string | null;
  initialState(config: Config, sides: SideInfo[]): State;
  applyEvent(state: State, event: Event, config: Config): State;   // pure; throws ScoringError
  isComplete(state: State): boolean;
  summary(state: State, config: Config): ScoreSummary;
  /** Optional: build a final state from typed-in scores (manual results). */
  fromManualResult?(config: Config, sides: SideInfo[], segments: ManualSegment[]): State;
}

/** Generic display + stats shape, the only thing UI, feed, profiles and standings read. */
export interface ScoreSummary {
  complete: boolean;
  winnerSideIndex: number | null;
  sides: Array<{
    index: number;
    primary: string;            // big number: games/sets won ("1")
    current: string | null;     // in-game score: "17", "40", "AD"
    serving: boolean;
    serverNumber: 1 | 2 | null; // pickleball doubles
    serverParticipantIndex: number | null;
  }>;
  segments: SegmentSummary[];   // tree: set → game → tiebreak; mirrors match_segments
  headline: string;             // "21-17, 18-21, 21-19" / "6-4, 3-6, [10-7]"
  callout: string | null;       // "4-7-2", "Deuce", "Advantage A", "Golden point", "Match point"
  totals: { major: number[]; minor: number[]; majorLabel: string; minorLabel: string };
  actions: ScoringAction[];     // buttons the scorer may press next, with the event to send
}
```

`replay(plugin, config, sides, events)` folds `applyEvent` over the non-voided events. The
**registry** (`registerPlugin`, `getPlugin(scoringModel)`) is the only place that knows the
plugins. API and UI never branch on a sport: the UI draws `summary.actions` as buttons and
`summary.sides/segments` as the scoreboard.

### 5.2 The three MVP plugins

| Plugin | Config (Zod, defaults by ruleset) | Behaviour |
| --- | --- | --- |
| `rally` | `pointsToWin`, `winBy`, `cap` (null = none), `bestOf`, `decidingGamePoints?`, `serve: {rotation: 'winner_serves' \| 'every_n', everyN, deuceEvery, courtBySide: bool}` | Badminton: 21 / win by 2 / cap 30 / Bo3; the rally winner serves; the server serves from the **right court when their score is even**, and the doubles partner order is tracked. TT: 11 / win by 2 / Bo3-5-7; serve changes **every 2 points, and every point from 10-10**; the first server alternates each game. Pickleball rally format: 11 (or 15/21) with the rally winner serving. |
| `side_out` | `pointsToWin` (11/15/21), `winBy`, `bestOf` (1/3), `doubles` | Only the serving side scores. Doubles track server 1 / server 2; **a game starts at 0-0-2**; a fault by server 1 passes to server 2, a fault by server 2 is a side-out. The callout is the "score-score-server" call. Singles: a fault means side-out. |
| `tennis` | `deuce: 'advantage' \| 'golden_point'`, `setGames` 6, `setWinBy` 2, `tiebreakAt` 6, `tiebreakPoints` 7, `bestOf` 3/5, `finalSet: 'full' \| 'match_tiebreak'`, `matchTiebreakPoints` 10, `allowedSides` | 0/15/30/40/game; advantage or golden point; sets to 6 by 2 with a tiebreak at 6-6 (first to 7 by 2, serve rotation 1-2-2 …); optional match tiebreak to 10 as the final set. Tennis: Bo3, advantage, singles or doubles. Padel: Bo3, doubles only, golden point configurable. The server changes every game, and in doubles alternates across teams and partners. |

All three record the server on every point (in the state, surfaced in `summary`). Each event
is a `rally_won { sideIndex }` (and `side_out`/`fault` events where needed). Core events that
every plugin handles uniformly in `replay` are `retired { sideIndex }` and `walkover`.

### 5.3 Tournament engine (`engine/tournament/`, pure)

- `formats/` registry keyed by `tournament_events.format`: `knockout`, `round_robin`,
  `groups_knockout`. Each has a Zod `configSchema` and `generate(entries, config) → DrawPlan`
  (stages, groups, fixtures with round, position, sources and next/loser links). A new format means
  a new file plus registration, with no schema change.
- `seeding.ts`: standard bracket positions (1 v 16, 8 v 9 …), **byes to the top seeds** for
  non-power-of-2 fields, snake seeding into groups, random draw with a seedable RNG (reproducible).
- `round-robin.ts`: circle method; a rotating bye for odd counts.
- `advance.ts`: `applyResult(plan, fixtureId, result)` fills the next fixture's slot, auto-advances
  byes, and routes losers (3rd-place match).
- `standings.ts`: `rank(entries, results, tiebreakers)` with tiebreakers `match_wins`,
  `head_to_head` (a mini-league among the tied entries, re-applied recursively for 3+ way ties),
  `major_diff`, `minor_diff`, then seed as the final stable fallback. Walkovers count as a win with
  the format's configured walkover score; a retirement counts the score at retirement, with the
  match awarded to the opponent.
- `qualification.ts`: group finishing positions → knockout slots (cross-over A1 v B2).

### 5.4 Permissions (service layer)

| Action | Who |
| --- | --- |
| Score a match | Friendly: creator + `match_scorers`. Tournament: organizer/co-organizer, `match_scorers`, `court_scorers` of the match's court, `tournament_staff` referees. |
| Manage a tournament | `organizer`, `co_organizer` |
| Confirm a manual result | Any registered player on an opposing side |
| View a public match/tournament | Anyone with the link (`visibility` public or unlisted); private = staff + players |

---

## 6. Ordered task list (each step is its own commit)

0. **Housekeeping:** initial commit of the current repo as-is on `main`, then branch
   `pivot/racket-first`. Add `:5432` to the Neon URLs in `.env.example` (you update `.env`).
   Fix the broken auth test import.
1. **Prisma setup:** add `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `prisma.config.ts`.
   Run `db pull` against the Neon `dev` branch, write `0_baseline`, and mark it applied (on the dev branch).
2. **Core schema migration** `1_core_schema` + hand-written constraints. Apply to the dev branch only.
3. **Engine: plugin interface, registry, replay**, plus a dummy-plugin test proving a new model
   registers without touching core code.
4. **Rally plugin + tests:** normal game, deuce, **badminton 29-29 → 30 cap**, badminton
   even/odd serve court, **TT 10-10 serve switch**, TT Bo5/Bo7, undo via replay.
5. **Side-out plugin + tests:** **0-0-2 start**, server 1 → server 2 → side-out, singles,
   scoring only by the serving side, 11/15/21, undo.
6. **Tennis plugin + tests:** games, deuce/advantage, **padel golden point**, **tiebreak at
   6-6**, **match tiebreak to 10**, doubles serve rotation, undo.
7. **Park the football/cricket engines** under `engine/scoring/parked/`. Remove the old
   `match/scoring` module.
8. **Seed:** 8 sports (5 active), formats and default rulesets, each validated by its plugin.
   Backfill players/ratings/stats (`3_backfill`).
9. **Tournament engine + tests:** **5-, 8- and 13-entry knockouts with byes**, a **4-player round
   robin with a 3-way tie**, **groups → knockout qualification**, **walkover/retirement**
   handling, 3rd-place routing.
10. **Rating:** `RatingSystem` interface, Elo implementation (moved from `rating.ts`), Glicko-2
    stub. Rated only when every participant is registered, the result is live-scored or
    confirmed, and the result type is `played` or `retired` (see Q4).
11. **API services/routes** (Prisma + registry + engine): sports, rulesets, players (search,
    guest create, claim), matches (quick start, events, undo, complete, retire, abandon,
    manual result, confirm/dispute), public match JSON, tournaments (CRUD, events, entries, seeding,
    draw preview/confirm, fixtures, courts, time slots, staff and scorer assignment, start fixture,
    walkover/no-show), public tournament JSON. Integration tests against a throwaway schema.
    Live store adapted to the new event shape.
12. **Profile/feed switch-over:** profile stats, ratings and history read from the new tables;
    a result post on completion; `4_repoint_fks` (after your approval).
13. **Public pages:** `/s/:token` live scoreboard and `/t/:slug` tournament page (brackets,
    fixtures, live scores, standings, results) as small server-rendered HTML.
14. **Frontend friendly flow:** quick start, guest players, generic live scoring screen from
    `ScoreSummary`, share link, result card (an image via `react-native-view-shot` + the share
    sheet), and the pending-confirmations list.
15. **Frontend tournament flow:** organizer screens (create, categories, entries, seeding, draw,
    fixtures, courts/slots, scorer assignment), scorer view, and tournament screens in the app.
16. **Active sports only** everywhere (profile sport picker, play, tournaments).
17. `ADDING_A_SPORT.md`; update `wiki.md` and the docs.
18. Full backend + frontend test, lint and typecheck. Fix any failures, then write a summary of
    what changed, what was disabled, and open questions.

Applying migrations 1-4 to the **production** `project_x` database is a separate step that I'll
ask for explicitly.

---

## 7. Open questions

| # | Question | My default if you don't mind |
| --- | --- | --- |
| Q1 | Approve moving schema ownership to Prisma migrations (section 2.1), and may I create a Neon `dev` branch, or will you? | You create the branch and send me its URL; I never touch `project_x` until told |
| Q2 | Approve the FK re-points (A) `usr_user_sport → sports` and (B) `social_post.match_id → matches` | Yes, both (no data changes) |
| Q3 | Public pages: server-rendered HTML from the API (recommended), or add Expo web (react-native-web) and host a web build? | Server-rendered HTML |
| Q4 | Ratings when a guest is involved: (a) unrated if any participant is a guest (recommended, simple and fair); (b) guests get hidden provisional ratings that update too | (a) |
| Q5 | Rating effect of tournament matches | Same as friendlies (K = 32) |
| Q6 | Pickleball: which default for friendlies, side-out (traditional) or rally? Both rulesets will exist. | Side-out default, rally as a second ruleset |
| Q7 | Who can create tournaments? | Any signed-in user |
| Q8 | The 3 unfinished legacy test matches: leave them frozen (default), or drop the legacy match tables at the end of the pivot (needs explicit approval) | Leave frozen |
| Q9 | Should the old corporate concepts in `scoring-and-tournaments.md` (organizations, departments, medal tables) stay in the roadmap? They aren't in this MVP. | Keep the doc, mark it "post-MVP" |
