# ProjectX: Page-by-Page Testing Checklist

Built from the code on 2026-10-25 (commit 64654ac plus the uncommitted live-scoring changes). Updated the same day for notifications (migration `4_notifications`, bell on Home, page 11b).
Each page lists the API calls it makes, the tables it **reads** and **writes**, the **Redis** keys it touches, the **other services** it uses, and the checks to run.

**Legend:** **+** insert · **~** update · **−** delete · 🔴 Redis · 📱 on-device · ☁️ external service

**Contents:** Part 0 Architecture · A Services · B App launch · C Pages (§1–41) · D API-only features · E Table index (all 82 tables) · F Redis keys · G Things to check on purpose · H Cross-cutting checks

---

## Part 0: Architecture

```
 📱 Expo app (Expo Go / dev build, SDK 58)                 ☁️ Twilio SMS · Google · Apple
   src/app/*  (Expo Router routes, one-line re-exports)              ▲
   features/<f>/screens → features/<f>/api → shared/api/client.ts    │
        │  HTTPS JSON, Bearer access token (EXPO_PUBLIC_API_URL)     │
        ▼                                                            │
 Express API (backend/src/app.ts, server.ts on PORT)  ───────────────┘
   middleware: helmet → cors → json (100 kb; 5 mb for /media) → pino → routes → errorHandler
   modules/<m>: *.routes → (*.controller) → *.service → *.repository
        │                         │                          │
        ▼                         ▼                          ▼
 PostgreSQL (Neon, project_x)   🔴 Redis (Upstash, optional)   Public HTML pages /s/:token, /t/:slug
   raw SQL: auth, profile,        live:* scoring state + queue
   feed, social, chat, users,     auth:* session cache
   media, notifications           chat:* members / newest message
   Prisma: sports, players,     (in-process memory when REDIS_URL is unset)
   matches, tournaments
```

**Backend layers**
| Layer | Where | What to check |
|---|---|---|
| Composition | `app.ts` builds the app from injected deps; `server.ts` creates the real pool, Redis, SMS / Google / Apple providers, resumes unsent live-scoring queues, and shuts down on SIGTERM / SIGINT | [ ] The API starts with and without `REDIS_URL`; Ctrl+C stops it cleanly; unsent points are written after a restart |
| Modules | `auth`, `profile`, `users`, `feed`, `social`, `notifications`, `chat`, `media`, `sports`, `players`, `matches` (+ `live/`), `tournaments`, `public` | [ ] Every module's routes are in Swagger `/docs` (106 operations) |
| Engine | `src/engine/` (pure TS, no DB / HTTP): `scoring/` plugins `rally`, `side_out`, `tennis`; `tournament/` formats, seeding, advancement, standings; `rating/` Elo K=32 | [ ] `npm test` passes (engine tests + API flows) |
| Data | `database/pool.ts` (`pg`, timestamps read as UTC), `database/prisma.ts` (Prisma `relationJoins`: one query per `include` tree), migrations `0_baseline` … `4_notifications`, `seed.ts` (sports, formats, rulesets, type_master) | [ ] `npm run db:status` shows nothing pending |
| Responses | success `{success: true, data}`; failure `{success: false, error: {code, message, details?}}`; unknown errors → 500 `INTERNAL_ERROR` with no stack | [ ] An unknown path → 404 `NOT_FOUND` in the envelope; a bad body → 400 `VALIDATION_ERROR` with `details` |
| Auth | JWT access token (`ACCESS_TOKEN_TTL_SECONDS`) + rotating refresh token stored hashed in `auth_session` | see Part B |
| Logging | pino: method, path, status only | [ ] No passwords, codes or tokens appear in the API log |

