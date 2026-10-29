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
3. **Posts, likes, comments** — done (text + photos since 2026-10-21). **Chat** (1:1 and groups,
   polling) — done; its tables are created by Prisma migration `3_app_redesign`.
   **Redis** — live match state, session cache, chat polling (see "Performance and Redis").
4. **Product focus (2026-10-14 pivot): racket sports first** — badminton, table tennis, pickleball,
   padel, tennis — with **friendly matches** and **tournaments**, on a sport-agnostic core (scoring
   plugins + generic match/event/segment model). Volleyball, football and box cricket are kept but
   inactive. Plan: `docs/pivot/PLAN.md`; adding a sport: `ADDING_A_SPORT.md`.
   `docs/scoring-and-tournaments.md` (corporate organizations, medal tables) is post-MVP.
5. **App UI (2026-10-21): every screen rebuilt from the `ProjectX-UI/` designs** (read
   `ProjectX-UI/HANDOFF.md` first). See "App navigation" and "Design system".
6. Social Graph / Follow, Media, Notifications, Realtime, Teams, Events, Venues, Bookings,
   Communities, Search, Analytics — not started (`docs/database-design.md`)

### Ground rules

- The `ProjectX-UI/screens/*.dc.html` designs and supplied PostgreSQL schemas are the source of
  truth. Rebuild designs exactly (every button, including small ones like the coin toss).
- No secrets in Git (`.env*` is ignored; only `.env.example` is committed).
- Do not restructure the repo or implement future modules ahead of time.
- The database schema is managed with **Prisma migrations** (`backend/prisma/`, since 2026-10-14;
  latest `3_app_redesign`). The 46 original tables are recorded by `0_baseline`; never run `prisma migrate dev`/`reset` against
  `project_x`. See `backend/prisma/README.md`.

## How to run (local development)

### Backend (`backend/`)
```bash
cd backend
npm install
cp .env.example .env        # then fill in values (see "Environment variables")
npm run seed                # inserts missing reference data (the 6 sports in mst_sport); safe to re-run
npm run dev                 # http://localhost:4000, health check at GET /health
                            # API docs (Swagger UI): http://localhost:4000/docs, spec: /docs/openapi.json
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
npm run sync-engine         # after changing backend/src/engine/scoring (a test fails if out of date)
```
Typed routes (`expo-router` typed paths) are regenerated only while `expo start` runs: start Metro
once after adding a route, or typecheck reports the new path as invalid.
The app normally runs as a development build. **Expo Go** also works for quick testing on a phone
(`npx expo start --go`: `expo-dev-client` is installed, so without `--go` Metro serves the dev
client and Expo Go can't open it; scan the QR code, `EXPO_PUBLIC_API_URL` = the PC's LAN IP). The
App Store's Expo Go only runs the latest SDK, so keep the project on it for iPhone testing. Everything works except Google
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
- Database: the owner's `project_x` schema; changes go through Prisma migrations (see Ground rules).
  `src/database/pool.ts` raises Node's IPv4/IPv6 connect attempt timeout to 2 s, because the
  250 ms default made every connection to Neon (us-west-2) fail with ETIMEDOUT on slow links.
- Logging: pino. Request logs contain only method, path and status. Passwords, codes and tokens
  are redacted paths and must never be logged.

### Frontend
- Expo SDK 58 (React Native 0.88, React 19.3) + Expo Router. Route files in `src/app/` are one-line re-exports; screens live in
  `src/features/<feature>/screens/`, their parts in `features/<feature>/components/`, shared UI in
  `src/shared/ui/` (`Buttons`, `Controls`, `Inputs`, `Display`, `Header`, `Screen`, `Sheet`,
  `TabBar`, `Text`, `Icon`, `Chart`, `DragList`). `frontend/legacy-ui/` keeps the pre-2026-10-21
  screens for reference only (not built, not tested).
- `src/shared/api/client.ts` is the only place that calls `fetch`. It normalizes errors to
  `ApiError { status, code, message, details }` (`status 0` = network error), attaches tokens, and
  refreshes once on `ACCESS_TOKEN_EXPIRED`. Requests time out after 15 s unless they pass
  `timeoutMs` (match create / finish / retire / walkover / abandon use 90 s).
- Data loading: `useResource` (fetch + reload + error), `useSearch` (debounced search),
  `useOpened`, `useNow` / `useCountdown` in `shared/hooks/`.
- Lint uses the React Compiler rules: no ref writes or synchronous `setState` during render or in
  effects. Use the hooks above instead of hand-rolled effect state.
- `src/engine/scoring/` is a generated copy of the backend's scoring engine (`npm run sync-engine`);
  the score screen uses it to show a tapped point immediately.
