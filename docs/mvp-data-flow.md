# PROJECT_X — MVP Data Flow

How data moves through the `project_x` database (Neon, PostgreSQL) for the MVP defined in the
product document: **Module 1 (Auth & Profile) + Module 2 (friendly-match scoring, pickleball and
badminton first) + Module 3 (basic match feed and history)**.

_Written 2026-09-26 from the live schema (46 tables, all in `public`). Updated 2026-09-29: flows 1–5 are
built; see wiki.md "Match module" for exactly which tables and columns each step writes._

---

## Table groups

| Group | Tables |
| --- | --- |
| Users | `usr_user`, `usr_user_profile`, `usr_user_sport`, `usr_user_follow`, `usr_user_block`, `usr_role`, `usr_user_role` |
| User stats | `usr_sport_stats`, `usr_sport_rating`, `usr_sport_stat_history` |
| Auth | `auth_session`, `auth_otp`, `auth_device`, `auth_login_log`, `auth_password_reset`, `auth_password_history`, `auth_account_verification` |
| Sports setup data | `type_master`, `mst_sport`, `mst_sport_format`, `mst_sport_scoring`, `mst_sport_period`, `mst_sport_event`, `mst_sport_stat`, `mst_sport_rule` |
| Matches | `match_master`, `match_participant`, `match_team`, `match_team_member`, `match_period`, `match_score_event`, `match_score_state`, `match_correction`, `match_result`, `match_stat_snapshot`, `match_stat_snapshot_detail`, `match_report` |
| Social | `social_post`, `social_post_like`, `social_post_comment`, `social_post_media` |
| Other | `notification`, `media_asset`, `user_report`, `admin_audit_log`, `admin_analytics_daily` |

---

## Step 0 — Setup data (must be filled before the first match)

Seeded on 2026-09-29 by `npm run seed` (lookup ids in `backend/src/modules/match/match.codes.ts`).
`mst_sport_rule` is still empty (not needed yet).

| Table | What goes in it (MVP) |
| --- | --- |
| `type_master` | Every lookup value: formats (singles/doubles), event types (point won), period types (game), stat types, etc. |
| `mst_sport` | The 6 sports; pickleball and badminton first |
| `mst_sport_format` | Singles / doubles per sport, with min/max players |
| `mst_sport_scoring` | Rules in `scoring_config` (JSON). Pickleball: games to 11, win by 2, best of 3. Badminton: to 21, win by 2, cap 30, best of 3 |
| `mst_sport_period` | Game 1, 2, 3 |
| `mst_sport_event` / `mst_sport_stat` / `mst_sport_rule` | What can happen in a rally, which stats are tracked, extra rules |

---

## Flow 1 — Sign-up and profile (Module 1)

```
Sign up / OTP ──► usr_user ──► usr_user_profile (name, photo, city, bio)     ✅ built
                        ├──► usr_user_sport   (sports I play, primary sport)
                        └──► usr_sport_rating (starts at 1000 per sport) + usr_sport_stats (all 0)

Profile photo ──► media_asset ──► its URL copied into usr_user_profile.profile_photo
```

Already built and in use: `usr_user`, `usr_user_profile`, `auth_session`, `auth_otp`,
`auth_login_log`, `auth_password_history`.

---

## Flow 2 — Creating a friendly match (Module 2)

```
Creator picks sport + singles/doubles + players
  ──► match_master        (sport, format, scoring rules, created_by, status = scheduled)
  ──► match_participant   (one row per player, participant_no 1..n)
  ──► match_team + match_team_member   (doubles only: team 1 / team 2)
  ──► match_period        (Game 1 created; later games added as they start)
```

---

## Flow 3 — Live scoring, point by point (the core)

Each tap on "+1" is **one database transaction**:

```
match_score_event  ──  new row: who scored, which game, sequence_no = next number (unique per match)
match_score_state  ──  current score for that game updated, last_event_id = that event
```

- **Undo:** mark the last event `is_undone = true` and recalculate `match_score_state`.
- **Correcting an older point:** a `match_correction` row records which event was fixed, by whom and why.
- **End of a game:** the scoring rules (e.g. 11 points, lead of 2) decide when a game is won. That
  game's `match_period` is closed and the next one opens.

---

## Flow 4 — Match completion ("auto-save updates both profiles")

One transaction when the final point ends the match:

```
match_master.status = completed
  ──► match_result                   (winner participant/team, game scores in result_data)
  ──► match_stat_snapshot (+detail)  (each player's stats for this match)
  ──► usr_sport_stat_history         (one row per player per match = match history)
  ──► usr_sport_stats                (played / won / lost / points +=)
  ──► usr_sport_rating               (new skill rating, e.g. Elo)
  ──► social_post                    (automatic "X beat Y 11-7, 11-9" post; one per match)
```

---

## Flow 5 — Feed and social (Module 3, basic)

```
usr_user_follow (who I follow)  ─minus─  usr_user_block
      └──► social_post from those users, newest first ──► social_post_like / social_post_comment

Profile page = usr_user_profile + usr_sport_stats + usr_sport_rating + usr_sport_stat_history
```

---

## Gaps in the schema for the MVP

| # | Gap | Impact | Suggested fix |
| --- | --- | --- | --- |
| 1 | `match_participant.user_id` is required | Can't score a match against a friend who isn't on the app yet, which blocks casual play | Make `user_id` nullable and add `guest_name` |
| 2 | No city table; `usr_user_profile.city_id` points at nothing | "Leaderboard by city" and "players nearby" have no source | Add an `mst_city` table and a foreign key |
| 3 | Setup tables empty; `type_master` has no category column | Nothing says which values are "formats" and which are "event types" | Confirm whether `type_id` is the category, then seed |
| 4 | `social_post` allows one post per match | No place for "ongoing matches" in the feed | Feed queries `match_master` where status = live |
| 5 | No challenge/rematch table | Module 3 "challenge a player" has no home | Use `match_participant.status_id` (invited/accepted) + `notification` |
| 6 | Missing indexes | Match history, feed and notifications get slow as data grows | Index `match_participant(user_id)`, `social_post(user_id, created_at)`, `notification(user_id)` |
| 7 | Match/social tables use `timestamp`; auth tables use `timestamptz` | Time-zone mistakes when scoring across devices | Switch to `timestamptz` |
| 8 | Product doc says Prisma; backend uses plain SQL (`pg`) | Both work with this schema | Decide before building the match module |

---

## Suggested next step

1. Confirm how `type_master` should be used (gap 3) and whether guest players are needed (gap 1).
2. Seed the setup data for **pickleball and badminton**.
3. Build **Flow 2 → 3 → 4**: the scoring engine.