**App layers**
| Layer | Where | What to check |
|---|---|---|
| Routing | `src/app/_layout.tsx` switches `(auth)` / `(app)` with `Stack.Protected` (`redirectTo="/welcome"`); `(app)/_layout.tsx` limits a new account to onboarding; `(tabs)/_layout.tsx` + `shared/ui/TabBar.tsx` | [ ] Signed out you can only reach auth pages; signing out lands on Welcome |
| API client | `shared/api/client.ts`: the only `fetch`; `ApiError {status, code, message}` (`status 0` = network), 15 s timeout (90 s for match create / finish / retire / walkover / abandon), one refresh on `ACCESS_TOKEN_EXPIRED` | Part H |
| State | Zustand stores (`auth.store`, theme, scoring prefs); `useResource` reloads on focus and polls; `useSubmit` for actions | [ ] Coming back to a screen shows changes made elsewhere |
| Live scoring | `features/match/hooks/useLiveScoring.ts` + `src/engine/scoring` (copy of the backend engine, `npm run sync-engine`) | §17 |
| Config | `frontend/.env` `EXPO_PUBLIC_API_URL` (must be this computer's **current** LAN IP for Expo Go on a phone), country code, Google client ids | [ ] After a Wi-Fi change, update the IP and restart `expo start --clear` |

**Polling (there are no websockets or push notifications)**
| What | Interval | Page |
|---|---|---|
| Live now strip | 15 s | Home |
| Notification badge | 30 s (and on focus) | Home |
| Chat list | 10 s | Chats |
| Chat thread new messages (`?after=`) | see §37 | chat/[id] |
| Spectator score | see §19 | match/[id]/watch |

**Backend environment variables** (`backend/.env`): `NODE_ENV`, `PORT`, `LOG_LEVEL`, `TRUST_PROXY`, `CORS_ORIGINS`, `DATABASE_URL`, `DATABASE_URL_DIRECT`, `DB_POOL_MAX`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `DEV_OTP_CODE`, `GOOGLE_CLIENT_IDS`, `APPLE_BUNDLE_IDS`, `API_DOCS`.
- [ ] Production refuses `SMS_PROVIDER=dev`; `/docs` is off in production unless `API_DOCS=true`

---

## Part A: Services used by the app

| Service | What it does | Configured by | Used on |
|---|---|---|---|
| **PostgreSQL** (Neon) | All data, including photos | `DATABASE_URL` (+ `DATABASE_URL_DIRECT` for migrations) | Every page |
| 🔴 **Redis** (Upstash) | Live match scoring state and write queue; auth session cache; chat cache | `REDIS_URL`. If it's missing, the same data is kept in process memory. | Scoring, every signed-in request, chat |
| ☁️ **Twilio SMS** | Sends OTP codes | `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. With `SMS_PROVIDER=dev` + `DEV_OTP_CODE`, nothing is sent and the code is fixed (not allowed in production). | Sign-up, phone login, forgot password |
| ☁️ **Google Sign-In** | Verifies the Google ID token (`google-auth-library`) | Backend `GOOGLE_CLIENT_IDS`; app `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Login, Settings |
| ☁️ **Apple Sign-In** | Verifies the Apple token against Apple's public keys (`https://appleid.apple.com`, via `jose`) | `APPLE_BUNDLE_IDS` | Login, Settings (iOS) |
| **Media storage** | **There is no S3 or cloud bucket.** Photos are stored as bytes in Postgres table `media_files` and served at `GET /media/:id` (public, cached for a year). | — | Sign-up details, edit profile, new post |
| **Public web pages** | HTML served by the backend: `/s/:token` (live match) and `/t/:slug` (tournament), with `/public-assets/page.js` | — | Share links |
| **Rate limiting** | In memory (`express-rate-limit`), **not Redis**. Per API process; a restart resets it. | — | Auth endpoints |
| **API docs** | Swagger at `/docs` (on outside production, or with `API_DOCS=true`) | — | Testing the API-only features (Part D) |
| 📱 **expo-secure-store** | Stores the session tokens (keychain), theme, and scoring prefs (keep awake, haptics) | — | Launch, login, Settings, scoring |
| 📱 **expo-image-picker + expo-image-manipulator** | Pick a photo, resize to ≤1600 px, re-encode as JPEG, then upload | — | Photo uploads |
| 📱 **Share sheet / Clipboard** | Share links (match, tournament, post, profile, podium); copy profile link | — | Several pages |
| 📱 **expo-haptics / expo-keep-awake** | Vibrate on each point, keep the screen on while scoring | — | Score screen, coin toss |

Setup checklist:
- [ ] `cd backend && npm run db:deploy`, then `npm run db:status` reports nothing pending
- [ ] `npm run db:seed` writes **+/~ sports, sport_formats, scoring_rulesets, type_master** and backfills **+ players, player_sports, player_ratings** from the legacy `usr_user` / `usr_user_sport` / `usr_sport_rating` tables. Running it again changes nothing.
- [ ] Set `REDIS_URL`. On startup there's no "REDIS_URL not set" warning. Keep `redis-cli MONITOR` open in a second terminal.
- [ ] Choose real Twilio or `SMS_PROVIDER=dev` with `DEV_OTP_CODE`
- [ ] Test users: **A** (you), **B** (opponent), **C** (staff/scorer), plus one phone number that isn't registered (for guests)

Useful queries:
```sql
SELECT * FROM <table> ORDER BY created_at DESC LIMIT 5;
-- Redis
redis-cli --scan --pattern 'live:*'   # also 'auth:*' and 'chat:*'
```

---

## Part B: App launch (runs before any page)
- 📱 Reads the saved session from secure-store
- `POST /auth/refresh` if the access token has expired (30 s before expiry), otherwise `GET /auth/me`
  - Reads: `auth_session`, `usr_user`, `usr_user_profile`
  - Writes: **~ auth_session** (`refresh_token_hash`, `expires_at`, `last_used_at`) on refresh
  - 🔴 Every signed-in request reads `auth:session:<sessionId>` and `auth:user-revoked:<userId>`. On a miss it checks `auth_session` in Postgres and sets `auth:session:<sessionId>` (60 s).
- [ ] Kill and reopen the app: you stay signed in, and `auth_session` gets a new `refresh_token_hash`
- [ ] Revoke the session in SQL (`UPDATE auth_session SET revoked_at = now()`): you're signed out within 60 s (when the cache expires)
- [ ] Replay an old refresh token: **~ auth_session.revoked_at** and 🔴 `auth:session:<id>` deleted, so the whole session is killed

---

## Part C: Pages

### Auth

#### 1. `welcome` (WelcomeScreen)
- No API calls. Buttons go to Login or Sign up.

#### 2. `signup` (SignupPhoneScreen)
| Action | API | Reads | Writes | Services |
|---|---|---|---|---|
| Type a username | `GET /auth/username-available` | `usr_user` | — | — |
| Continue | `POST /auth/register/start` | `usr_user` (taken checks) | **~ auth_otp** (expires older codes) · **+ auth_otp** (purpose registration, `user_id` NULL) | ☁️ Twilio SMS · rate limit per IP and per phone |
- [ ] A taken username or phone shows an error and adds no `auth_otp` row
- [ ] Too many requests return 429 `RATE_LIMITED`
- [ ] Twilio rejects the number → `INVALID_PHONE`; Twilio is down → `SMS_UNAVAILABLE`

#### 3. `signup-code` (CodeScreen, sign-up mode)
| Action | API | Reads | Writes |
|---|---|---|---|
| Enter code | `POST /auth/register/verify` | `auth_otp` (row locked) | **~ auth_otp** (`attempt_count` +1; `verified_at` if correct) |
| Resend | `POST /auth/register/start` | as in §2 | as in §2 + ☁️ SMS |
- [ ] A wrong code increases `attempt_count`; after `max_attempts` you get "Too many incorrect codes"
- [ ] An older code stops working after a resend

#### 4. `signup-details` (SignupDetailsScreen)
| Action | API | Reads | Writes | Services |
|---|---|---|---|---|
| Add a photo | `POST /api/v1/media` | — | **+ media_files** | 📱 image picker + resize · stored in Postgres |
| Create account | `POST /auth/register/complete` | `usr_user` (taken checks) | **+ usr_user** · **+ usr_user_profile** · **+ auth_password_history** · **+ players** · **+ auth_session** | 📱 tokens saved to secure-store |
| Save details | `PATCH /profile/me` | `usr_user`, `usr_user_profile` | **~ usr_user_profile** (`profile_photo` = `/media/<id>`, bio, city) · maybe **~ players.display_name** | — |
- [ ] `usr_user.is_phone_verified` is true and `last_login_at` is set
- [ ] There's **no** `auth_login_log` row for the sign-up
- [ ] A photo over 3 MB → `MEDIA_TOO_LARGE`; a file that isn't JPEG, PNG or WebP → `MEDIA_INVALID`
- [ ] The registration token expires → `REGISTRATION_EXPIRED`

#### 5. `login` (LoginScreen)
| Action | API | Reads | Writes | Services |
|---|---|---|---|---|
| Password sign-in | `POST /auth/login` | `usr_user` | **~ usr_user.last_login_at** · **+ auth_login_log** · **+ auth_session** | rate limit · 📱 secure-store |
| "Use a code" | `POST /auth/phone/start` | `usr_user` | **~/+ auth_otp** (registered phones only; else 404 `NO_ACCOUNT`) | ☁️ Twilio |
| Google | `POST /auth/google` | `auth_identity`, `usr_user` | maybe **+ auth_identity** (auto-link by email) · **~ usr_user** · **+ auth_login_log** · **+ auth_session** | ☁️ Google token check |
| Apple | `POST /auth/apple` | same | same | ☁️ Apple public keys |
- [ ] A wrong password → **+ auth_login_log** (failed, `wrong_password`)
- [ ] An unknown user → **+ auth_login_log** (`unknown_account`, `user_id` NULL)
- [ ] A suspended user → `account_disabled` logged
- [ ] Code login for an unregistered phone → "No account uses these details" (404 `NO_ACCOUNT`); no `auth_otp` row and no SMS
- [ ] Code login for a suspended account → 403 `ACCOUNT_DISABLED`; no SMS
- [ ] Google/Apple not configured → 503 `PROVIDER_NOT_CONFIGURED`

#### 6. `login-code` (CodeScreen, login mode)
| API | Reads | Writes |
|---|---|---|
| `POST /auth/phone/verify` | `usr_user`, `auth_otp` | **~ auth_otp** · **~ usr_user** (`last_login_at`, `is_phone_verified`) · **+ auth_login_log** (method otp) · **+ auth_session** |
- [ ] A wrong code → **+ auth_login_log** (`invalid_code`)

#### 7. `forgot-password` and `settings/password` (ForgotPasswordScreen)
| Action | API | Reads | Writes | Redis / services |
|---|---|---|---|---|
| Request a code | `POST /auth/password/forgot` | `usr_user` | **~/+ auth_otp** (purpose password_reset); unknown account → 404 `NO_ACCOUNT`, suspended → 403 | ☁️ Twilio |
| Set a new password | `POST /auth/password/reset` | `usr_user`, `auth_otp` | **~ auth_otp** · **~ usr_user.password_hash** · **+ auth_password_history** · **~ auth_session.revoked_at** (every session) | 🔴 sets `auth:user-revoked:<userId>` (65 s) |
| (from Settings) | then signs out | — | see Sign out in §40 | 📱 secure-store cleared |
- [ ] Works with the username, email or phone (any case, with spaces in the number); dev code `123456`
- [ ] An unknown phone/username shows "No account uses these details" and stays on the first step (no "We texted a code")
- [ ] A suspended account → "This account has been disabled"
- [ ] Sending twice: only the newest code works; a used code can't be reused
- [ ] Other devices are rejected on their next request
- [ ] The old password fails and the new one works

---

### Onboarding

#### 8. `onboarding/details` (SignupDetailsScreen, after sign-in)
- `PATCH /profile/me` (+ `POST /media` for a photo). Tables are the same as §4 "Save details" and §38.

#### 9. `onboarding/sports` (PickSportsScreen)
| Action | API | Reads | Writes |
|---|---|---|---|
| Load | `GET /sports`, `GET /players/claimable` | `sports`, `sport_formats`, `scoring_rulesets`; `usr_user`, `players`, `match_participants`, `match_sides`, `matches` | — |
| Save | `PUT /profile/me/sports` | `sports`, `players` | **− player_sports** (un-ticked) · **~ player_sports.is_primary** (old primary cleared) · **+/~ player_sports** |
- [ ] Exactly one row with `is_primary = true` per player
- [ ] Only goes to the claim page if there's something to claim

#### 10. `onboarding/claim` (ClaimMatchesScreen)
Setup: A plays and completes a match with a guest who has B's phone, then B signs up with that phone.
| Action | API | Reads | Writes |
|---|---|---|---|
| Load | `GET /players/claimable` | `usr_user`, `players` (guests with your verified phone), `match_participants`, `match_sides`, `matches`, `sports` | — |
| Claim | `POST /players/claim` | `players` | **~ match_participants.player_id** · **~ team_members.player_id** · **~ tournament_entry_members.player_id** · **+ player_sports** (copied) · **− player_sports** (guest's) · **− / + player_sport_stats** (guest's removed, yours rebuilt) · **− player_ratings** (guest's) · **~ players** (guest: `merged_into_id`, `claimed_at`) |
- [ ] An unverified phone → `PHONE_NOT_VERIFIED`
- [ ] The claimed matches show in Profile → Matches, and your records go up
- ⚠ The guest's `player_rating_history` and `match_confirmations` rows are not moved

---

### Tabs

#### 11. Home `(tabs)/index` (HomeScreen)
| Action | API | Reads | Writes | Redis |
|---|---|---|---|---|
| Feed | `GET /feed` | `social_post`, `social_post_media`, `social_post_like`, `social_post_comment`, `usr_user`, `usr_user_profile`, `usr_user_follow`, `usr_user_block`, `players`, `matches`, `match_sides`, `match_participants`, `sports`, `sport_formats`, `venues`, `player_rating_history` | — | — |
| Live now (polled) | `GET /matches/live` | `usr_user_follow`, `matches`, `match_sides`, `match_participants`, `players`, `match_scorers`, `sports` | — | 🔴 MGET `live:match:<id>` for each live match (newest score) |
| Waiting for you | `GET /matches/pending-confirmations` | `matches` (`verification = pending`), sides, participants, players | — | — |
| Tap a live card | `GET /matches/:id` | see §17 | — | 🔴 reads, or primes on a miss |
| Like | `PUT/DELETE /posts/:id/like` | `social_post_like` | **+ / − social_post_like** · **+ / − notification** (type 1401, to the post's author) | — |
| Bell badge (on focus, then every 30 s) | `GET /notifications/unread` | `notification`, `usr_user` (actor active), `usr_user_block`, `social_post` (post still exists) | — | — |
| Tap the bell | → §11b | — | — | — |
- [ ] The bell shows a red count when you have unread notifications, nothing when you have none, and `99+` above 99
- [ ] Pull to refresh on Home also refreshes the badge
- [ ] Live now shows matches you play in, created, can score, or that people you follow are playing (follow status 1)
- [ ] The live card score changes while someone scores on another device (comes from Redis)
- [ ] Feed posts from blocked users are hidden (needs a manual `usr_user_block` row, see Part D)

#### 11b. `notifications` (NotificationsScreen), opened from the bell on Home
| Action | API | Reads | Writes |
|---|---|---|---|
| Open (and every time it comes back into focus) | `GET /notifications` | `notification`, `usr_user` + `usr_user_profile` (actor name, photo), `usr_user_block`, `social_post` | — |
| Clears the badge (only when something was unread) | `POST /notifications/read` | — | **~ notification** (`is_read = true`, `read_at`) |
| Scroll to the end | `GET /notifications?cursor=<last id>` (30 per page) | same | — |
| Tap a like / comment / new-post row | → `post/[id]` (§34) | — | — |
| Tap a follow row | → `user/[id]` (§36) | — | — |

What creates a notification (all go to `notification` with `actor_id` = who did it):
| Type (`notification_type_id`) | Created when | Goes to | Title / message | Removed when |
|---|---|---|---|---|
| 1401 Like | `PUT /posts/:id/like` (home, post/[id]) | the post's author | "<name> liked your post" | unlike (`DELETE /posts/:id/like`) |
| 1402 Comment | `POST /posts/:id/comments` (post/[id]) | the post's author | "<name> commented on your post" / the comment (first 140 chars) | — (stays after the comment is deleted) |
| 1403 New post | `POST /posts` (post/new) | everyone who follows the author (status 1) | "<name> shared a new post" / the post text (first 140 chars) | the post is deleted |
| 1404 Follow | `PUT /users/:id/follow` (search, user/[id]) | the person followed | "<name> started following you" | unfollow (`DELETE /users/:id/follow`) |

- [ ] Run `npm run db:status`: `4_notifications` is applied; `notification.actor_id` exists and `type_master` has rows 1401–1404
- [ ] B likes A's post → A's bell shows 1; the row reads "B liked your post" with a heart on B's avatar; tapping opens the post
- [ ] B likes, unlikes and likes again → still exactly one like row for A (`SELECT count(*) FROM notification WHERE actor_id = '<B>' AND notification_type_id = 1401`)
- [ ] B unlikes → A's like notification is deleted
- [ ] B comments "Nice!" → A sees "B commented on your post" with "Nice!" under it; every comment adds one row
- [ ] A likes or comments on A's own post → **no** row
- [ ] B follows A → A sees "B started following you"; tapping opens B's profile. Unfollow → the row is gone; follow again → one new row, never two
- [ ] B (who follows A) gets "A shared a new post" when A posts, for public **and** followers-only posts. C (not following) gets nothing
- [ ] A deletes the post → its like / comment / new-post rows are deleted (and the list never shows a notification for a post that no longer exists)
- [ ] Match-result posts (type 801, written when a match is decided) do **not** notify followers
- [ ] Opening the screen: unread rows are highlighted with a red dot; going back to Home shows no badge; reopening shows them as read
- [ ] Block A ↔ B in SQL (`usr_user_block`): B's notifications disappear from A's list and count, and B's new likes / comments / follows create no rows
- [ ] A suspended or deleted actor (`usr_user.status` ≠ 1) is hidden from the list and the count
- [ ] Empty state: a brand-new account sees "No notifications yet"
- [ ] `POST /notifications/:id/read` with someone else's notification id → 404 `NOTIFICATION_NOT_FOUND`
- [ ] Not real-time push: a new notification appears on the badge within 30 s while Home is open, or immediately when Home comes back into focus

#### 12. Tournaments `(tabs)/tournaments` (TournamentListScreen)
| API | Reads | Writes |
|---|---|---|
| `GET /tournaments?filter=all/open/live/mine&q=` | `tournaments`, `tournament_staff`, `tournament_events`, `tournament_entries`, `tournament_entry_members`, `players`, `venues`, `sports` | — |
- [ ] Each filter shows the right tournaments; private tournaments only show for staff and entrants

#### 13. Chats `(tabs)/chats` (ChatListScreen)
| API | Reads | Writes |
|---|---|---|
| `GET /conversations`, `GET /conversations/unread` | `chat_conversation`, `chat_conversation_member`, `chat_message`, `usr_user`, `usr_user_profile`, `players` | — |
- [ ] The unread count matches messages newer than your `last_read_at`

#### 14. Profile `(tabs)/profile` (ProfileScreen)
| API | Reads | Writes |
|---|---|---|
| `GET /profile/me` | `usr_user`, `usr_user_profile`, `players`, `player_sports`, `sports`, `player_sport_stats`, `player_ratings`, `player_rating_history` (trend), `usr_user_follow` (counts) | — |
| `GET /profile/me/matches` | `matches`, `match_sides`, `match_participants`, `players`, `sports`, `sport_formats`, `tournaments`, `tournament_events`, `tournament_stages`, `fixtures` | — |
| Photo | `GET /media/:id` | `media_files` | — |
| Tap the photo | — | — | — |
| Tap followers / following | opens §36b | — | — |
- [ ] Wins and losses equal `player_sport_stats`; the rating equals `player_ratings.rating`
- [ ] Abandoned matches aren't listed
- [ ] Tapping the photo enlarges it (springs up over a dimmed screen with the name and @username); a tap anywhere or Android Back closes it. With no photo (initials), tapping does nothing
- [ ] Follower / following counts leave out suspended accounts, and match the lists in §36b

---

### Friendly match

#### 15. `match/new` (NewMatchSportScreen)
| API | Reads | Writes |
|---|---|---|
| `GET /sports`, `GET /players/me` | `sports`, `sport_formats`, `scoring_rulesets`; `players` | **+ players** only if your user has none yet (older accounts) |

#### 16. `match/setup` (NewMatchSetupScreen) + Add player sheet
| Action | API | Reads | Writes |
|---|---|---|---|
| Search players | `GET /players?q=&sport=` | `usr_user`, `usr_user_profile`, `players`, `player_ratings`, `sports`, `usr_user_block` | — |
| Recent guests | `GET /players/guests` | `players` | — |
| Add a new guest | (created when the match is created, §16b) | — | — |
- [ ] Blocked users don't appear in search
- [ ] The required number of players per side follows `sport_formats` (`min_per_side` / `max_per_side`)

#### 16b. `match/serve` (ServeFirstScreen): Start match
| API | Reads | Writes | Redis |
|---|---|---|---|
| `POST /matches` (90 s timeout) | `sports`, `sport_formats`, `scoring_rulesets`, `players`, `usr_user`, `venues` | **+ venues** (if the venue name is new) · **+ players** (each new guest; any registered user missing a player row) · **+ matches** (live, friendly, `ruleset_config` snapshot, `share_token`, `summary`) · **+ match_sides** · **+ match_participants** · **+ match_segments** · **+ match_segment_scores** | 🔴 primed on the first read (§17) |
- 📱 coin toss uses haptics
- [ ] The same player on both sides, or the wrong player count → error, and **nothing** is written (one transaction)
- [ ] Rule overrides are stored in `matches.ruleset_config`

#### 17. `match/[id]` (ScoreScreen), the main Redis page
| Action | API | Writes (Postgres) | Redis |
|---|---|---|---|
| Open | `GET /matches/:id` | — | 🔴 GET `live:match`; on a miss, load from Postgres and **prime** `live:match` + `live:version` (24 h) |
| Watch (polled every 4 s) | `GET /matches/:id` | — | 🔴 reads `live:match` |
| Point | `POST /matches/:id/events` (`version`, `clientEventId`) | right after: **+ match_events** · **+/~ match_segments** · **+/~ match_segment_scores** · **~ matches** (`version`, `summary`) | 🔴 Lua compare-and-set: SET `live:match` + `live:version`, RPUSH `live:queue:<id>`, SADD `live:pending`. Once saved: LTRIM the queue, SREM `live:pending`. |
| Undo | `POST /matches/:id/undo` | **~ match_events** (`voided_at`, `voided_by_user_id`) · segments · matches | 🔴 same as a point |
| ⋯ → Add scorer | `GET /users/search`, `POST /matches/:id/scorers` | **+ match_scorers** | 🔴 DEL `live:match` + `live:version` (rebuilt on the next read) |
| ⋯ → Share live link | — | — | 📱 share sheet → `/s/<share_token>` |
| ⋯ → A side retired | `POST /matches/:id/retire` | see §18 | 🔴 the queue is flushed first, then the keys are deleted |
| ⋯ → Walkover / no-show (before the first point) | `POST /matches/:id/walkover` | see §18 | 🔴 flush, then delete |
| ⋯ → Abandon | `POST /matches/:id/abandon` | **~ matches** (abandoned, `completed_at`, `summary`) only | 🔴 flush, then delete |
| Match over → Finish | `POST /matches/:id/complete` | see §18 | 🔴 flush, then delete |
- 📱 Keep-awake while scoring; haptics on each point; both settings saved in secure-store
- [ ] After a point, `match_events` gets one row and `live:pending` empties within about a second
- [ ] `live:version` = `matches.version` = number of events (voided ones included)
- [ ] Sending the same point twice (same `clientEventId`) adds only one row
- [ ] Two devices tap at the same time → one gets `STALE_MATCH` and refreshes
- [ ] Stop the backend right after tapping, then restart → `resumePending` writes the queued events
- [ ] `FLUSHDB` mid-match → the next read reloads from Postgres, and scoring continues correctly
- [ ] Someone who isn't a scorer → `NOT_MATCH_SCORER`; after the match ends → `MATCH_NOT_LIVE`
- [ ] Walkover after points were played → `MATCH_STARTED`; abandon on a tournament match → `TOURNAMENT_MATCH`
- [ ] Undo with nothing to undo → `NOTHING_TO_UNDO`
- [ ] Without Redis (`REDIS_URL` unset): it still works, but the data is in memory; in production each tap waits for Postgres

#### 18. `match/[id]/result` (MatchResultScreen)
| Action | API | Reads |
|---|---|---|
| Open | `GET /matches/:id` | `matches`, `match_sides`, `match_participants`, `players`, `match_events`, `player_rating_history`, `match_confirmations`, `sports`, `venues` |
| Share | — | 📱 share sheet |

Writes made when the match ended:
| Ending | Writes |
|---|---|
| **Complete** | **~ matches** (completed, `result_type` played, `completed_at`, `summary`, `version`, `verification` not_required) · **~ match_sides.outcome** · **~ match_segments / scores** · **− / + player_sport_stats** · **− / + team_stats** (only if a side has a team) · **+/~ player_ratings** + **+ player_rating_history** (only if every player is registered and there are 2 sides) · **+ social_post** (type 801, public) · the advancement writes from §32 if it's a fixture |
| **Retire** | Same, with status/result_type retired; the post says "(ret.)" |
| **Walkover / no-show / double** | Same, but **no** ratings and **no** social post; a double walkover makes both sides lost |
| **Abandon** | Only **~ matches**: no stats, ratings or post |
- [ ] A match with any guest → no `player_ratings` change
- [ ] The rating change shown equals `player_rating_history.rating_after − rating_before`

#### 19. `match/[id]/watch` (SpectatorScreen)
| API | Reads | Redis |
|---|---|---|
| `GET /matches/:id` (polled every 4 s), `GET /matches/:id/details` | as in §18, plus `usr_user`, `usr_user_profile`, `player_ratings` | 🔴 reads `live:match` |
- [ ] The score updates within about 4 s of a tap on the scoring device

#### 20. `match/enter` (EnterResultScreen): enter a past result
| API | Writes |
|---|---|
| `POST /matches` with `manualScores` (+ `playedOn`) | Everything in §16b, plus **+ match_events** (replayed) · **~ matches** (`scoring_mode` manual, completed, `verification` **pending** if the other side has a registered player, otherwise not_required; `started_at` = `completed_at` = the played-on date at 12:00 UTC) · **~ match_sides.outcome** · segments · **− / + player_sport_stats** · **team_stats** · **+ social_post** (801) · ❌ **no ratings** until confirmed |
- 🔴 no Redis: the match is never live
- [ ] Impossible scores → `INVALID_RESULT`, nothing written
- [ ] The opponent (B) sees it under Home → "Waiting for you"

#### 21. `match/[id]/confirm` (ConfirmResultScreen)
| Action | API | Writes |
|---|---|---|
| Load | `GET /matches/:id`, `GET /matches/:id/details` | — |
| Confirm | `POST /matches/:id/confirm` `{decision: confirmed}` | **+ match_confirmations** · **~ matches.verification = confirmed** · **+/~ player_ratings** · **+ player_rating_history** |
| Dispute | `POST /matches/:id/confirm` `{decision: disputed, comment}` | **+ match_confirmations** · **~ matches** (`verification` and `status` disputed) · **− / + player_sport_stats** · **team_stats** (the match no longer counts) |
- [ ] The creator or their partner tries to confirm → `NOT_OPPONENT`; confirming twice → `NOT_PENDING`
- ⚠ A dispute leaves the `social_post` in place
- ⚠ While pending, the match already counts in `player_sport_stats`

---

### Tournaments

#### 22. `tournament/new` (CreateTournamentScreen)
| API | Writes |
|---|---|
| `POST /tournaments` | **+ venues** (if a new name) · **+ tournaments** (slug, draft, organizer) · **+ tournament_staff** (organizer) |

#### 23. `tournament/[id]` (TournamentPageScreen)
| API | Reads | Services |
|---|---|---|
| `GET /tournaments/:id` | `tournaments`, `tournament_staff`, `tournament_events`, `tournament_entries`, `tournament_entry_members`, `players`, `courts`, `court_scorers`, `venues`, `sports`, `usr_user`, `usr_user_profile` | 📱 share sheet → public `/t/<slug>` |

#### 24. `tournament/[id]/manage` (OrgDashboardScreen)
| Action | API | Writes |
|---|---|---|
| Edit / change status | `PATCH /tournaments/:id` | **~ tournaments** |
| Open / close an event's registration | `PATCH /tournament-events/:id` | **~ tournament_events.status**; opening it also does **~ tournaments.status** draft → registration_open |
| Share public page | — | 📱 share sheet |
- [ ] A non-organizer → forbidden

#### 25. `tournament/[id]/event/new` (AddEventScreen)
| API | Reads | Writes |
|---|---|---|
| `GET /sports`, `POST /tournaments/:id/events` | `sports`, `sport_formats`, `scoring_rulesets`, `tournament_events` (count) | **+ tournament_events** (`format`, `format_config`, `tiebreakers`, `rules_override`, `max_entries`) |
- [ ] A duplicate name, invalid rules or invalid draw settings → validation error

#### 26. `tournament/[id]/staff` (StaffCourtsScreen)
| Action | API | Writes | Redis |
|---|---|---|---|
| Pick a user | `GET /users/search` | — | — |
| Add staff | `POST /tournaments/:id/staff` | **+/~ tournament_staff** | 🔴 DEL `live:match` / `live:version` for every live fixture in the tournament |
| Remove staff | `DELETE /tournaments/:id/staff/:userId/:role` | **− tournament_staff** | 🔴 same |
| Add court | `POST /tournaments/:id/courts` | **+ courts** | — |
| Assign court scorer | `POST /courts/:id/scorers` (`replace`) | **− court_scorers** (others, if replace) · **+ court_scorers** | 🔴 same as add staff |
| Remove court scorer | `DELETE /courts/:id/scorers/:userId` | **− court_scorers** | 🔴 same |
- [ ] A newly added scorer can score a live fixture right away (the cache was dropped)

#### 27. `tournament/[id]/courts` (CourtBoardScreen)
| Action | API | Writes |
|---|---|---|
| Board | `GET /tournaments/:id`, `GET /tournaments/:id/fixtures` | — (reads `fixtures`, `matches`, `courts`, `stage_groups`, `tournament_stages`, entries, players) |
| Start on court | `POST /fixtures/:id/start` | see §32 "Start" |

#### 28. `tournament/[id]/register` (RegisterScreen)
| API | Writes |
|---|---|
| `GET /tournaments/:id`, `GET /sports`, `POST /tournament-events/:id/entries` | **+ players** (guest partner / missing player) · **+ tournament_entries** (pending; approved if added by the organizer) · **+ tournament_entry_members** |
- [ ] Registration closed → `REGISTRATION_CLOSED`; full → error; already entered → error; after the draw → `ALREADY_DRAWN`

#### 29. `tournament/[id]/schedule` (ScheduleScreen)
| API | Writes |
|---|---|
| `GET /tournaments/:id/fixtures`, `PATCH /fixtures/:id` (court, time) | **~ fixtures** (`court_id`, `scheduled_at`) · **~ matches.court_id** if the match exists |
- [ ] A court from another tournament → `Unknown court`

#### 30. `tournaments/mine` (MyMatchesScreen)
| Action | API | Writes |
|---|---|---|
| Load | `GET /tournaments/me/matches` | — (reads fixtures, entries, matches, tournaments) |
| Withdraw my entry | `PATCH /entries/:id` `{status: withdrawn}` | **~ tournament_entries.status** |
| Start (as scorer) | `POST /fixtures/:id/start` | see §32 |

#### 31. Event pages: `event/[id]` (EventPageScreen), `event/[id]/entries` (EntriesScreen), `event/[id]/draw` (DrawScreen), `event/[id]/bracket` (BracketScreen), `event/[id]/groups` (GroupsScreen), `event/[id]/podium` (PodiumScreen)
| Page | Action | API | Writes |
|---|---|---|---|
| `event/[id]` | View | `GET /tournament-events/:id` | — (reads `tournament_events`, entries, members, players, `tournament_stages`, `stage_groups`, `stage_group_entries`, `fixtures`, `matches`, `match_sides`) |
| `entries` | Add an entry (organizer) | `POST /tournament-events/:id/entries` | as §28 (approved) |
| `entries` | Approve / reject / seed | `PATCH /entries/:id` | **~ tournament_entries** (status, seed) |
| `entries` | Open / close registration | `PATCH /tournament-events/:id` | **~ tournament_events** (+ tournaments) |
| `draw` | Preview | `POST /tournament-events/:id/draw` `{preview: true}` | **nothing** |
| `draw` | Make the draw | `POST …/draw` `{preview: false, randomSeed}` | **+ tournament_stages** · **+ stage_groups** · **+ stage_group_entries** · **+ fixtures**, then **~ fixtures** (next / loser-next links, entries, status ready/bye/pending) · **~ tournament_events.status = drawn** |
| `draw` | Reset | `DELETE …/draw` | **− tournament_stages**, which cascades to **− stage_groups, stage_group_entries, fixtures** · **~ tournament_events.status = registration_closed** |
| `bracket` / `groups` / `podium` | View | `GET /tournament-events/:id` | — · 📱 share on the podium |
- [ ] The same seed gives the same draw; byes advance automatically
- [ ] Reset after a fixture has started → error

#### 32. `fixture/[id]` (FixtureScreen) and `fixture/[id]/result` (FixtureResultScreen)
| Action | API | Writes | Redis |
|---|---|---|---|
| Court / time | `PATCH /fixtures/:id` | as §29 | — |
| Assign scorer | `POST /courts/:id/scorers` | as §26 | 🔴 DEL live keys |
| **Start** | `POST /fixtures/:id/start` | **+ matches** (tournament) · **+ match_sides** (`entry_id`) · **+ match_participants** · **+ match_segments / scores** · **~ fixtures** (`match_id`, live) · **~ tournament_events** → in_progress · **~ tournaments** → in_progress · **~ tournament_stages** → in_progress | 🔴 primed on the first read; scoring then works as in §17 |
| Walkover / no-show | `POST /fixtures/:id/walkover` | Start (if needed), then the walkover writes (§18), then **advancement** (below) | 🔴 DEL |
| Enter result | `POST /fixtures/:id/result` | Start (if needed), then **+ match_events**, the complete writes (§18, ratings applied, `verification` not_required), then **advancement** | 🔴 DEL before and after |

**Advancement** (runs inside the same transaction when any tournament match is decided):
**~ fixtures** (this one: winner, completed) · **~ fixtures** (next round: entry filled, status ready) · loser into the 3rd-place fixture · when a group is finished, its qualifiers go into knockout fixtures (from standings + tiebreakers) · **~ tournament_stages** → completed · **~ tournament_events** → completed · **~ tournaments** → completed once every event is done.
- [ ] Not ready → `FIXTURE_NOT_READY`; not staff → `NOT_TOURNAMENT_STAFF`; a result while live scoring has started → `MATCH_STARTED`
- [ ] Starting twice returns the same match
- [ ] After the final, the podium shows the right winners and the tournament status is completed

---

### Social, people, settings

#### 33. `post/new` (NewPostScreen)
| Action | API | Writes | Services |
|---|---|---|---|
| Add photos | `POST /media` (one per photo) | **+ media_files** | 📱 picker + resize · photos in Postgres |
| Post | `POST /posts` | **+ social_post** (`attached_match_id` optional) · **+ social_post_media** (`media_url`, `media_order`) · **+ notification** (type 1403, one per follower) | — |
- [ ] Attaching someone else's match → error; an unknown media id → "Upload the photos first"

#### 34. `post/[id]` (PostDetailScreen)
| Action | API | Writes |
|---|---|---|
| View | `GET /posts/:id`, `GET /posts/:id/comments` | — |
| Like / unlike | `PUT/DELETE /posts/:id/like` | **+ / − social_post_like** (liking twice still makes one row) · **+ / − notification** (type 1401) |
| Comment | `POST /posts/:id/comments` | **+ social_post_comment** · **+ notification** (type 1402, unless it's your own post) |
| Share | — | 📱 share sheet |

#### 35. `search` (SearchScreen)
| Action | API | Writes |
|---|---|---|
| Search people / tournaments | `GET /users/search`, `GET /tournaments?q=` | — (reads `usr_user`, `usr_user_profile`, `usr_user_follow`, `usr_user_block`, `players`, `player_ratings`) |
| Follow / unfollow | `PUT/DELETE /users/:id/follow` | **+/~ usr_user_follow** (status 1) / **− usr_user_follow** · **+ / − notification** (type 1404) |

#### 36. `user/[id]` (PlayerProfileScreen)
| Action | API | Writes | Redis / services |
|---|---|---|---|
| View | `GET /users/:id`, `/users/:id/matches` | — (reads profile, `player_ratings`, follows, head-to-head from `matches` / `match_sides` / `match_participants`) | — |
| Follow | `PUT/DELETE /users/:id/follow` | as §35 | — |
| Message | `POST /conversations` `[userId]` | **+ chat_conversation** (direct, `direct_key`) · **+ chat_conversation_member** ×2; an existing chat is reused | — |
| Share / copy link | — | — | 📱 share sheet / clipboard |
- [ ] Following yourself → `CANNOT_FOLLOW_SELF`
- [ ] Tapping the photo enlarges it, as in §14; the followers / following counts open §36b

#### 36b. `follows/[id]` (FollowListScreen), from the counts on §14 and §36
| Action | API | Reads | Writes |
|---|---|---|---|
| Followers / Following tabs, search, scroll | `GET /users/:id/followers`, `GET /users/:id/following` (`q`, `cursor`, `limit` ≤ 50) | `usr_user_follow`, `usr_user`, `usr_user_profile`, `usr_user_block`, `players`, `player_ratings` | — |
| Follow / Following / Follow back on a row | `PUT/DELETE /users/:id/follow` | — | as §35 |
| Remove (my followers only, after a confirm) | `DELETE /users/me/followers/:id` | — | **− usr_user_follow** (them → me) · **− notification** (their type 1404 to me) |
- [ ] Newest first; scrolling loads 30 more at a time with no repeats or gaps
- [ ] Search matches a username prefix (with or without @) or any part of the name; `%` and `_` match literally
- [ ] My followers: each row has **Remove**, plus "· Follow" when I don't follow them back. Remove asks first, the row disappears, and the count drops
- [ ] Removing someone doesn't notify them; they can follow again later
- [ ] My following: **Following** unfollows and the row turns to **Follow**; the "following" count updates
- [ ] Someone else's lists: Follow / Following / **Follow back** (when they follow me), "· Follows you", and my own row says "· You" with no button
- [ ] Tapping a row opens their profile (my own row opens my Profile tab)
- [ ] Suspended accounts and anyone I blocked (or who blocked me) aren't listed
- [ ] Unknown user → "Player not found"; a bad cursor or limit → `VALIDATION_ERROR`

#### 37. `chat/[id]` (ChatThreadScreen)
| Action | API | Writes | Redis |
|---|---|---|---|
| Open | `GET /conversations/:id`, `GET /users/:id` | — | 🔴 `chat:members:<id>` set on a miss (10 min) |
| Poll every 3 s | `GET /conversations/:id/messages?after=<lastId>` | — | 🔴 if `after` = `chat:last:<id>`, returns `[]` without a Postgres query |
| Send (text or a match) | `POST /conversations/:id/messages` | **+ chat_message** · **~ chat_conversation** (`last_message_at`) · **~ chat_conversation_member.last_read_at** (sender) | 🔴 SET `chat:last:<id>` (1 h) |
| Delete own message | `DELETE /conversations/:id/messages/:mid` | **~ chat_message.deleted_at** | 🔴 DEL `chat:last:<id>` |
| Mark read | `POST /conversations/:id/read` | **~ chat_conversation_member.last_read_at** | — |
- [ ] B sees A's message within about 3 s
- [ ] After a delete, the other side sees it removed on the next poll
- [ ] Messaging someone who blocked you → `CANNOT_MESSAGE`; sharing a match that isn't yours → error

#### 38. `profile/edit` (EditProfileScreen)
| Action | API | Writes | Services |
|---|---|---|---|
| Username check | `GET /auth/username-available` | — | — |
| Photo | `POST /media` | **+ media_files** | 📱 picker · Postgres storage |
| Save | `PATCH /profile/me` | **+ usr_user_profile** (only if missing) · **~ usr_user_profile** (name, bio, city, `profile_photo`) · **~ players.display_name** · **~ usr_user.username** | — |
| Sports | `PUT /profile/me/sports` | as §9 | — |
- [ ] A taken username → error, nothing written
- ⚠ The old photo stays in `media_files`

#### 39. `profile/matches` (MatchHistoryScreen)
- `GET /profile/me/matches?sport=`: read only (the same tables as §14)

#### 40. `settings` (SettingsScreen)
| Action | API | Writes | Redis / services |
|---|---|---|---|
| Devices | `GET /auth/sessions` | — (reads `auth_session`) | — |
| Sign out other devices | `POST /auth/sessions/sign-out-others` | **~ auth_session.revoked_at** (all except this one) | 🔴 DEL `auth:session:<id>` for each |
| Linked accounts | `GET /auth/identities` | — | — |
| Link Google / Apple | `POST /auth/identities/google` / `POST /auth/identities/apple` | **+/~ auth_identity** | ☁️ Google / Apple |
| Unlink | `DELETE /auth/identities/:provider` | **− auth_identity** | — |
| Theme | — | — | 📱 secure-store |
| Change password | → `settings/password` (§7) | | |
| **Sign out** | `POST /auth/logout` | **~ auth_session.revoked_at** · **+ auth_login_log** (action logout) | 🔴 DEL `auth:session:<id>` · 📱 secure-store cleared |
- [ ] An identity already linked to another account → "identity in use"
- [ ] After signing out, the old access token is rejected right away

#### 41. Public web pages (browser, signed out)
| URL | API | Reads | Redis |
|---|---|---|---|
| `/s/<share_token>` | `GET /api/v1/public/matches/:token` | `matches` (by `share_token`), then the same as §18 | 🔴 reads / primes `live:match` while the match is live |
| `/t/<slug>` | `GET /api/v1/public/tournaments/:slug`, `/public/tournament-events/:id` | `tournaments`, events, fixtures, entries, players | — |
- [ ] Works signed out; a private tournament isn't shown

---

## Part D: Features with an API but no screen (test them in Swagger at `/docs` or with curl)
| Feature | API | Writes | Redis |
|---|---|---|---|
| Delete own post | `DELETE /posts/:id` | **− social_post**, which cascades to **− social_post_like, social_post_comment, social_post_media** (`media_files` kept) · **− notification** (every row about the post). Only user posts can be deleted, not match-result posts (801). | — |
| Delete own comment | `DELETE /posts/:id/comments/:cid` | **− social_post_comment** | — |
| Group chat | `POST /conversations` with 2+ users and a title | **+ chat_conversation** · **+ chat_conversation_member** (the creator is admin) | — |
| Add members | `POST /conversations/:id/members` | **+ chat_conversation_member**, or **~** (rejoin: `left_at` NULL) | 🔴 DEL `chat:members:<id>` |
| Leave chat | `POST /conversations/:id/leave` | **~ chat_conversation_member** (`left_at`, `is_admin` false; the oldest member becomes admin if needed) | 🔴 DEL `chat:members:<id>` |
| Claim from the match screen | `POST /players/claim` (no ids = all) | as §10 | — |
| Mark one notification read | `POST /notifications/:id/read` | **~ notification** (`is_read`, `read_at`); someone else's id → 404 `NOTIFICATION_NOT_FOUND` | — |
| One sport | `GET /sports/:slug` (e.g. `badminton`) | — (reads `sports`, `sport_formats`, `scoring_rulesets`); unknown slug → 404 `SPORT_NOT_FOUND` | — |
| Fixtures I can score | `GET /fixtures/mine` | — (reads `court_scorers`, `tournament_staff`, `fixtures`, `matches`); the same list is part of `GET /tournaments/me/matches` (§30) | — |
| Health check | `GET /health` (no login) | — → `{status: "ok"}` | — |
| API docs | `GET /docs` (Swagger UI) | — | — |
| Block a user | **no API**: `INSERT INTO usr_user_block (blocker_id, blocked_id) VALUES (...)` | — | — |
| Teams | **no API**: `teams` / `team_members` / `team_stats` stay empty | — | — |

---

## Part E: Table index (every table and the pages that write it)

| Table | Inserted on | Updated on | Deleted on |
|---|---|---|---|
| usr_user | signup-details | login, login-code, Google/Apple, forgot-password, profile/edit (username) | — |
| usr_user_profile | signup-details; profile/edit (if missing) | onboarding/details, profile/edit | — |
| auth_otp | signup, signup-code (resend), login (code), forgot-password | same (expiring old codes) + each code check | — |
| auth_password_history | signup-details, forgot-password | — | — |
| auth_session | signup-details, every login | app launch (refresh), logout, sign out others, password reset, token reuse | — |
| auth_login_log | login (ok or failed), login-code, Google/Apple, logout | — | — |
| auth_identity | Google/Apple login (auto-link), settings link | settings re-link | settings unlink |
| media_files | signup-details, profile/edit, post/new | — | — |
| usr_user_follow | search, user/[id] follow, follows/[id] follow | re-follow | unfollow, remove follower (follows/[id]) |
| usr_user_block | **never** (SQL only) | — | — |
| social_post | post/new; any played/retired match decision (type 801) | — | Part D delete |
| social_post_media | post/new | — | cascade |
| social_post_like | home, post/[id] | — | unlike; cascade |
| social_post_comment | post/[id] | — | Part D; cascade |
| notification | home / post/[id] like, post/[id] comment, post/new (to followers), search / user/[id] follow | notifications (opening marks all read) | unlike, unfollow, post deleted (Part D); cascade when either user is deleted |
| chat_conversation | user/[id] Message; Part D group | chat/[id] send | — |
| chat_conversation_member | user/[id] Message; Part D | chat/[id] send/read; Part D leave/rejoin | — |
| chat_message | chat/[id] send | chat/[id] delete (soft) | — |
| sports, sport_formats, scoring_rulesets, type_master | seed | seed | — |
| players | signup-details, seed, match/serve & match/enter (guests), tournament register, match/new (missing player) | profile/edit (display name), onboarding/claim | — |
| player_sports | onboarding/sports, profile/edit, claim, seed | same (primary) | same |
| player_sport_stats | rebuilt on every match decision, dispute and claim | — | same (delete + insert) |
| team_stats | match decision (only with teams, so never in practice) | — | same |
| teams, team_members | **never** | claim (`team_members.player_id`) | — |
| player_ratings | complete/retire (all registered), confirm, fixture result; seed | same | claim (the guest's rows) |
| player_rating_history | same as player_ratings | — | — |
| venues | match/serve, match/enter, tournament/new (new venue name) | — | — |
| courts | tournament staff (add court) | — | — |
| court_scorers | staff page, fixture page | — | staff page (remove / replace) |
| matches | match/serve, match/enter, fixture start | score (each flush), end, confirm, schedule | — |
| match_sides | match create, fixture start | match decision (outcome) | — |
| match_participants | match create, fixture start | claim | — |
| match_segments, match_segment_scores | match create, scoring | scoring, decision | — |
| match_events | scoring, match/enter, fixture result | undo (`voided_at`) | — |
| match_scorers | score screen → Add scorer | — | — |
| match_confirmations | confirm page | — | — |
| tournaments | tournament/new | manage, event registration opened, first fixture start, last event done | — |
| tournament_staff | tournament/new, staff | staff (re-add) | staff (remove) |
| tournament_events | event/new | manage, entries (status), draw, reset, start, completion | — |
| tournament_entries | register, entries | entries (approve/seed), mine (withdraw) | — |
| tournament_entry_members | register, entries | claim | — |
| tournament_stages | draw | start (in_progress), completion | reset draw |
| stage_groups, stage_group_entries | draw | — | reset (cascade) |
| fixtures | draw | draw linking, schedule, start, every decision (advancement) | reset (cascade) |
| usr_user_sport, usr_sport_rating | — (read by the seed backfill only) | — | — |

**Never touched by the backend** (row counts must not change during testing):
admin_analytics_daily, admin_audit_log, auth_account_verification, auth_device, auth_password_reset, match_correction, match_master, match_participant, match_period, match_report, match_result, match_score_event, match_score_state, match_stat_snapshot, match_stat_snapshot_detail, match_team, match_team_member, media_asset, mst_sport, mst_sport_event, mst_sport_format, mst_sport_period, mst_sport_rule, mst_sport_scoring, mst_sport_stat, user_report, usr_role, usr_sport_stat_history, usr_sport_stats, usr_user_role

---

## Part F: Redis key reference
| Key | Type | Set by | Removed by | TTL |
|---|---|---|---|---|
| `live:match:<matchId>` | JSON state | the first read of a live match (prime); every point/undo | match end; add scorer; tournament staff/court scorer changes; fixture result | 24 h |
| `live:version:<matchId>` | number | same | same | 24 h |
| `live:queue:<matchId>` | list of jobs | each point/undo | LTRIM after the Postgres write | — |
| `live:pending` | set of match ids | each point/undo | SREM when the queue is empty; read on startup | — |
| `auth:session:<sessionId>` | timestamp | a signed-in request after the Postgres check | logout, sign out others, token reuse | 60 s |
| `auth:user-revoked:<userId>` | timestamp | password reset | expiry | 65 s |
| `chat:members:<conversationId>` | JSON user ids | the first chat read/send on a miss | add members, leave | 10 min |
| `chat:last:<conversationId>` | message id | send | delete message | 1 h |

Notifications, feed, posts, profiles and tournaments use **no** Redis keys (Postgres only).

When `REDIS_URL` isn't set, all of this lives in process memory: a restart loses it, and it isn't shared between API instances.

---

## Part G: Things to check on purpose
1. **Guests aren't auto-claimed at sign-up.** The `players` row is created directly, so claiming only happens on `onboarding/claim`.
2. **A disputed manual result keeps its `social_post`.**
3. **A pending manual result counts in `player_sport_stats` before it's confirmed.**
4. **Sign-up writes no `auth_login_log` row.**
5. **Teams can't be created**, so `teams` / `team_members` / `team_stats` stay empty.
6. **Replaced photos stay in `media_files`.** Photos are also kept in Postgres, not object storage, so watch the database size.
7. **There's no block API or UI.**
8. **Rate limits are in memory.** They're per API instance, and a restart resets them.
9. **Some APIs have no screen:** deleting posts and comments, group chats, adding chat members, leaving a chat, marking a single notification read (`POST /notifications/:id/read`).
10. **Notifications are in-app only.** There are no push notifications (no device tokens, no Expo push service); the badge is polled every 30 s while Home is open.
11. **A deleted comment keeps its notification** (the row stays with the comment text); a deleted post removes its notifications.

---

## Part H: Cross-cutting checks (every page)
- [ ] **No network:** turn on airplane mode. Pages show an error notice (`ApiError status 0`) instead of crashing; pull to refresh works once you're back online
- [ ] **Wrong API address:** with a stale `EXPO_PUBLIC_API_URL`, requests time out after 15 s with an error, not a blank page
- [ ] **Expired access token:** set `ACCESS_TOKEN_TTL_SECONDS=60`, wait, then act. The app refreshes once (**~ auth_session**) and retries without signing you out
- [ ] **Revoked session:** see Part B. The app goes to Welcome
- [ ] **Validation errors** show under the right field (from `error.details`), on every form: sign-up, login, profile edit, new post, comment, new match, enter result, create tournament, add event, register
- [ ] **Dark / light / system theme** (Settings): every page is readable in both, including the score screen, sheets, the tab bar and the notifications list
- [ ] **Android back button / iOS swipe back** leaves every page; sheets close first; it never leaves a half-saved form
- [ ] **Deep links / share links:** `/s/:token` and `/t/:slug` open in a browser without login (§41)
- [ ] **Pull to refresh** works on Home, Chats, Tournaments, Profile and Notifications
- [ ] **Long lists page** without duplicates: feed (20), comments (50), notifications (30), chat messages (30)
- [ ] **Blocked users** (SQL row in `usr_user_block`) are hidden everywhere: feed, post, comments, search, profile, chat, notifications
- [ ] **Suspended or deleted users** (`usr_user.status` 2 / 3) can't sign in, and their posts, comments and notifications are hidden
- [ ] **Two devices, one account:** changes on one show on the other after focus or polling (live score, chats, badge)
- [ ] **Speed (each Neon round trip is ~480 ms from India while the database is in us-west-2):** creating a tournament < 4 s, a draw < 12 s, a fixture result < 30 s, a scoring tap answers at once (Redis). Anything much slower is a regression
- [ ] **Automated tests:** `cd backend && npm test` is fully green (110+ API and engine tests); `cd frontend && npx tsc --noEmit && npx expo lint` show 0 errors
- [ ] **Small phone and large phone:** headers (Home: bell, search, new post) don't overflow; text doesn't clip