- Feature API modules (e.g. `features/auth/api/auth.api.ts`) map 1:1 to backend endpoints.
- Global state: Zustand stores per feature (`features/auth/store/auth.store.ts`). Screens call
  store actions through `useSubmit` (`shared/hooks/useSubmit.ts`) for loading and error state.
- Theme: see "Design system" below. Components read colours via `useTheme()`; never hard-code
  colours in screens. Light / Dark / System is chosen in Settings (`theme.store.ts`).
- Config: `shared/config/env.ts` reads `EXPO_PUBLIC_*`. Those values are bundled into the app, so
  never put secrets there.

## Design system

From `ProjectX-UI/HANDOFF.md` (tokens table there). `shared/theme/colors.ts` holds both palettes
with the handoff's token names (`bg`, `surface`, `raised`, `line`, `fg`, `soft`, `muted`,
`primary`, `accentText`, `sideB`, …), so a screen can be checked against its design. Dark: `#0A0A0A`
background, `#E85D04` primary; light: white background, `#C2410C` primary. `LIVE` `#FF5468`,
`READY` `#4ADE80` and `GOLD` are the same in both themes. Each sport has its own colour (from
`backend/src/catalog/sports.ts`); text on sport fills is dark.
Fonts (`shared/theme/fonts.ts`, loaded in the root layout before the splash screen hides): **Big
Shoulders Display** 700/800/900 for titles and every score number, **Instrument Sans** 400–700 for
everything else.

## App navigation (Home, Tournaments, +, Chats, Profile)

Each design in `ProjectX-UI/screens/` has a route; `Main.dc.html` is the flow map. The root layout
switches between `(auth)` and `(app)` with `Stack.Protected` on the auth state. Right after sign-up
only the onboarding routes are reachable (`auth.store.onboarding`). The tab bar
(`shared/ui/TabBar.tsx`) has Home, Tournaments, a centre + (new match) and Chats, Profile.

| Route | Screen (`features/…/screens`) | Design |
| --- | --- | --- |
| `/welcome` | auth/WelcomeScreen | Welcome |
| `/signup` → `/signup-code` → `/signup-details` | auth/SignupPhoneScreen, CodeScreen, SignupDetailsScreen | SignupPhone, VerifyCode, SignupDetails |
| `/login`, `/login-code` | auth/LoginScreen, CodeScreen | Login (password or SMS code), VerifyCode |
| `/forgot-password`, `/settings/password` | auth/ForgotPasswordScreen | ForgotPassword |
| `/onboarding/sports`, `/onboarding/claim`, `/onboarding/details` | profile/PickSportsScreen, ClaimMatchesScreen, auth/SignupDetailsScreen | PickSports, ClaimMatches |
| `/` (Home tab) | feed/HomeScreen | Home (feed, live strip, bell with unread badge) |
| `/notifications` | notifications/NotificationsScreen | no design yet (likes, comments, new posts, follows) |
| `/post/new`, `/post/[id]` | feed/NewPostScreen, PostDetailScreen | NewPost (text, photo, attached match), PostDetail |
| `/chats` (tab), `/chat/[id]` | chat/ChatListScreen, ChatThreadScreen | ChatList, ChatThread (can send a match result) |
| `/profile` (tab), `/profile/edit`, `/profile/matches` | profile/ProfileScreen, EditProfileScreen, MatchHistoryScreen | Profile, EditProfile (photo, city), MatchHistory |
| `/user/[id]`, `/search` | profile/PlayerProfileScreen, SearchScreen | PlayerProfile (follow), Search |
| `/follows/[id]` | profile/FollowListScreen | no design yet (Instagram-style followers / following, remove follower) |
| `/settings` | profile/SettingsScreen | Settings (theme, devices, linked Google/Apple, sign out others) |
| `/match/new` → `/match/setup` → `/match/serve` | match/NewMatchSportScreen, NewMatchSetupScreen, ServeFirstScreen | NewMatchSport, NewMatchSetup (+ AddPlayer sheet), ServeFirst (coin toss) |
| `/match/[id]` | match/ScoreScreen | the six Score<Sport> designs as **one** screen driven by the plugin's `actions[]`; ScorerMenu and RetireSheet are sheets; MatchComplete is its finished state |
| `/match/[id]/watch`, `/match/[id]/result` | match/SpectatorScreen, MatchResultScreen | Spectator, MatchResult |
| `/match/enter`, `/match/[id]/confirm` | match/EnterResultScreen, ConfirmResultScreen | EnterResult, ConfirmResult |
| `/tournaments` (tab), `/tournaments/mine` | tournaments/TournamentListScreen, MyMatchesScreen | TournamentList, MyMatches |
| `/tournament/new`, `/tournament/[id]`, `/tournament/[id]/register` | CreateTournamentScreen, TournamentPageScreen, RegisterScreen | CreateTournament, TournamentPage, Register |
| `/tournament/[id]/manage`, `…/staff`, `…/courts`, `…/schedule`, `…/event/new` | OrgDashboardScreen, StaffCourtsScreen, CourtBoardScreen, ScheduleScreen, AddEventScreen | OrgDashboard, StaffCourts, CourtBoard, Schedule, AddEvent |
| `/event/[id]` (+ `/entries`, `/draw`, `/groups`, `/bracket`, `/podium`) | EventPageScreen, EntriesScreen, DrawScreen, GroupsScreen, BracketScreen, PodiumScreen | EventPage, Entries, DrawPreview, DrawGroups / GroupTable, BracketView, Podium |
| `/fixture/[id]`, `/fixture/[id]/result` | FixtureScreen, FixtureResultScreen | Fixture, EnterResult |

