# PROJECT_X Wiki

Running notes for developers and AI assistants working on PROJECT_X. Every change that affects
architecture, APIs, database schema, environment variables or dependencies gets an entry in the
**Changelog** below (newest first). Keep entries short: what changed, why, and where.

## Project overview

PROJECT_X is a sports social + sports ecosystem mobile application, built module by module.

| Layer    | Stack                                        | Location    |
| -------- | -------------------------------------------- | ----------- |
| Mobile   | React Native (iOS + Android), TypeScript     | `frontend/` |
| API      | Node.js, TypeScript, REST (`/api/v1/...`)    | `backend/`  |
| Database | PostgreSQL (only database; no MongoDB)       | —           |
| Docs     | Supporting documentation, design references  | `docs/`     |

### Module roadmap

1. **Authentication** — done (see below)
2. **Profile** (Module 1) and **friendly-match scoring for all six sports** (Module 2) — done; basic
   **feed and history** (Module 3) — done. See "App navigation" and "Match module".
3. **Posts, likes, comments** — done (text only). **Chat** (1:1 and groups, polling) — built,
   waiting for the owner to apply the messaging tables (`docs/sql/2026-09-29_messaging_and_indexes.sql`).
   **Redis** — live match state, session cache, chat polling (see "Performance and Redis").
4. **Product focus:** fast real-time scoring (six sports) and **tournaments** (corporate
   inter-department / inter-company events). Design: `docs/scoring-and-tournaments.md`
   (designed, not built; schema changes await the owner).
5. Social Graph / Follow, Media, Notifications, Realtime, Teams, Events, Venues, Bookings,
   Communities, Search, Analytics — not started (`docs/database-design.md`)

### Ground rules

- UI screenshots and supplied PostgreSQL schemas are the source of truth.
- No secrets in Git (`.env*` is ignored; only `.env.example` is committed).
- Do not restructure the repo or implement future modules ahead of time.
- The database schema is owned by the project owner (Neon database `project_x`). Code uses it as
  is; the backend never creates or alters tables. Schema changes are made by the owner.

## How to run (local development)

### Backend (`backend/`)
```bash
cd backend
npm install
cp .env.example .env        # then fill in values (see "Environment variables")
npm run seed                # inserts missing reference data (the 6 sports in mst_sport); safe to re-run
npm run dev                 # http://localhost:4000, health check at GET /health
npm test                    # Vitest + Supertest integration tests against the real DB (isolated schema)
npm run typecheck && npm run build
```