PublicMatch and PublicTournament are server-rendered pages (`backend/src/modules/public/public.pages.ts`, `/s/:token`, `/t/:slug`).

**Live scoring in the app** (`features/match/hooks/useLiveScoring.ts`): a tap is applied at once
with the local engine copy, queued, and sent in order with the match `version`. `STALE_MATCH`
reloads and resends the queue; codes like `MATCH_OVER` drop it. Finish / retire / walkover first wait
up to 60 s for the queue to send; if points are still unsent they show "Still saving the last
points" instead of acting on an old score. The Finish button reads "Finish match · saving points"
while the queue sends.

### Social, users and media APIs (since 2026-10-21, bearer token)
| Method & path | What |
| --- | --- |
| GET `/api/v1/users/search?q=`, GET `/users/:id`, GET `/users/:id/matches` | player search, public profile, match history |
| GET `/users/:id/followers`, GET `/users/:id/following` (`q`, `cursor`, `limit`), DELETE `/users/me/followers/:id` | follow lists (newest first, keyset cursor `<created_at>_<follow id>`, active + unblocked only, rows carry `isFollowing` / `followsMe`), remove a follower |
| PUT / DELETE `/api/v1/users/:id/follow` | follow / unfollow |
| POST `/api/v1/media` (base64 JSON, ≤ 3 MB, jpeg/png/webp checked by signature), GET `/media/:id` | photos stored in Postgres (`media_files`); the app resizes to ≤ 1600 px first (`shared/media/upload.ts`) |
| GET `/api/v1/players/claimable`, POST `/players/claim` (`playerIds?`) | guest matches with my verified phone; claimed explicitly |
| GET `/api/v1/matches/:id/details` | the match result screen's data |
| GET `/api/v1/tournaments/me/matches`, GET `/tournaments/:id/fixtures`, DELETE `/fixtures/:id/scorers/:userId` | My matches, schedule, scorer removal |

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
`social_post.match_id` is UNIQUE and stays the automatic result post; a written post attaches a
match through `attached_match_id` (since 2026-10-21) and up to 4 photos (`mediaIds`).

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

### Notifications API (`/api/v1/notifications`, bearer token) — needs migration `4_notifications`
| Method & path | Body / query | Success | Errors |
| --- | --- | --- | --- |
| GET `/` | `?limit=1..50` (30), `?cursor=<nextCursor>` | 200 `{notifications, unreadCount, nextCursor}` newest first | 400 VALIDATION_ERROR |
| GET `/unread` | – | 200 `{count}` (the bell's badge) | – |
| POST `/read` | – | 200 `{read: true}` (all of mine) | – |
| POST `/:id/read` | – | 200 `{read: true}` | 404 NOTIFICATION_NOT_FOUND (also someone else's) |

`notification` = `{id, type: like|comment|post|follow, title ("Asha liked your post"), message (the
comment or the post text, ≤ 140 chars), isRead, createdAt, actor: {id, username, fullName, photoUrl},
postId (null for follows)}`. Stored in the legacy `notification` table plus `actor_id` (migration 4);
`notification_type_id` is type_master category 14: 1401 Like, 1402 Comment, 1403 New post, 1404 Follow;
`reference_id` = the post. Written by `notificationsRepository` from the social and users routers:
like (once per person and post; unlike deletes it), comment, new written post (every accepted follower,
both visibilities), follow (once; unfollow deletes it). Never for your own actions or across a block.
Deleting a post deletes its notifications; the list and count also skip a missing post, a blocked pair
or an inactive actor. Match-result posts don't notify. In-app only: Home polls `/unread` every 30 s
while focused, and opening the screen marks all read. No push notifications yet.

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
- **Live matches** (`modules/matches/live/`): each live match's state (rules, sides, events,
  version, period start times) is kept under `live:match:<id>` / `live:version:<id>` (24 h). A
  scoring tap or undo = read state + one atomic Lua commit that checks the version, stores the new
  state and appends a job to `live:queue:<id>` (match id added to `live:pending`); the response is
  sent immediately. `LivePersister` then writes the jobs to Postgres in order, **up to 100 jobs per
  transaction** (`peekJobs` / `ackJobs`; a backlog from fast tapping catches up in one write),
  removing jobs only after commit; jobs are idempotent (by event `sequence`), failed writes retry
  every 3 s, and queues left from a crash are resumed at startup. Background writing is on with
  Redis, and **also in development without Redis** (in memory), so a far-away dev database doesn't
  slow every tap; production without Redis writes synchronously. Before finish / abandon, and
  before reloading a match from Postgres, the queue is flushed first. Match GETs, spectator polls
  and the live list's scores come from Redis. Ended matches are dropped from Redis.
- **Sessions** (`modules/auth/session-cache.ts`): the per-request "is this session active?" lookup
  is cached 60 s; sign-out, refresh-token reuse and password reset clear it immediately (a
  suspension takes effect within 60 s).
- **Chat polling**: see "Messages API".

## Match & tournament modules (racket-first core)

### Architecture
- **`backend/src/engine/`** — pure TypeScript, no DB/HTTP (a test enforces it):
  - `scoring/`: the `ScoringPlugin` interface (`types.ts`), `ScoringRegistry`, `replay()`, and the
    MVP plugins `rally` (badminton, table tennis, pickleball rally, volleyball), `side_out`
    (traditional pickleball, 0-0-2 start), `tennis` (tennis, padel: advantage/golden point, tiebreaks,
    match tiebreak). Every plugin tracks the server on every point. `parked/` holds the football and
    box-cricket engines (not registered).
  - `tournament/`: formats registry (`knockout`, `round_robin`, `groups_knockout`), seeding with byes,
    advancement (walkover / no-show / retirement / double walkover, 3rd-place routing),
    standings with ordered tiebreakers.
  - `rating/`: `RatingSystem` interface; Elo K=32 now, Glicko-2 columns ready.
- **`backend/src/catalog/sports.ts`** — sports, formats, default rulesets (seeded by `npm run db:seed`).
- **Modules:** `sports`, `players` (guests, search, claim), `matches` (live scoring through the
  registry, Redis live store + persister, completion, confirmation), `tournaments`, `public`
  (share pages). They use Prisma Client on the shared `pg` pool; auth/feed/social/chat keep raw SQL.
- **No sport-specific branches outside the plugins.** The app draws the scoreboard and the scoring
  buttons from the plugin's `ScoreSummary` (`sides`, `segments`, `callout`, `actions`).

### How a match works
- `matches` snapshots `scoring_model` + `ruleset_config`, so later ruleset edits never change it.
- `match_events` is append-only (`payload` validated by the plugin). Scores are replayed from it;
  undo sets `voided_at` on the newest event. `match_segments` (+ scores) and `matches.summary` are
  projections rebuilt after every change.
- Requests carry `version` (409 `STALE_MATCH` if stale) and an optional `clientEventId` (a retry
  never counts twice). Scorers: the creator, `match_scorers`, the court's `court_scorers`, and the
  tournament's organizers.
- **Completion** (one transaction): status/result type, side outcomes, segments, records rebuilt
  (`player_sport_stats`, `team_stats`), ratings, the feed post, tournament advancement.
- **Ratings** move only when every participant is a registered player and the match was played or
  retired (never walkovers). Manually entered friendly results wait for a registered opponent's
  confirmation (`/confirm`); a dispute sets the match `disputed` and removes it from records.
- **Guests:** players without accounts (`players.user_id` null). Since 2026-10-21 a new user claims
  guest history explicitly: onboarding's ClaimMatches lists `GET /players/claimable` (guests with
  the user's verified phone) and `POST /players/claim` merges the chosen ones (60 s transaction:
  merging rebuilds stats).

### API (all `/api/v1`, bearer token unless noted)
| Area | Endpoints |
| --- | --- |
| Sports | `GET /sports` (active only, with formats + rulesets), `GET /sports/:slug` |
| Players | `GET /players?q=`, `GET /players/me`, `GET/POST /players/guests`, `POST /players/claim` |
| Matches | `POST /matches` (`{sport, format, rulesetId?, sides:[{players:[{userId}|{playerId}|{guest}]}], manualScores?}`), `GET /matches/live`, `GET /matches/pending-confirmations`, `GET /matches/:id`, `POST /matches/:id/events` (`{event, version, clientEventId?}`), `/undo`, `/complete`, `/retire`, `/walkover`, `/abandon`, `/confirm`, `/scorers` |
| Tournaments | `GET/POST /tournaments`, `GET/PATCH /tournaments/:id`, `POST /tournaments/:id/{staff,courts,events}`, `DELETE /tournaments/:id/staff/:userId/:role`, `POST /courts/:id/scorers` |
| Categories | `GET/PATCH /tournament-events/:id`, `POST /tournament-events/:id/entries`, `POST /tournament-events/:id/draw` (`{preview?, randomSeed?}`), `DELETE /tournament-events/:id/draw`, `PATCH /entries/:id` (approve, seed) |
| Fixtures | `GET /fixtures/mine`, `GET/PATCH /fixtures/:id` (court, time), `POST /fixtures/:id/start`, `/walkover`, `/result` |
| Public (no login) | `GET /public/matches/:shareToken`, `GET /public/tournaments/:slug`, `GET /public/tournament-events/:id`; pages `/s/:shareToken` (live scoreboard) and `/t/:slug` (brackets, fixtures, live scores, standings) |