### Mobile app (`frontend/`), Android emulator
Prerequisites: Android Studio + SDK (`~/Android/Sdk`), an emulator (AVD) created and running,
and **JDK 17**. Do **not** build with Android Studio's bundled JBR (Java 25): the Android Gradle
plugin's CMake/prefab step treats Java 25's "restricted method" warning as an error, and the
`configureCMakeDebug` tasks fail. JDK 17 (Temurin) is installed at `~/.jdks/jdk-17.0.20.1+1`.
Suggested `~/.bashrc`:
```bash
export JAVA_HOME=$HOME/.jdks/jdk-17.0.20.1+1
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
```
In Android Studio, set Settings → Build Tools → Gradle → Gradle JDK to the same JDK 17.
```bash
cd frontend
npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 for the Android emulator
npm run android             # = expo run:android: builds the dev client, installs it, starts Metro
# next time, if native deps are unchanged: npx expo start --dev-client, then press "a"
npm test                    # Jest (jest-expo) + React Native Testing Library
npm run typecheck && npm run lint
```
The app normally runs as a development build. **Expo Go** also works for quick testing on a phone
(`npx expo start`, scan the QR code, `EXPO_PUBLIC_API_URL` = the PC's LAN IP), except Google
Sign-In, which is a native module Expo Go lacks: `social/google.ts` loads it lazily and shows a
"not available" message instead of crashing. `android/` and `ios/` are generated (git-ignored); configure native behaviour
in `app.config.ts`, never by hand-editing those folders.

## Architecture conventions

### Backend
- `src/app.ts` builds the Express app from injected dependencies (pool, SMS provider, social
  verifiers). Tests use the same factory, with providers swapped for dev/test ones. `src/server.ts` wires up the real ones.
- `src/modules/<module>/`: `*.routes.ts` (paths, middleware order) → `*.controller.ts` (thin
  HTTP adapter) → `*.service.ts` (business rules, transactions) → `*.repository.ts` (SQL only).
  Validation schemas live in `*.validation.ts` (Zod) and run in the `validateBody` middleware.
- Repositories take a `Queryable` (pool or transaction client); services decide transaction scope
  with `withTransaction` (`src/database/pool.ts`).
- Response envelope: success `{ "success": true, "data": ... }`; failure
  `{ "success": false, "error": { "code", "message", "details"? } }`. Throw `AppError` for expected
  errors; anything else becomes a logged 500 `INTERNAL_ERROR` with no stack trace to the client.
- Database: the owner's `project_x` schema, used as is (no migrations in this repo).
  `src/database/pool.ts` raises Node's IPv4/IPv6 connect attempt timeout to 2 s, because the
  250 ms default made every connection to Neon (us-west-2) fail with ETIMEDOUT on slow links.
- Logging: pino. Request logs contain only method, path and status. Passwords, codes and tokens
  are redacted paths and must never be logged.

### Frontend
- Expo SDK 57 + Expo Router. Route files in `src/app/` are one-line re-exports; screens,
  components and logic live in `src/features/<feature>/` and `src/shared/`.
- `src/shared/api/client.ts` is the only place that calls `fetch`. It normalizes errors to
  `ApiError { status, code, message, details }` (`status 0` = network error), attaches tokens, and
  refreshes once on `ACCESS_TOKEN_EXPIRED`.
- Feature API modules (e.g. `features/auth/api/auth.api.ts`) map 1:1 to backend endpoints.
- Global state: Zustand stores per feature (`features/auth/store/auth.store.ts`). Screens call
  store actions through `useSubmit` (`shared/hooks/useSubmit.ts`) for loading and error state.
- Theme: `shared/theme` (palettes, spacing, radius, typography). Components read colours via
  `useTheme()`; never hard-code colours in screens. Light / Dark / System is chosen in Settings
  (`theme.store.ts`). Both themes follow Strava (`pics/image.png`, `pics/image copy*.png`): flat
  `#FC5200` orange, no glow; dark = `#141414` cards and app bars on a black canvas, light = white
  cards on `#F0F0F5`. Sport accents (`sportColor`), avatar/team tones (`toneFor`) and the welcome
  screen's orange hero art are the only fixed colours.
- Config: `shared/config/env.ts` reads `EXPO_PUBLIC_*`. Those values are bundled into the app, so
  never put secrets there.

## App navigation (Home, Sports, +, Matches, Profile)

Signed-in navigation: `app/(app)/(tabs)/` has a custom Strava-style bottom bar
(`shared/components/TabBar.tsx`): five flat tabs (Home, Sports, Play, Matches, You); the selected
one has a filled orange icon. `app/(app)/edit-profile.tsx`,
`app/(app)/settings.tsx` and `app/(app)/match/[id].tsx` open on top of it. Tab screens use
`AppHeader` (logo + actions) or `TopBar` (title, back arrow) passed as `Screen`'s `header`.
Profile data lives in `features/profile/store/profile.store.ts` (cleared on sign-out by the root layout).

| Route | Screen | Shows |
| --- | --- | --- |
| `/` (Home tab) | FeedScreen | Strava-style: "Home" app bar (Messages with unread badge), "Your streak" card (weeks in a row with a match, from `/profile/me/matches`; Play now), "Live now" strip (mine + people I follow, active in the last 3 h), then activity cards (mine + accepted follows, "Load more"): author, "Today at 6:34 AM · Doubles", title "Morning Pickleball", stats row (Score/Runs, Time, Games/Sets/Halves/Innings), likes/comments line, Like / Comment / Share. Floating orange + = new post. Empty and error states from the designs. |
| `/sports` (Sports tab) | SportsScreen | "Discover": my sports as tiles (rating, W/L, primary dot), live matches carousel, 3 recent matches. |
| `/play` (Play tab) | PlayScreen | "New match": my live matches (resume), sport grid (6), format, both sides' players (search; I am always on side 1), team names (team sports), rules, Start match. |
| `/matches` (Matches tab) | MatchesScreen | Sport filter chips, live matches, my match history. |
| `/profile` (You tab) | ProfileScreen | "You" app bar. Ringed avatar, matches/followers/following, name, bio, tags (primary sport, rating, win %), Edit profile / Settings, Stats tab (per-sport or overall stat grid) and Matches tab. |
| `/settings` | SettingsScreen | Account card, Edit profile, email, phone, favourite sports, Log out, app version. |
| `/edit-profile` | EditProfileScreen | Name, bio (≤ 500), sports played (tap to add/remove, star = primary). |
| `/match/[id]` | MatchScreen | LIVE/FT badge + sport in the app bar; hero scoreboard (team badges, big scores, period pill, chase callout, this over); for the creator: scoring buttons, Undo, Abandon, "Save result"; for others: live view (polls every 4 s); final result with rating changes. |
| `/create-post` | CreatePostScreen | "New post" (Home's floating +): text ≤ 2000, Public / Followers, Share. "Log match" chip opens Play. |
| `/post/[id]` | PostDetailScreen | The post (like button), comments (oldest first, "Load more"), comment box. Long-press a comment to delete it (yours, or any on your post); trash icon deletes your own written post. |
| `/messages` | ConversationsScreen | Home header ✈ (orange unread badge). Conversations, most recent first, last message, unread count; refreshes every 10 s while open. |
| `/messages/new` | NewConversationScreen | Search players; one = direct chat (reused if it exists), several + a name = group. |
| `/messages/[id]` | ChatScreen | Messages (newest at the bottom, day separators, sender names in groups, orange bubbles for mine), composer, polls every 3 s while open, older pages on scroll. Long-press your message to delete it; groups have Leave. |

Not built yet (decided 2026-09-29): **city** (no city table in the schema) and **profile photo**
(no file storage chosen; an initials avatar is shown instead). Posts have no photos yet for the same reason.

### Posts API (`/api/v1/posts`, bearer token)
| Method & path | Body / query | Success | Errors |
| --- | --- | --- | --- |
| POST `/` | `content` (1–2000, trimmed), `visibility` (`public` default / `followers`) | 201 `{post}` | 400 VALIDATION_ERROR |
| GET `/:id` | – | 200 `{post}` | 404 POST_NOT_FOUND (also when not visible to me) |
| DELETE `/:id` | – | 200 `{deleted: true}` (own written posts; match-result posts can't be deleted) | 404 |
| PUT / DELETE `/:id/like` | – | 200 `{likeCount, likedByMe}` (idempotent) | 404 |
| GET `/:id/comments` | `?limit=1..100` (50), `?cursor=<nextCursor>` | 200 `{comments: [{id, content, createdAt, author}], nextCursor}` oldest first | 404 |
| POST `/:id/comments` | `content` (1–1000) | 201 `{comment}` | 400, 404 |
| DELETE `/:id/comments/:commentId` | – | 200 `{deleted: true}` (comment's or post's author) | 404 COMMENT_NOT_FOUND |

`post` = feed post + `visibility`. Visible to me = mine, or public (NULL visibility counts as public),
or followers-only and I follow the author (accepted); never across a block; author active. Written
posts use `social_post.post_type_id` 802; visibility 1201 Public / 1202 Followers (seeded).
`social_post.match_id` is UNIQUE and every finished match already has its result post, so written
posts can't tag a match without a schema change.

### Messages API (`/api/v1/conversations`, bearer token) — needs the messaging tables
| Method & path | Body / query | Success | Errors |
| --- | --- | --- | --- |
| GET `/` | – | 200 `{conversations}` (50 most recent) | – |
| GET `/unread` | – | 200 `{count}` (all conversations) | – |
| POST `/` | `userIds[]` (1–49), `title?` (required for 2+ players) | 201 `{conversation}`; one player = the pair's direct conversation (found or created) | 400 (self, blocked or inactive players) |
| GET `/:id` | – | 200 `{conversation}` | 404 CONVERSATION_NOT_FOUND (also when not a member) |
| POST `/:id/members` | `userIds[]` | 200 `{conversation}` (group admins; people who left rejoin) | 400 NOT_A_GROUP, 403 NOT_GROUP_ADMIN |
| POST `/:id/leave` | – | 200 (groups; the oldest member becomes admin if no admin is left) | 400 NOT_A_GROUP |
| GET `/:id/messages` | `?limit=1..100` (30), `?before=<id>` older page or `?after=<id>` newer (polling) | 200 `{messages}` in time order | 404 |
| POST `/:id/messages` | `content` (1–4000) | 201 `{message}`; also marks the conversation read for the sender | 403 CANNOT_MESSAGE (direct, blocked) |
| DELETE `/:id/messages/:messageId` | – | 200 (own; soft delete, shows "Message deleted") | 404 MESSAGE_NOT_FOUND |
| POST `/:id/read` | – | 200 (unread = others' messages after `last_read_at`, else after joining) | 404 |

`conversation` = `{id, type: direct|group, title, members: [{id, username, fullName}], isAdmin,
lastMessage, unreadCount, updatedAt}`; `message` = `{id, conversationId, sender, content (null when
deleted), createdAt, deleted}`. Polling cost: the cache holds each conversation's member ids (10 min,
cleared on add/leave) and newest message id (set on send, cleared on delete), so `?after=<newest>`
("anything new?") is answered from Redis without touching Postgres.

### Profile, sports & feed API (all require `Authorization: Bearer`)
| Method & path | Body / query | Success |
| --- | --- | --- |
| GET `/api/v1/sports` | – | 200 `{sports: [{id, code, name}]}` |
| GET `/api/v1/profile/me` | – | 200 `{profile}` |
| PATCH `/api/v1/profile/me` | `fullName?`, `bio?` (`""` clears) | 200 `{profile}` |
| PUT `/api/v1/profile/me/sports` | `sportIds[]` (≤ 6, unique), `primarySportId` (one of them; null only when empty) | 200 `{profile}`; 400 VALIDATION_ERROR (unknown sport, bad primary) |
| GET `/api/v1/profile/me/matches` | `?limit=1..50` (20) | 200 `{matches: [{matchId, sport, playedAt, outcome, otherPlayers, result}]}` |
| GET `/api/v1/feed` | `?limit=1..50` (20), `?cursor=<nextCursor>` | 200 `{posts: [...], nextCursor}` |
| GET `/api/v1/players` | `?q=` (2–50 chars), `?limit=1..20` (10) | 200 `{players: [{id, username, fullName}]}`: active users whose username starts with / name contains `q`; never me or blocked users; no contact details |

Feed and post responses: `match` = `{id, sport, format, durationSeconds, result: {summary,
winnerSide, sides: [{no, name, headline}], periodCount} | null}` (from `match_master`,
`mst_sport_format` and `match_result`); the app builds the activity title and stats row from it.

`profile` = `{ user, bio, sports: [{id, code, name, isPrimary, rating, matchesPlayed, matchesWon,
matchesLost, pointsScored, pointsConceded}], record: {played, won, lost}, followers, following }`.
Sport ids are strings (`mst_sport.id` is bigint). `outcome` ∈ won / lost / draw / in_progress.

Data: name/bio → `usr_user_profile`; sports → `usr_user_sport` (+ `usr_sport_rating` at 1000 and
`usr_sport_stats` at 0 created for new sports; kept when a sport is removed, as history); record =
sum of `usr_sport_stats`; history = `match_participant` ⋈ `match_master` ⋈ `match_result`; feed =
`social_post` by me or accepted follows, excluding blocks in either direction, keyset-paginated on
(`created_at`, `id`). Stats, ratings, matches and posts are written when a match result is saved (see "Match module").

Timestamps: many tables use `timestamp` without time zone (UTC values). `database/pool.ts` makes
pg read them as UTC; the Neon session time zone is GMT.

## Performance and Redis

**Why it was slow (measured 2026-09-29):** the API runs in India and Neon is in us-west-2 (Oregon):
~350 ms per query round trip. A scoring tap ran ~15 sequential queries (≈ 5 s), `GET /profile/me`
took ~3 s. Decided: move Neon to Singapore (ap-southeast-1, ~70 ms) and add Redis (Upstash, Mumbai).

**Redis (`REDIS_URL`, optional).** Without it everything still works, with in-memory stand-ins
(single server only) and scoring waits for Postgres.
- **Live matches** (`modules/match/live/`): each live match's state (rules, sides, events,
  version, period start times) is kept under `live:match:<id>` / `live:version:<id>` (24 h). A
  scoring tap or undo = read state + one atomic Lua commit that checks the version, stores the new
  state and appends a job to `live:queue:<id>` (match id added to `live:pending`); the response is
  sent immediately. `LivePersister` then writes the jobs to Postgres in order, one transaction each,
  removing a job only after commit; jobs are idempotent (by `sequence_no`), failed writes retry
  every 3 s, and queues left from a crash are resumed at startup. Before finish / abandon, and
  before reloading a match from Postgres, the queue is flushed first. Match GETs, spectator polls
  and the live list's scores come from Redis. Ended matches are dropped from Redis.
- **Sessions** (`modules/auth/session-cache.ts`): the per-request "is this session active?" lookup
  is cached 60 s; sign-out, refresh-token reuse and password reset clear it immediately (a
  suspension takes effect within 60 s).
- **Chat polling**: see "Messages API".

## Match module (Module 2: friendly-match scoring)

### How scoring works
- **Server is the source of truth.** Each tap is one request and one `match_score_event` row. The
  scoreboard is always rebuilt by replaying the match's events (not undone) through the sport's
  engine, so undo is trivially correct. Matches have at most a few hundred events.
- **Engines** (`backend/src/modules/match/scoring/`, pure functions, unit-tested):
  - `rally.ts` — pickleball, badminton, table tennis, volleyball: first to N (win by 2, optional cap),
    best of K games/sets, optional different target for the deciding set. The scorer taps the side
    that won the point (with side-out pickleball scoring, tap only when a point counts; serve is not tracked).
  - `timed-goals.ts` — football: goals per half; the scorer ends each half (the app shows a clock
    from the half's start). Draws allowed.
  - `overs.ts` — box cricket: two innings of N overs; wides/no-balls add runs and don't count as
    legal balls; an innings ends on overs, wickets, the target being passed, or "End innings". Equal runs = tie.
- Default rules (`scoring/sport-rules.ts`, seeded into `mst_sport_scoring`; read from there at runtime):

| Sport | Format(s) (players per side) | Default rules | Options when starting |
| --- | --- | --- | --- |
| Pickleball | Singles 1, Doubles 2 | games to 11, win by 2, best of 3 | best of 1/3/5, points |
| Badminton | Singles 1, Doubles 2 | games to 21, win by 2, cap 30, best of 3 | best of, points (cap moves with it) |
| Table tennis | Singles 1, Doubles 2 | games to 11, win by 2, best of 5 | best of, points |
| Volleyball | Team 1–6 | sets to 25, win by 2, best of 5, 5th set to 15 | best of, points |
| Football | Team 1–11 | 2 × 20 min halves | minutes per half |
| Box cricket | Team 1–11 | 6 overs, 5 wickets, wide/no-ball +1 | overs, wickets, batting first |

  Team sports need only one registered player (e.g. the captain) per side, because
  `match_participant.user_id` is required (guests are not possible in this schema).
- **Who scores:** only the match creator (`canScore`). Every change bumps `version`
  (events + undos); scoring requests send the version they saw and a stale one gets 409
  STALE_MATCH, so a retry or a double tap never counts twice. The match row is locked
  (`SELECT … FOR UPDATE`) for each change.
- **Finishing:** when the engine says the match is decided, the scorer sees "Save result" (Undo is
  still possible until then). Saving is one transaction: `match_master` completed, `match_result`,
  then for every player `match_stat_snapshot`, `usr_sport_stat_history`, `usr_sport_stats`
  (+played/won/lost/points), `usr_sport_rating` (Elo, K = 32, a side's rating = its players'
  average, every player on a side gets the same change; ratings locked while updated) and the sport
  is added to `usr_user_sport` if missing; finally one automatic `social_post`
  ("Aarav beat Rohan 11-7, 11-9 · Pickleball"). **Abandon** marks the match abandoned; nothing is
  saved to stats and it disappears from history.

### Match API (`/api/v1/matches`, all require `Authorization: Bearer`)
| Method & path | Body | Success | Notable errors |
| --- | --- | --- | --- |
| GET `/setup` | – | 200 `{sports: [{sport, kind, formats: [{id, name, minPlayers, maxPlayers}], defaults}]}` | – |
| GET `/live` | – | 200 `{matches: [MatchCard]}` (mine + followed players' live matches, 20 max) | – |
| POST `/` | `sportId`, `formatId`, `sides: [{name?, playerIds[]}, {…}]`, `options?` (`bestOf`, `pointsToWin`, `periodMinutes`, `overs`, `wickets`, `battingFirst`) | 201 `{match}` | 400 VALIDATION_ERROR (players per side, unknown/inactive player, duplicate player) |
| GET `/:id` | – | 200 `{match}` | 404 MATCH_NOT_FOUND |
| POST `/:id/events` | `{type: point\|goal, side}`, `{type: period_end\|innings_end}` or `{type: ball, runs 0–6, extra: none\|wide\|no_ball, wicket}`, plus `version` | 200 `{match}` | 403 NOT_MATCH_SCORER, 409 STALE_MATCH / MATCH_OVER / MATCH_NOT_LIVE, 400 INVALID_EVENT |
| POST `/:id/undo` | `version` | 200 `{match}` | 400 NOTHING_TO_UNDO, 409 as above |
| POST `/:id/finish` | `version` | 200 `{match}` (with `ratingChanges`) | 409 MATCH_NOT_FINISHED |
| POST `/:id/abandon` | – | 200 `{match}` | 403, 409 MATCH_NOT_LIVE |

`match` = `{ id, sport, format, status (live|completed|abandoned), createdBy, canScore, config,
sides: [{no, teamId, name, players: [{participantId, userId, username, fullName}]}], score, version,
startedAt, completedAt, currentPeriodStartedAt, ratingChanges: [{userId, before, after}] }`.
`score` = `{ kind, finished, winner (1|2|null), currentPeriod, periods: [{no, label, score, winner,
finished}], headline (games won / goals / runs), totals, summary, cricket: {battingSide, innings,
target, thisOver} | null, allowedEvents }`. Any signed-in user can view a match.

### Where the data goes
- `match_master` (sport, format, scoring row, created_by, type friendly, status), `match_team`
  (always two sides, `team_name`), `match_participant` + `match_team_member` (every player).
- `match_score_state`: one match-level row (no team/period/participant) whose `state_data` holds
  `config` (the rules this match uses, i.e. defaults + options; the schema has no column for
  per-match rules) and `snapshot` (latest scoreboard, used by live lists); one row per side with
  `score_value` = headline number.
- `match_score_event`: `team_id` = scoring side (batting side for balls), `period_id`,
  `score_value` = points/goals/runs added, `event_data` = `{runs, extra, wicket}` for balls.
  Undo sets `is_undone` and adds a `match_correction` row (type Undo).
- `match_period`: one row per game/set/half/innings reached (live/completed); periods taken back by
  an undo are marked void and reused if play reaches them again.
- `match_result.result_data` = `{summary, winnerSide, sides: [{no, name, headline}], periods}`;
  `winner_team_id` always, `winner_participant_id` for singles; NULLs = draw.
- Stat JSON (`match_stat_snapshot.stat_data`, `usr_sport_stat_history.stat_data`) =
  `{side, result, pointsFor, pointsAgainst, periodsWon?, periodsLost?, summary, ratingBefore, ratingAfter}`.
  `match_stat_snapshot_detail` is not written (its `stat_type_id` has no defined meaning yet).

### Lookup codes (`type_master`)
`type_master.type_id` is used as the **category** and `id` as the value, with fixed ids
(category × 100 + n) defined in `backend/src/modules/match/match.codes.ts` and inserted by
`npm run seed` (which refuses to run if one of those ids already has another category, and moves
the id sequence past them).

| Category (`type_id`) | Values (`id`) |
| --- | --- |
| 1 format | 101 singles, 102 doubles, 103 team |
| 2 scoring | 201 point-based, 202 set/rally-based, 203 time + goal, 204 over-based |
| 3 period | 301 game, 302 set, 303 half, 304 innings |
| 4 score event | 401 point, 402 goal, 403 period end, 404 ball, 405 innings end |
| 5 stat data type | 501 integer |
| 6 match status | 601 scheduled (unused), 602 live, 603 completed, 604 abandoned |
| 7 match type | 701 friendly |
| 8 post type | 801 match result |
| 9 correction | 901 undo |
| 10 period status | 1001 live, 1002 completed, 1003 void |
| 11 result | 1101 win, 1102 draw |

The auth/follow codes (`usr_user.status`, `auth_*`, `usr_user_follow.status_id`) predate this and
are still defined only in code (see "Status codes").

### Known gaps / follow-ups (match)
- No guest players (schema: `match_participant.user_id` NOT NULL); team sports use captains only.
- Per-match rules live in `match_score_state.state_data.config`; a `match_master.scoring_config`
  column would be cleaner.
- Spectators poll every 4 s; move to websockets with the Realtime module.
- No player-level stats inside team sports (e.g. goal scorers, batting/bowling figures).
- Pickleball serve/side-out and cricket strike rotation are not tracked.
- No indexes yet on `match_participant(user_id)`, `match_score_event(match_id)`,
  `social_post(user_id, created_at)` (see docs/mvp-data-flow.md gap 6).

## Auth module

### Screens and flows
Design reference: Strava's onboarding, Create an Account and Log In screens (`pics/image copy 2.png`,
`image copy 3.png`, `image copy 4.png`): plain back arrow, big left-aligned title, outlined fields
without icons, a flat orange button that stays dimmed until the fields are filled, "or", outlined
"Continue with …" pills. Unlike Strava (email first), sign-in keeps username / email / phone +
password on one screen. Shared shell: `features/auth/components/AuthScreenLayout.tsx`.

| Route | Screen | Flow |
| --- | --- | --- |
| `/welcome` | WelcomeScreen | First signed-out screen. Swipeable slides (orange hero, "PROJECTX" wordmark, a phone-card mock of live scoring / feed / ratings / chat in `WelcomeArt.tsx`, one-line pitch, page dots), "Join for free" → `/sign-up`, "Log In" → `/sign-in` |
| `/sign-in` | SignInScreen | "Log In to ProjectX": username, email or phone + password → `POST /login`. Links: Forgot password, Create an account; Continue with Google / phone / Apple (iOS only) |
| `/sign-up` | SignUpScreen | "Create an Account": name, username, email, phone, password, confirm → `POST /register/start` (SMS code) → `/verify?flow=signup`. No Google button: Google/Apple can't create accounts (see Security model) |
| `/phone` | PhoneSignInScreen | Phone → `POST /phone/start` → `/verify?flow=phone` |
| `/verify` | VerifyCodeScreen | 6-digit code (auto-submit, SMS autofill, 30 s resend cooldown) → `POST /register/complete` or `POST /phone/verify` |
| `/forgot-password` | ForgotPasswordScreen | Username, email or phone → `POST /password/forgot` (code to the account's phone) → `/reset-password` |
| `/reset-password` | ResetPasswordScreen | Code + new password → `POST /password/reset` → back to sign-in with a success notice |

Navigation is state-driven: the root layout uses `Stack.Protected` on `auth.store.status`, so
signing in or out switches stacks automatically, with no imperative redirects. The splash screen
stays up while `bootstrap()` restores the session.

### Auth API (`/api/v1/auth`)
All bodies are JSON. Phones must be E.164 (`+919876543210`); the app normalizes user input
using `EXPO_PUBLIC_DEFAULT_COUNTRY_CODE`; the backend splits them into calling code + national
number (libphonenumber-js). `identifier` = email (contains `@`), phone (only digits, `+`,
separators) or username (anything else). Usernames: 3–30 of `A-Z a-z 0-9 _ .`, at least one
letter, unique case-insensitively.
Passwords: 8–128 characters, at least one letter and one digit. Codes: 6 digits.

| Method & path | Body | Auth | Success | Notable errors |
| --- | --- | --- | --- | --- |
| POST `/register/start` | username, fullName, email, phone, password | – | 200 `{message}`; SMS sent | 400 VALIDATION_ERROR, 409 USERNAME_TAKEN / EMAIL_TAKEN / PHONE_TAKEN, 429 |
| POST `/register/complete` | same + code | – | 201 `{user, tokens}` | 400 INVALID_CODE, 409 |
| POST `/login` | identifier, password | – | 200 `{user, tokens}` | 401 INVALID_CREDENTIALS, 403 ACCOUNT_DISABLED, 429 |
| POST `/phone/start` | phone | – | 200 generic `{message}` (sent only if registered) | 429 |
| POST `/phone/verify` | phone, code | – | 200 `{user, tokens}` | 400 INVALID_CODE, 429 OTP_ATTEMPTS_EXCEEDED (5 wrong codes) |
| POST `/password/forgot` | identifier | – | 200 generic `{message}` (code sent to the account's phone) | 429 |
| POST `/password/reset` | identifier, code, newPassword | – | 200 `{message}`; **all sessions revoked** | 400 INVALID_CODE |
| POST `/google` | idToken | – | 200 `{user, tokens}` (existing accounts only, matched by verified email) | 401 INVALID_SOCIAL_TOKEN, 400 EMAIL_NOT_VERIFIED, 404 ACCOUNT_NOT_FOUND, 503 PROVIDER_NOT_CONFIGURED |
| POST `/apple` | identityToken, fullName? (ignored) | – | 200 `{user, tokens}` | same as Google |
| POST `/refresh` | refreshToken | – | 200 `{user, tokens}` (token rotated) | 401 INVALID_REFRESH_TOKEN |
| POST `/logout` | refreshToken | – | 204 (idempotent) | – |
| GET `/me` | – | Bearer | 200 `{user}` | 401 AUTH_REQUIRED / INVALID_ACCESS_TOKEN / ACCESS_TOKEN_EXPIRED / SESSION_REVOKED |

`user` = `{ id, username, fullName, email, phone, emailVerified, phoneVerified, createdAt }`
(`fullName` = `usr_user_profile.display_name`; `phone` is E.164).
`tokens` = `{ accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt }`.

### Database (owner's schema, Neon database `project_x`)
Tables the auth module uses:
- `usr_user`: `username` (unique on `lower(username)`), `phone_country_code` + `phone_number`
  (unique pair), `email` (unique, stored lowercase), `password_hash` (argon2id), `status`,
  `is_phone_verified` (set at sign-up / OTP login), `is_email_verified` (set by Google/Apple),
  `last_login_at`.
- `usr_user_profile`: one row per user, created at sign-up; `display_name` = full name.
- `auth_session`: one row per signed-in device. `refresh_token_hash` = hex SHA-256 of the
  secret; `expires_at`, `last_used_at`, `revoked_at`, `user_agent`, `ip_address`.
- `auth_otp`: SMS codes. `otp_hash` = HMAC-SHA256 (keyed by `JWT_ACCESS_SECRET`) of
  purpose + phone + code; valid 10 min; sending a new code expires older ones for the same phone
  and purpose; each check increments `attempt_count`, and at `max_attempts` (5) the code is locked.
- `auth_login_log`: every login attempt (success and failure, with `failure_reason`) and logout.
- `auth_password_history`: a row for every password set (sign-up, reset).

Not used yet: `auth_device` (the app sends no device identifier yet), `auth_password_reset`
(reset uses an SMS code in `auth_otp`), `auth_account_verification` (no email verification yet),
`usr_role` / `usr_user_role`.

### Status codes
`type_master` has no rows yet, so the auth module defines these values in
`backend/src/modules/auth/auth.types.ts`. If `type_master` gets seeded with different values,
update that file to match.

| Column | Values |
| --- | --- |
| `usr_user.status` | 1 active, 2 suspended, 3 deleted |
| `auth_otp.purpose` | 1 registration, 2 phone login, 3 password reset |
| `auth_login_log.login_method` | 1 password, 2 OTP, 3 Google, 4 Apple |
| `auth_login_log.action` | 1 login, 2 logout |
| `auth_login_log.status` | 1 success, 2 failed |
| `usr_user_follow.status_id` (in `profile.types.ts`) | 1 accepted, 2 pending |

### Security model
- Access token: HS256 JWT (`sub` = user id, `sid` = session id), 15 min by default. Every
  authenticated request also checks that the session is live and the user is active: one
  primary-key lookup, which makes logout and suspension take effect immediately.
- Refresh token: `<session id>.<256-bit random secret>`, rotated on every refresh, sliding
  30-day expiry. Presenting an already-rotated secret revokes the session (theft detection). The
  app therefore runs refreshes single-flight.
- The app keeps tokens only in `expo-secure-store` (Keychain / Keystore,
  `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`), never in AsyncStorage, and keeps them out of React state.
- No account enumeration: login returns a single INVALID_CREDENTIALS error, and unknown accounts
  run a dummy argon2 verify to equalize timing. `phone/start` and `password/forgot` always answer
  generically. Sign-up does reveal duplicates (409), which is inherent to sign-up and rate-limited.
- Rate limits (in-memory, per process): 300 requests / 15 min per IP on all auth routes;
  sending codes: 20/h per IP and 5/h per phone or identifier; checking codes: 10 / 15 min per
  target; login: 10 / 15 min per identifier. Each code also allows at most 5 checks (`auth_otp.max_attempts`).
- Social sign-in only signs in an **existing** account whose email the provider asserts as
  verified. The schema has no provider-identity table, and `usr_user` requires a username, phone
  and password, so Google/Apple cannot create accounts.

### Environment variables
Backend (`backend/.env`, template `backend/.env.example`): `NODE_ENV`, `PORT`, `LOG_LEVEL`,
`TRUST_PROXY`, `CORS_ORIGINS`, `DATABASE_URL` (Neon pooled), `DATABASE_URL_DIRECT` (Neon direct:
tests), `DB_POOL_MAX`, `JWT_ACCESS_SECRET` (≥ 32 chars), `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_DAYS`, `SMS_PROVIDER` (`twilio` | `dev`), `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `DEV_OTP_CODE`, `GOOGLE_CLIENT_IDS`,
`APPLE_BUNDLE_IDS`. Validated at start-up by `src/config/env.ts`; the server refuses to start if
any is invalid. `SMS_PROVIDER=dev` (every code is `DEV_OTP_CODE`, sends nothing) is rejected in production.

Frontend (`frontend/.env`, template `frontend/.env.example`): `EXPO_PUBLIC_API_URL`,
`EXPO_PUBLIC_DEFAULT_COUNTRY_CODE`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and the build-time-only `GOOGLE_IOS_URL_SCHEME`.

### Setting up external providers
- **Twilio (SMS):** buy or use a Twilio phone number, then set `SMS_PROVIDER=twilio`,
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` (that number, E.164). The
  backend generates the codes; Twilio only delivers the text. Trial accounts can only text verified numbers.
- **Google:** in Google Cloud, create OAuth clients for Web, Android (package `com.projectx.app` +
  the debug keystore SHA-1 from `cd android && ./gradlew signingReport` after the first build) and
  iOS. Put the **Web** client ID in the backend's `GOOGLE_CLIENT_IDS` and the app's
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- **Apple (iOS only):** enable "Sign in with Apple" for bundle id `com.projectx.app` and set
  `APPLE_BUNDLE_IDS=com.projectx.app`. Needs a Mac/EAS build and a paid Apple developer account.

### Known gaps / follow-ups
- Rate limiting is in-memory: move it to Redis before running more than one API instance.
- No cleanup job for expired/revoked `auth_session` and `auth_otp` rows yet (belongs with the
  Redis/background-jobs module). Neither table has an index on `user_id` / phone yet; worth
  adding as the user count grows.
- Email is collected but never verified (no email provider yet). `emailVerified` stays false
  unless Google/Apple verified it.
- Google/Apple sign-in only works for accounts that already exist with the same email.
- Backend API tests (`src/modules/auth/__tests__/`) still target the old schema and do not run:
  the test harness must be rewritten to build an isolated copy of the `project_x` tables.
- Font: the design screenshot appears to be rendered in Ubuntu. The app uses the platform
  system font until a brand font is chosen.
- Only the dark Sign in screen was supplied. The light palette and the other five screens were
  derived from it and should be checked against real designs when they exist.

## Changelog

### 2026-10-06 — Scoring & tournaments design
- New `docs/scoring-and-tournaments.md`: real-time scoring targets and architecture (WebSockets +
  Redis pub/sub, shared engine for optimistic scoring, offline queue, assigned scorers), scoring
  changes for tournaments (goal scorers, cards, penalties, cricket striker/bowler, super over,
  guest players), the tournament model (organizations, departments, categories, entries, stages,
  groups, fixtures → `match_master`), per-sport rules / points / tiebreakers, all leaderboards,
  tables, APIs, a three-phase build plan and the decisions needed from the owner.
  `docs/database-design.md` Module 14 now points to it. Documentation only.

### 2026-10-05 — Strava-style UI
- Frontend: both themes moved to Strava's look (`#FC5200`, flat, no glow; dark = `#141414` cards on
  black). New `/welcome` screen is the first signed-out route (`(auth)/_layout.tsx`
  `initialRouteName`). Log In / Create an Account restyled after Strava, keeping username + password.
  `AuthScreenLayout` rewritten (back arrow by default; `BrandHeader` removed). Flat five-tab
  bar (Home, Sports, Play, Matches, You) replaces the raised +. Home: title app bar, streak card
  (`feed/streak.ts`), "Live now" strip, Strava-style activity cards (`PostCard`), floating + for a new post.
- Shared components: `TextField` icon optional; `OutlineButton` takes an `icon`; `PrimaryButton`
  has no chevron by default; `BackButton` is a plain arrow (fallback `/welcome`); `AppHeader` takes
  a `title`; `Screen` takes a `background`; `OrDivider` says "or". Android `elevation` removed from
  glow-styled buttons.
- Backend: feed/post `match` gains `format`, `durationSeconds` and `result` (joins
  `mst_sport_format`, `match_result`); no schema change.
- Tests: frontend 64 (new: welcome, sign-up, streak, activity time/duration). Not yet checked on
  a device or emulator (the headless emulator came up "unauthorized" to adb).

### 2026-10-05 — Database design per module
- New `docs/database-design.md`: data store, tables (live / unused / drafted / proposed) and data
  flow for every module, including the not-started ones (teams, venues, bookings, events,
  tournaments, communities, search, notifications, realtime), plus a proposed `type_master`
  allocation (categories 14–24). Documentation only: no schema or code changes.

### 2026-09-29 — Redis, posts, messaging
- Diagnosed slowness: ~350 ms per query to Neon us-west-2 from India (see "Performance and Redis").
- Backend: optional `REDIS_URL` (ioredis). Live match state and scoring in Redis with ordered,
  idempotent background writes to Postgres (`modules/match/live/`, tests in `live.test.ts`);
  session-check cache; `src/cache/cache.ts` (Redis / memory). New `social` module (`/api/v1/posts`:
  create, get, delete, like, comments) and `chat` module (`/api/v1/conversations`). Feed posts
  gained `visibility`. `type_master` seed: 802 Post, 1201/1202 visibility, 1301/1302 conversation type.
- Proposed schema change for the owner: `docs/sql/2026-09-29_messaging_and_indexes.sql`
  (chat tables + indexes). Not applied yet; the chat API returns 500 until it is.
- Frontend: New post, Post (comments), Messages, New message and Chat screens; working like
  button; Home header has New post and Messages (unread badge). Shared `Composer`; `Screen` takes a
  `footer`; `IconButton` takes a `badge`.
- Not done: the backend auth test harness (`__tests__/test-app.ts`) still imports a removed module
  (pre-existing, see 2026-09-26 notes).

### 2026-09-29 — Redesign to the `pics/` designs; Strava-style light mode
- Frontend only. New palettes (dark from the designs, light like Strava), tokens (`radius.card`,
  `typography.overline` / `sectionTitle` / `screenTitle`, `spacing.screen` 16; auth screens keep 26).
- New shared components: `AppHeader`, `TopBar`, `BrandLogo`, `IconButton`, `LiveBadge`,
  `TeamBadge`, `UnderlineTabs`, `ListGroup` / `ListRow`, `TabBar`. `Avatar` gets per-name colours
  and an optional orange ring; `EmptyState` is the centred icon + pill button from the designs
  (with an error tone); `Screen` takes a pinned `header` and `padded`.
- Tabs are now Home (feed), Sports, +, Matches, Profile; `/feed` was folded into Home, the old Home
  dashboard became Sports; new `/matches` and `/settings`. Sign out moved to Settings.
- Not from the designs yet: stories, notifications, messages, events, venues, bookings,
  communities, create post (no backend for them). No custom font (the designs use Ubuntu).

### 2026-09-29 — Match scoring for all six sports; Play and Feed tabs
- Backend: new `match` module (`/api/v1/matches`: setup, live, create, get, events, undo, finish,
  abandon) with three scoring engines (rally, timed goals, overs) covering the six sports, Elo
  ratings, and one-transaction result saving (stats, ratings, history, feed post).
  `GET /api/v1/players` (player search). Match history excludes abandoned matches.
  `AppError.notFound` added.
- Database (project_x, data only, no schema changes): `npm run seed` now also inserts `type_master`
  (29 lookup rows, fixed ids), `mst_sport_format` (9), `mst_sport_scoring` (9),
  `mst_sport_period` (20), `mst_sport_event` (8), `mst_sport_stat` (16). Done on project_x.
- Frontend: four tabs (Home, Play, Feed, Profile) and a match screen (`/match/[id]`). Home's feed
  moved to the Feed tab; "Start a match" enabled; match rows and posts open the match. New shared
  `ChoiceChips` and `OutlineButton`.
- Checked: engine and Elo unit tests (backend 19), a full end-to-end run of every flow against
  project_x inside a rolled-back transaction (create, score, stale version, undo, finish, ratings,
  history, feed post, draw, tie-break chase, abandon, player search), frontend 53 tests, typecheck, lint.
- Dev machine: Metro did not see new files because `fs.inotify.max_user_instances` (128) was
  exhausted; raise it (`sudo sysctl fs.inotify.max_user_instances=512`) and restart Metro.

### 2026-09-29 — Home and Profile (Module 1 profile + basic Module 3 feed)
- Backend: new `profile` module (`GET /sports`, `GET/PATCH /profile/me`, `PUT /profile/me/sports`,
  `GET /profile/me/matches`) and `feed` module (`GET /feed`). `npm run seed` inserts the six MVP
  sports into `mst_sport` (done on project_x: ids 1–6). pg now parses `timestamp` columns as UTC.
- Frontend: bottom tabs (Home, Profile), Edit Profile screen, shared `Avatar` (initials), `Card`,
  `SectionHeader`, `EmptyState`; `Screen` gained pull-to-refresh and `edges`; `TextField` supports
  `multiline`; `BackButton` takes a `fallback`. Sign out moved to the Profile tab.
- Decisions: city and photo deferred (no city table, no storage yet); follow status codes defined
  in code (`type_master` still empty).
- Checked: new SQL exercised against project_x with sample data inside rolled-back transactions
  (history outcomes, feed follows/blocks, pagination with equal timestamps). Frontend: 41 tests,
  typecheck and lint pass.

### 2026-09-26 — Auth moved onto the owner's `project_x` schema
- The backend had been pointed at Neon database `neondb` and used a schema of our own (`users`,
  `user_identities`, `auth_sessions`, `schema_migrations`). The owner's schema lives in database
  `project_x`. `DATABASE_URL`/`DATABASE_URL_DIRECT` now point there, and the auth repository
  was rewritten against `usr_user`, `usr_user_profile`, `auth_session`, `auth_otp`,
  `auth_login_log` and `auth_password_history`. No tables were created or altered in `project_x`.
- API: sign-up requires `username`; login and password reset accept username/email/phone;
  `user` gains `username`; Google/Apple sign in existing accounts only (new 404 ACCOUNT_NOT_FOUND).
- OTP moved from Twilio Verify to our own codes in `auth_otp`. Env `TWILIO_VERIFY_SERVICE_SID`
  replaced by `TWILIO_FROM_NUMBER`.
- New dependency: `libphonenumber-js` (backend) to split E.164 numbers into calling code + number.
- Integer status codes defined in `auth.types.ts` (see "Status codes"); `type_master` is empty.
- Frontend: username field on sign-up, "Username, email or phone" on sign-in and forgot password,
  username on Home.
- Still to do: rewrite the backend test harness; delete `src/database/migrate.ts` and
  `src/database/migrations/` and the old tables in `neondb` (left in place pending the owner's OK).

### 2026-09-24 — Expo Go support for quick device testing
- `frontend/src/features/auth/social/google.ts` now imports `@react-native-google-signin/google-signin`
  lazily (dynamic `import()`), so the app starts in Expo Go; Google sign-in there reports
  PROVIDER_NOT_CONFIGURED. No behaviour change in development/production builds.

### 2026-09-24 — Android toolchain set up on the dev machine

- Android Studio at `/opt/android-studio`, SDK at `~/Android/Sdk`. The first Gradle build
  auto-installed platform 36, build-tools 35, NDK 27.1.12297006 and CMake 3.22.1.
- The build failed with Java 25 (Android Studio JBR): `configureCMakeDebug` "A restricted
  method in java.lang.System has been called". Fixed by building with Temurin JDK 17
  (`~/.jdks/jdk-17.0.20.1+1`, checksum verified).
- Network quirk on this machine: some download hosts are reachable only over IPv4 and others
  only over IPv6, so Java downloads can time out. The Gradle 9.3.1 distribution was fetched
  with curl (SHA-256 verified) into `~/.gradle/wrapper/dists/`. If dependency downloads time out,
  rerun with `-Dorg.gradle.internal.http.socketTimeout=120000
  -Dorg.gradle.internal.repository.max.retries=10`.

### 2026-09-24 — Authentication module implemented

- **Backend** (`backend/`, new): Express 5 + TypeScript (ESM, TS 6), `pg`, Zod, argon2, jose,
  Twilio Verify, google-auth-library, pino, helmet, express-rate-limit. Tests: Vitest + Supertest,
  which run against the real Neon DB inside a throwaway `test_auth_<random>` schema via
  `DATABASE_URL_DIRECT`. (Vitest instead of Jest: the backend is native ESM, which Jest handles poorly.)
- **Database:** migration `001_auth.sql` applied to Neon `neondb` (`users`, `user_identities`,
  `auth_sessions`, plus runner table `schema_migrations`).
- **Frontend** (`frontend/`, new): Expo SDK 57 (React Native 0.86, React 19.2) blank-typescript
  template + Expo Router, expo-secure-store, zustand, @react-native-google-signin/google-signin,
  expo-apple-authentication, expo-dev-client, expo-system-ui, expo-asset; tests with jest-expo +
  @testing-library/react-native 14 (its `render` and `fireEvent` are async, so await them). Template
  `App.tsx`/`index.ts`/`app.json` replaced by Expo Router + `app.config.ts`. Lint tooling
  (`eslint`, `eslint-config-expo`, `@react-native/jest-preset@0.86`, `test-renderer`) was installed
  with `--legacy-peer-deps` because of an optional `react-dom` peer conflict in Expo 57.
- Design screenshot moved to `docs/design/login-dark.png`.
- Verified: backend 27 tests, frontend 30 tests, typecheck, lint, `expo-doctor` (21/21), Android
  JS bundle export, Android prebuild. **Not yet run on an emulator:** this machine has no
  Android SDK/JDK.
- Twilio/Google/Apple credentials not provided yet: local `.env` uses `SMS_PROVIDER=dev`
  (`DEV_OTP_CODE=123456`); Google/Apple respond "not configured" until their IDs are set.

### 2026-09-24 — Neon database inspected, first screenshot received

- Neon `neondb`: PostgreSQL 18.6, only the `public` schema, **no tables, enums, functions or
  extensions** (only `plpgsql`). No existing auth schema, so the auth schema must be designed by
  us and applied as a migration (see Auth module notes once approved).
- `backend/.env` created locally (git-ignored, verified with `git check-ignore`) holding
  `DATABASE_URL` (Neon pooled endpoint).
- Design reference: `image.png` (repo root), dark-mode Login screen. Visual tokens taken from it:
  background near-black (~#0B0B0B), input/card surface ~#1A1A1A with a subtle border, primary
  orange ~#FF6B00 (logo tile, "X" in the wordmark, Sign in button with an orange glow), accent
  links in orange ("Forgot password?", "Create account"), muted grey secondary text, pill buttons.
- Login screen elements: logo + "ProjectX" wordmark, "Welcome back, athlete." heading, subtitle,
  "Email or phone" input, password input, "Forgot password?", "Sign in" primary button, "OR"
  divider, "Google" and "Phone" secondary buttons, "New here? Create account".

### 2026-09-24 — Product decisions received

- Database host: **Neon** (serverless PostgreSQL). Implications: connect over TLS
  (`sslmode=require`); use Neon's pooled connection string (`-pooler` host) for the API and the
  direct (non-pooled) string for migrations.
- Theming: app ships **dark mode and light mode**. Dark theme follows the supplied screenshots;
  light theme uses the same layout with an orange + white palette.
- Credentials: Neon connection strings go in `backend/.env` only (git-ignored), never in chat,
  code or commits.

### 2026-09-24 — Initial repository inspection

- Repo state: no commits yet on `master`; `backend/`, `frontend/`, `docs/` exist but are empty;
  `README.md` is empty; `.gitignore` covers `node_modules`, `.env*` (except `.env.example`),
  `dist/`, `build/`, logs, IDE folders.
- Local toolchain observed: Node v24.18.0, npm 11.16.0. Not found on this machine: `psql`,
  Java/JDK, `ANDROID_HOME` (needed later to run Postgres locally and build the Android app).
- Created this `wiki.md`.
- Waiting on: authentication UI screenshots and PostgreSQL auth table schemas before
  implementing the Authentication module.