### Known gaps / follow-ups
- Spectators poll (4 s app, 3-5 s public pages); WebSockets + Redis pub/sub are still to do.
- The result card is shared as text + link (no image yet: needs a native capture module).
- Scheduling is manual (court + time per fixture); no automatic scheduler or clash detection.
- Double elimination / Swiss: add a format in `engine/tournament/formats.ts` (no schema change).
- Legacy `match_*`, `mst_sport*`, `usr_sport_*`, `usr_user_sport` tables are frozen, not dropped.

## Auth module

### Screens and flows
Designs: Welcome, SignupPhone, VerifyCode, SignupDetails, Login, ForgotPassword in `ProjectX-UI/screens/`.

| Route | Screen | Flow |
| --- | --- | --- |
| `/welcome` | WelcomeScreen | First signed-out screen: "Join for free" → `/signup`, "Log in" → `/login` |
| `/signup` | SignupPhoneScreen | Step 1: phone + username (live check via `GET /username-available`) → `POST /register/start` (SMS code) |
| `/signup-code` | CodeScreen | Step 2: 6-digit code → `POST /register/verify` → short-lived registration token |
| `/signup-details` | SignupDetailsScreen | Step 3: name, password, optional email + the token → `POST /register/complete`; then onboarding (pick sports, claim guest matches) |
| `/login` | LoginScreen | Username, email or phone + password → `POST /login`, or "use a code" → `/login-code` (`/phone/start`, `/phone/verify`); Google / Apple |
| `/forgot-password` | ForgotPasswordScreen | Identifier → code → new password (`/password/forgot`, `/password/reset`); also `/settings/password` when signed in |

Navigation is state-driven: the root layout uses `Stack.Protected` on `auth.store.status`, so
signing in or out switches stacks automatically, with no imperative redirects. The splash screen
stays up while `bootstrap()` restores the session and the fonts load.

### Auth API (`/api/v1/auth`)
All bodies are JSON. Phones must be E.164 (`+919876543210`); the app normalizes user input
using `EXPO_PUBLIC_DEFAULT_COUNTRY_CODE`; the backend splits them into calling code + national
number (libphonenumber-js). `identifier` = email (contains `@`), phone (only digits, `+`,
separators) or username (anything else). Usernames: 3–30 of `A-Z a-z 0-9 _ .`, at least one
letter, unique case-insensitively.
Passwords: 8–128 characters, at least one letter and one digit. Codes: 6 digits.

| Method & path | Body | Auth | Success | Notable errors |
| --- | --- | --- | --- | --- |
| POST `/register/start` | phone, username | – | 200 `{message}`; SMS sent | 400 VALIDATION_ERROR, 409 USERNAME_TAKEN / PHONE_TAKEN, 429 |
| POST `/register/verify` | phone, code | – | 200 registration token (short-lived; proves the phone) | 400 INVALID_CODE, 429 |
| POST `/register/complete` | token, username, fullName, password, email? | – | 201 `{user, tokens}` | 409 |
| GET `/username-available` | `?username=` | – | 200 availability | – |
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
| GET `/sessions`, POST `/sessions/sign-out-others` | – | Bearer | signed-in devices (`auth_session.device_name`, sent by the app via `expo-device`) | – |
| GET `/identities`, POST `/identities/google` / `/apple`, DELETE `/identities/:provider` | idToken / identityToken | Bearer | linked sign-in providers (`auth_identity`) | 409 IDENTITY_IN_USE |

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
- Login returns a single INVALID_CREDENTIALS error for a wrong password or an unknown account, and
  unknown accounts run a dummy argon2 verify to equalize timing. `phone/start` and `password/forgot`
  answer 404 `NO_ACCOUNT` / 403 `ACCOUNT_DISABLED` instead of a silent "if an account exists": sign-up
  already reveals a taken phone (409), so the generic reply hid nothing and left people waiting for a
  text that never came. The per-IP / per-identifier send limits below cap probing.
- Rate limits (in-memory, per process): 300 requests / 15 min per IP on all auth routes;
  sending codes: 20/h per IP and 5/h per phone or identifier; checking codes: 10 / 15 min per
  target; login: 10 / 15 min per identifier. Each code also allows at most 5 checks (`auth_otp.max_attempts`).
- Social sign-in only signs in an **existing** account: one that linked the provider in Settings
  (`auth_identity`, since 2026-10-21) or whose email the provider asserts as verified. `usr_user`
  requires a username, phone and password, so Google/Apple cannot create accounts.

### Environment variables
Backend (`backend/.env`, template `backend/.env.example`): `NODE_ENV`, `PORT`, `LOG_LEVEL`,
`TRUST_PROXY`, `CORS_ORIGINS`, `DATABASE_URL` (Neon pooled), `DATABASE_URL_DIRECT` (Neon direct:
tests), `DB_POOL_MAX`, `JWT_ACCESS_SECRET` (≥ 32 chars), `ACCESS_TOKEN_TTL_SECONDS`,
`REFRESH_TOKEN_TTL_DAYS`, `SMS_PROVIDER` (`twilio` | `dev`), `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `DEV_OTP_CODE`, `GOOGLE_CLIENT_IDS`,
`APPLE_BUNDLE_IDS`, `API_DOCS` (`true`/`false`; unset = Swagger UI on outside production). Validated at start-up by `src/config/env.ts`; the server refuses to start if
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
- Google/Apple sign-in only works for existing accounts (linked in Settings, or the same verified email).
- Backend API tests (`src/modules/auth/__tests__/`) still target the old schema and do not run:
  the test harness must be rewritten to build an isolated copy of the `project_x` tables.

## Changelog

### 2026-10-27: Hosted test backend on Render, EAS build profiles
- API runs on Render (free plan, Singapore) as `project-x-api` at `https://project-x-api-yf0w.onrender.com`,
  auto-deploying `main`. Build: `cd backend && npm ci && npm run build`; start runs `db:deploy` then
  `npm start`. It's in `NODE_ENV=development` with `SMS_PROVIDER=dev` (fixed OTP) for closed testing.
  The free plan sleeps after 15 minutes, so the first request after that takes about 50s.
- App: `frontend/eas.json` adds `development`, `preview` (internal; an APK on Android, ad hoc on iOS)
  and `production` profiles. `preview` and `production` set `EXPO_PUBLIC_API_URL` to the Render URL.
- The 2026-10-25 entry below was committed in 9198f1b.

### 2026-10-25 — Follower / following lists, remove follower, photo viewer (uncommitted)
- API: `GET /users/:id/followers` and `/following`: newest first, search by username / name,
  keyset paging. `DELETE /users/me/followers/:id` removes a follower and their follow notification,
  without telling them. Follower counts now leave out suspended accounts so they match the lists.
- App: the counts on Profile and on another player's profile open `follows/[id]` (FollowListScreen),
  with Followers / Following tabs, search, Remove (with a confirm) on my own followers, and
  Follow / Following / Follow back elsewhere. Tapping a profile photo opens it enlarged
  (`ExpandableAvatar` / `PhotoViewer` in shared/ui, React Native `Modal` + `Animated`, no new packages).
- Tests: `users/__tests__/follows.api.test.ts` (14), covering auth, validation, order, paging with the
  cursor row unfollowed mid-walk, search escaping, viewer-relative flags, suspended and blocked
  accounts, remove (idempotent, own followers only, re-follow). Checklist §14, §36 and new §36b.

### 2026-10-25 — Forgot password / code login say when there's no account (uncommitted)
- `POST /auth/password/forgot` and `/auth/phone/start` now return 404 `NO_ACCOUNT` for an unknown
  username/email/phone and 403 `ACCOUNT_DISABLED` for a suspended one, instead of a silent 200
  ("If an account exists…"). Found in testing: the app said "We texted a code" for an identifier
  with no account, so the dev code `123456` was rejected as "incorrect or expired". SMS failures
  now surface as 503 `SMS_UNAVAILABLE` instead of being swallowed.
- Tests: lookup by username/email/phone in any case and spacing; unknown → 404 with no SMS;
  suspended → 403 (and its last code stops working); a newer code replaces the old; a used code
  can't be reused. Checklist §5 and §7 updated.

### 2026-10-25 — Fewer database round trips: Prisma `relationJoins` (uncommitted)
- Why: the round-robin flow test timed out (240 s). Measured: each Neon round trip is ~480 ms from
  here (us-west-2; the Singapore move is still not done), and Prisma ran one query per `include`d
  relation: a fixture result took 144 queries (52 s), a draw 71 (82 s), creating a tournament 18.
- Fix: `previewFeatures = ["relationJoins"]` in `schema.prisma`, so each include tree is one joined
  query. Now: fixture result 58 queries (25 s), draw 26 (10 s), create tournament 7 (2.9 s), event
  view 51 → 13. No code changes; same results.
- Still to do: `fixtureManualResult` starts a live match and then records the result in a second
  transaction, loading the match view ~6 times; folding that into one transaction would cut ~30 more.
  Moving Neon to Singapore remains the biggest win.

### 2026-10-25 — Notifications: bell on Home (uncommitted)
- DB: migration `4_notifications` (applied to `project_x`) reuses the legacy `notification` table:
  adds `actor_id` (FK `usr_user`, cascade), type_master rows 1401–1404 (also in `seed.ts`), and indexes
  for the list, the unread count and post cleanup. `schema.prisma` names the two `usr_user` relations
  (`NotificationRecipient`, `NotificationActor`).
- Backend: new `modules/notifications` (codes, repository, router at `/api/v1/notifications`); likes,
  comments, new posts, post deletion, follows and unfollows write or remove notifications; Swagger
  tag "Notifications"; `__tests__/notifications.api.test.ts` (15 tests: auth, validation, follows, posts,
  likes, comments, truncation, deletes, read state, paging, blocks, suspended actors; all passing).
- App: `bell` icon; Home header bell (left of search) with a red unread badge (polled every 30 s while Home is
  focused); new `/notifications` screen (`features/notifications`), paginated, tap → post or profile.
- `docs/TESTING_CHECKLIST.md`: new Part 0 (architecture) and Part H (cross-cutting checks); page 11b; the
  missing API-only routes (`/health`, `/sports/:slug`, `/fixtures/mine`) in Part D; notification rows on pages 11, 33, 34, 35, the table
  index, and Part G notes. Not yet checked on a device.

### 2026-10-25 — Expo SDK 57 → 58 (uncommitted)
- Why: the iPhone App Store's Expo Go only runs SDK 58, so the app couldn't be opened there.
- `frontend/package.json` + lockfile (regenerated from scratch): every `expo-*` package to ~58,
  `react-native` 0.88.0, `react` 19.3.0, matching `@types/react`, `jest` 30, `jest-expo` 58,
  `eslint-config-expo` 58, `@react-native/jest-preset` 0.88. `expo-doctor`: 20/20 checks passed.
- Breaking API fix: `shared/ui/TabBar.tsx`. SDK 58's tab bar props no longer include `navigation`;
  it now uses `emitter.emit` + `navigateToTab(route.key)`.
- Type-only fixes: refs typed as `ScrollViewInstance` (`BracketScreen`) and `TextInputInstance`
  (`Inputs` OTP field); `HomeScreen` FlatList footer uses `undefined` instead of `null`.
- Logout fix: `src/app/_layout.tsx` sets `redirectTo="/welcome"` on the `(app)` guard. Without it,
  SDK 58 falls back to `/`, the pathless-group path that resolves to the guarded home tab, so signing
  out landed on Expo Router's dev Sitemap ("System Information").
- Verified: typecheck clean, lint 0 errors, and Metro serves `exposdk:58.0.0` with a working iOS bundle.
  Not yet checked on a device.

### 2026-10-25 — Swagger covers every route; testing checklist (uncommitted)
- `backend/src/docs/openapi.ts`: added the 20 routes that were missing, for 102 operations in all:
  auth register/verify, username-available, sessions, sign-out-others, identities; match details;
  players claimable (+ the `claim` body); tournaments `me/matches` and `:id/fixtures`; removing a
  court scorer; Users (search, profile, matches, follow) and Media (upload, `/media/:id`). Also added
  missing query params (`sport`, `filter`, `q`) and removed the out-of-date "chat tables not applied"
  note. `claimSchema` is now exported from `players.routes.ts`.
- `docs/TESTING_CHECKLIST.md`: a page-by-page manual test plan listing the tables, Redis keys and
  services each screen reads and writes.

### 2026-10-23 — Live scoring speed and safe finishing (uncommitted)
- Backend: `LivePersister` writes up to 100 queued jobs per transaction (`LiveStore.peekJobs` /
  `ackJobs`, Redis `LRANGE` + `LTRIM`); `MatchesService.persistJobs` inserts new events with one
  `createMany` and rebuilds projections once per batch. Without Redis, development now scores in
  the background too (`app.ts`); production without Redis is unchanged. Guest merge transaction
  limit raised to 60 s.
- App: `RequestOptions.timeoutMs`; match create / complete / retire / walkover / abandon wait 90 s.
  Finishing waits up to 60 s for queued points, then shows "Still saving the last points" rather
  than acting on an old version; Finish stays enabled and reads "Finish match · saving points".
- Checked: backend and app typecheck, live-store tests (5). Not yet tried on a device.

### 2026-10-21 — App rebuilt from the ProjectX-UI designs (commit `64654ac`)
- Every design in `ProjectX-UI/screens/` has a route (see "App navigation"); new design system
  (handoff tokens, Big Shoulders Display + Instrument Sans) and shared UI kit in `shared/ui/`.
  Old screens moved to `frontend/legacy-ui/` (excluded from tests).
- Tabs: Home, Tournaments, + (new match), Chats, Profile. Match flow: sport → setup (+ add player /
  guest) → serve first (coin toss) → one generic `ScoreScreen` for all six sports, with scorer menu
  and retire sheets, the finished state, spectator view, result, enter / confirm result.
  Tournament organiser and player screens (create, events, entries, draw, groups, bracket, podium,
  schedule, courts, staff, fixtures, register, my matches).
- Optimistic scoring: the backend's scoring engine is copied into `frontend/src/engine/scoring`
  (`npm run sync-engine`); `useLiveScoring` shows taps at once and sends a queue.
- Auth: sign-up in 3 steps (`/register/start` phone + username → `/register/verify` code → token →
  `/register/complete`), `/username-available`, login by password or SMS code, devices list and
  sign-out-others, linked Google/Apple identities. Onboarding: pick sports, claim guest matches
  (`/players/claimable`, explicit `/players/claim`).
- New APIs: `/users` (search, profile, matches, follow), `/media` (photo upload / serve),
  `/matches/:id/details`, `/tournaments/me/matches`, `/tournaments/:id/fixtures`, fixture scorer
  removal; posts take `mediaIds` (≤ 4) and an attached `matchId`; chat messages can carry a match.
- Prisma migration `3_app_redesign`: chat tables (from the 2026-09-29 proposal) + `chat_message.match_id`,
  `auth_identity`, `media_files` (photos as `bytea`, ≤ 3 MB), `social_post.attached_match_id`,
  `usr_user_profile.city`, `auth_session.device_name`, `tournaments.entry_fee`. Whether it has been
  applied to `project_x` was not re-checked on 2026-10-23 (the database was unreachable).
- Public pages `/s/:token` and `/t/:slug` restyled to the PublicMatch / PublicTournament designs.
- New dependencies: backend `swagger-ui-express`; app `@expo-google-fonts/*`,
  `@react-native-community/datetimepicker`, `expo-clipboard`, `expo-device`, `expo-haptics`,
  `expo-image-manipulator`, `expo-image-picker`, `expo-keep-awake`, `zod` (dev builds need a rebuild).
- New docs: `docs/auth-tables-and-flow.md`, `docs/product-modules-tournaments-scoring.md` (+ PDFs).

### 2026-10-19 — Welcome screen redesign
- `/welcome` rebuilt to the four `pics/0x · …@2x.png` designs (Live scoring, Your people, Ratings,
  Crew): court backgrounds and the rating sparkline are drawn with `react-native-svg` (new
  dependency, in Expo Go; dev builds need one rebuild). Screen is dark in both themes; system font,
  not the designs' typeface; sport icons from the existing icon set.
- The old `pics/` screenshots (onboarding…settings, `image*.png`) were removed from the working tree.
- Not yet checked on a device.

### 2026-10-19 — API docs (Swagger)
- OpenAPI 3.1 spec for all 82 operations in `backend/src/docs/openapi.ts`, served by
  `swagger-ui-express` at `/docs` (spec at `/docs/openapi.json`). Request bodies are generated from
  the routes' Zod schemas (`z.toJSONSchema`), so they track validation automatically; response
  shapes and error codes are written by hand and must be updated when `*.types.ts` or the services change.
  A new route must also be added there.
- `API_DOCS` env var; the docs router relaxes the CSP's `upgrade-insecure-requests` so the UI loads over plain http.

### 2026-10-14 — Pivot: racket sports first, generic core, tournaments
- Prisma adopted: `0_baseline` (46 existing tables, marked applied), `1_core_schema` (31 new tables),
  `2_updated_at_defaults`; applied to `project_x`. Only existing-table change: `social_post.match_id`
  FK now points at `matches` (no rows used it). Seeded 8 sports (5 active), 21 rulesets; backfilled
  5 players, their sports and ratings from the legacy tables.
- Engine: scoring plugins (rally, side-out, tennis), tournament engine, rating interface.
- Backend: new `sports`, `players`, `matches`, `tournaments`, `public` modules; profile and feed read
  the new tables; old `modules/match` removed; football/cricket engines parked.
- App: quick start with guests and manual results, generic live scoring screen, share links,
  confirmations, tournaments (create, categories, entries, seeding, draw, bracket, standings,
  fixtures with court/time, walkover, results, staff and court scorers).
- Tests: engine (scoring + tournaments), live store, auth API and end-to-end flows against a
  throwaway schema built from the migrations (`src/test/harness.ts`).

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
