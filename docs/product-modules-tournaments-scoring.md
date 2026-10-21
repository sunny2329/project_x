# ProjectX: modules, tournaments and live scoring

A guide for designing the UI and for understanding the tournament system, as of 2026-10-20.
Everything here is taken from the backend code (`backend/src/engine`, `backend/src/modules`,
`backend/src/catalog/sports.ts`), so it describes what the app actually does today.

**Contents**

1. The core idea and our USP
2. Modules at a glance
3. How live scoring works (the shared engine)
4. The 6 sports and how each one is scored
5. What the scoring UI needs to show
6. Tournaments: the model
7. Tournament lifecycle, step by step
8. Draw algorithms
9. Advancement, byes and walkovers
10. Group standings and tiebreakers
11. Ratings, records and the feed
12. Screens to design
13. What is not built yet

---

## 1. The core idea and our USP

**ProjectX lets anyone score a racket-sport match point by point on their phone, and that one
tap feeds everything else:** the live scoreboard, tournament brackets, standings, player records,
ratings and the social feed.

What makes it different:

- **One tap per point.** The scorer only answers one question: *who won the point?* The app works
  out the rest: game and set scores, deuce and advantage, tiebreaks, who serves next, and from
  which side of the court. The scorer never types a score.
- **The rules are built in for every sport.** Badminton's 30-point cap, table tennis's serve
  changes every 2 points, pickleball's "4-7-2" side-out call, tennis and padel's golden point and
  super tiebreak are all handled by the engine. The organizer just picks a ruleset.
- **Undo is safe.** A score is never stored as a number that can drift. It is rebuilt from the
  list of points every time. Undo removes the last point, and the score is always right.
- **Tournaments run themselves.** When a match ends, the winner moves into the next round, byes
  move on automatically, group tables update, and the knockout fills from the group rankings.
  The organizer doesn't move names around by hand.
- **Results you can trust.** A result typed in afterwards has to be confirmed by the opponent
  before it changes anyone's rating. Guests and walkovers never move ratings.
- **Every match is shareable.** Each match has a public link, and the result goes to the feed.
- **Guests are welcome.** You can score with friends who don't have the app. When they sign up
  later, their past matches become theirs.

---

## 2. Modules at a glance

| Module | API base | What it does |
|---|---|---|
| **Auth** | `/api/v1/auth` | Sign-up with SMS code, password login, phone code login, forgot password, Google/Apple sign-in for existing accounts, refresh tokens. See `docs/auth-tables-and-flow.md`. |
| **Sports** | `/api/v1/sports` | The sport catalogue: sports, formats (singles, doubles) and rulesets. |
| **Profile** | `/api/v1/profile` | My profile, the sports I play, my match history, records and ratings per sport. |
| **Players** | `/api/v1/players` | Player identities (registered and guests), search, `/players/me`, claiming guest players after sign-up. |
| **Matches** | `/api/v1/matches` | Friendly matches: create, score live, undo, finish, retire, walkover, abandon, add scorers, confirm a manual result. |
| **Tournaments** | `/api/v1/tournaments`, `/tournament-events`, `/entries`, `/fixtures`, `/courts` | Tournaments, events, entries, draws, fixtures, courts, staff, standings and brackets. |
| **Public** | `/api/v1/public` | Pages anyone can open without logging in: a shared match, a public tournament by slug. |
| **Feed** | `/api/v1/feed` | Home feed: match results and posts from people you follow. |
| **Social** | `/api/v1/posts` | Posts, likes and comments. |
| **Chat** | `/api/v1/conversations` | Direct and group messages, unread counts. |

All responses use the same envelope: `{ success: true, data }` or
`{ success: false, error: { code, message, details? } }`. Swagger is at `/docs`.

---

## 3. How live scoring works (the shared engine)

### 3.1 One event per point

For every racket sport, the only thing the scorer sends is:

```json
{ "type": "rally_won", "sideIndex": 0 }
```

`sideIndex` is 0 for the first side and 1 for the second. The scorer doesn't send a score.

### 3.2 Replay: the score is always recomputed

```
ruleset config ──┐
                 ├─> initial state ─> point ─> point ─> point ─> ... ─> current state ─> ScoreSummary
sides (1v1/2v2) ─┘
```

- The match stores the **list of events**, not the score.
- Every read, every new point and every undo goes through **replay**: start from 0-0 and apply the
  events in order.
- **Undo** marks the last event as void, and the score is replayed without it.
- Because of this, the score can never be "out of sync" with what happened.

### 3.3 Plugins: one per way of scoring

A sport points to a **scoring model**, and each model is a plugin:

| Plugin | Used by | Idea |
|---|---|---|
| `rally` | Badminton, table tennis, pickleball (rally format), volleyball | Every rally gives a point, whoever served. |
| `side_out` | Pickleball (traditional) | Only the serving side can score. |
| `tennis` | Tennis, padel | 15-30-40-game, sets, tiebreaks. |

A plugin decides what is a valid setup, how a point changes the state, when the match is over, and
how the score is displayed. Adding a sport that scores like an existing one needs **no code**, just
a new entry in the catalogue.

### 3.4 ScoreSummary: the one shape the UI reads

Every plugin outputs the same `ScoreSummary`, so **one scoreboard component can show any sport**.

| Field | What it is | Example |
|---|---|---|
| `sides[i].primary` | The big number: games or sets won | `"1"` |
| `sides[i].current` | Score in the current game, or null when the match is over | `"17"`, `"40"`, `"AD"` |
| `sides[i].serving` | Is this side serving | `true` |
| `sides[i].serverPlayerIndex` | Which player of the side serves | `0` |
| `sides[i].serverNumber` | Pickleball doubles: server 1 or 2 | `2` |
| `sides[i].serveNote` | Serve hint for the scorer | `"Right court"` |
| `segments[]` | Games or sets, with tennis games and tiebreaks inside each set | `Game 1: 21-17` |
| `headline` | Score in one line, side 0 first | `"21-17, 18-21, 21-19"` or `"6-4, 7-6(5), [10-7]"` |
| `callout` | The call of the moment | `"Match point"`, `"Deuce"`, `"Golden point"`, `"4-7-2"` |
| `totals` | Counts for records and tiebreakers | major = games or sets, minor = points or games |
| `actions[]` | **The buttons to draw**, each with the exact event to send | `"Point"`, `"Side out"`, `"Second server"` |
| `complete`, `winnerSideIndex` | Is it over, and who won | |

**The UI should draw the buttons from `actions`**, not hard-code them. That is how pickleball's
receiving side gets a "Side out" button instead of "Point" without any sport-specific code in the
app.

### 3.5 Speed and safety

- **Live state lives in Redis** (or memory in development), so a point doesn't wait for Postgres.
  A background writer saves the points to Postgres in order, and picks up after a restart.
- **`version`:** every point and undo bumps the match version. The app sends the version it saw;
  if someone else scored in between, the server answers "stale" and the app refreshes.
- **`clientEventId`:** the phone gives each tap an id, so a resend after a weak connection never
  counts twice.
- **Watchers** (people following the match, not scoring it) refresh every 4 seconds.

### 3.6 Who can score

- A **friendly match**: its creator, plus anyone they add as a scorer.
- A **tournament match**: the organizers and staff, and the scorer assigned to that court.

### 3.7 Ways a match can end

| Ending | When | Counts in records? | Moves ratings? |
|---|---|---|---|
| **Completed** | The engine says the match is decided, then the scorer taps Finish | Yes | Yes (if everyone is registered) |
| **Retired** | A side stops mid-match; the other side wins with the score so far | Yes | Yes |
| **Walkover / no-show** | Before any point is played; one side wins without playing | Yes | No |
| **Double walkover** | Neither side turned up | Yes, both lose | No |
| **Abandoned** | Friendly only; nobody wins | No | No |
| **Manual result** | Score typed in afterwards (`[[21,15],[18,21],[21,19]]`); the engine checks it is a possible score | Yes | Only after the opponent confirms |
| **Disputed** | The opponent rejects a manual result | No | No |

---

## 4. The 6 sports and how each one is scored

Five sports are live in the app. Volleyball is fully supported by the engine but hidden for now.
Football and box cricket are parked; their old engines are kept but they have no rulesets yet.

| # | Sport | Plugin | Formats | Accent colour | Status |
|---|---|---|---|---|---|
| 1 | Badminton | `rally` | Singles, doubles | `#A855F7` | Live |
| 2 | Table tennis | `rally` | Singles, doubles | `#EAB308` | Live |
| 3 | Pickleball | `side_out` (default) or `rally` | Singles, doubles | `#F97316` | Live |
| 4 | Padel | `tennis` | Doubles only | `#06B6D4` | Live |
| 5 | Tennis | `tennis` | Singles, doubles | `#84CC16` | Live |
| 6 | Volleyball | `rally` (sets) | Team, 2 to 6 a side | `#14B8A6` | Engine ready, hidden |
| — | Football, box cricket | `timed_goals`, `overs` | Team | | Parked |

### 4.1 Badminton (rally)

**Rulesets:**

| Ruleset | Rules |
|---|---|
| **Best of 3 · 21 points** (default, BWF) | To 21, win by 2, capped at 30 |
| One game · 21 points | One game to 21, cap 30 |
| Best of 3 · 15 points | To 15, win by 2, cap 21 |

**How it plays:**
- Every rally is a point.
- **The winner of the rally serves next.**
- The server stands in the **right court on an even score and the left court on an odd score**.
  The app shows this as "Right court" or "Left court".
- **Doubles:** when the serving side wins a point, its two players swap courts and the same player
  keeps serving. When the receiving side wins, it gets the serve, and the player in the court that
  matches its score serves.
- The winner of a game serves first in the next game.
- At 29-29, the next point wins: the cap is 30.

**Callouts:** "Game point", "Match point".
**Headline:** `21-17, 18-21, 21-19`.

### 4.2 Table tennis (rally)

**Rulesets:**

| Ruleset | Rules |
|---|---|
| **Best of 5 · 11 points** (default, ITTF) | Each game to 11, win by 2 |
| Best of 3 · 11 points | |
| Best of 7 · 11 points | |

There is no cap.

**How it plays:**
- Every rally is a point.
- **The serve changes every 2 points, whoever wins them.**
- **From 10-10, the serve changes every point.**
- In doubles, the server rotates through the players.
- The first server alternates from game to game.

**Callouts:** "Game point", "Match point".

### 4.3 Pickleball (side-out by default, rally optional)

**Rulesets:**

| Ruleset | Plugin | Rules |
|---|---|---|
| **Side-out · one game to 11** (default) | `side_out` | Win by 2 |
| Side-out · best of 3 to 11 | `side_out` | |
| Side-out · one game to 15 | `side_out` | |
| Side-out · one game to 21 | `side_out` | |
| Rally · one game to 21 | `rally` | Every rally scores |
| Rally · best of 3 to 15 | `rally` | Every rally scores |

**How side-out plays:**
- **Only the serving side can score.**
- If the receiving side wins the rally, there is no point. Instead:
  - in **doubles**, the serve passes to the partner, the **second server**;
  - after the second server loses a rally, it's a **side out** and the other side serves.
- A doubles game starts at **0-0-2**: the first serving side gets only one server.
- When the serving side scores, the server switches court with their partner and keeps serving.
- The first server alternates from game to game.

**The call:** serving score, receiving score, server number, for example **"4-7-2"**. This is the
`callout`, shown big on the scorer's screen.

**Buttons change with the situation:**
- The serving side's button says **"Point"**.
- The receiving side's button says **"Second server"** or **"Side out"**.

### 4.4 Padel (tennis)

**Rulesets:**

| Ruleset | Rules |
|---|---|
| **Best of 3 · advantage** (default) | |
| Best of 3 · golden point | At 40-40 the next point wins |
| Best of 3 · golden point · super tiebreak | A tiebreak to 10 replaces the third set |

Padel is doubles only.

**How it plays:**
- Points go 0, 15, 30, 40, game.
- At 40-40 it's either "Deuce", needing two points in a row, or "Golden point", where the next
  point wins.
- A set is the first to 6 games by 2, with a **tiebreak at 6-6** played to 7 points by 2.
- The side that received in the last game serves the next one. In doubles, the server rotates
  through the players.
- **In a tiebreak, the serve changes after the first point and then every two points.**

**Callouts:** "Deuce", "Advantage", "Golden point", "Tiebreak", "Match tiebreak", "Set point",
"Match point".
**Headline:** `6-4, 7-6(5), [10-7]`. The (5) is the loser's points in the tiebreak; the [square
brackets] mark a match tiebreak.

### 4.5 Tennis (tennis)

**Rulesets:**

| Ruleset | Rules |
|---|---|
| **Best of 3 · advantage** (default) | |
| Best of 3 · no-ad | Golden point |
| Best of 3 · match tiebreak | A tiebreak to 10 replaces the third set |
| Best of 5 · advantage | |
| One set · advantage | |

It's the same engine as padel, with singles and doubles. The engine also supports a final set
with no tiebreak (Wimbledon-style advantage set), but there is no catalogue ruleset for it yet.

**The scoreboard needs three levels:** sets won (`primary`), games in the current set
(`segments`), and points in the current game (`current`: 0, 15, 30, 40 or AD).

### 4.6 Volleyball (rally, sets; hidden)

| Ruleset | Rules |
|---|---|
| **Best of 5 · sets to 25** | Win by 2; **the deciding 5th set is to 15** |

- Teams can have 2 to 6 players a side.
- It uses the rally plugin with segments called "Set" instead of "Game".
- Everything is ready in the engine. Turning it on is a catalogue switch.

### 4.7 Rules an organizer can change

A ruleset can be overridden per match or event with `rulesOverride`, and the plugin checks every
value. Common ones:

| Plugin | Options |
|---|---|
| `rally` | `pointsToWin`, `winBy`, `cap`, `bestOf` (odd), `decidingGamePoints`, `firstServerSideIndex` |
| `side_out` | `pointsToWin`, `winBy`, `cap`, `bestOf`, `startAsSecondServer`, `nextGameFirstServer` |
| `tennis` | `deuce` (advantage or golden point), `setGames`, `tiebreakAt`, `tiebreakPoints`, `bestOf`, `finalSet` (standard, advantage, match tiebreak), `matchTiebreakPoints` |

---

## 5. What the scoring UI needs to show

### 5.1 The scorer's screen (the most important screen)

| Area | Content | Source |
|---|---|---|
| Header | Sport, ruleset name, court, LIVE badge | match |
| Side rows (×2) | Names or initials, serving dot, big number, current score | `sides[]` |
| Serve hint | "Right court", or server 1 or 2 for pickleball | `serveNote`, `serverNumber` |
| Callout | "Match point", "Deuce", "4-7-2" | `callout` |
| Point buttons | One big button per side, with labels from the engine | `actions[]` |
| Undo | Always visible while live | `POST /matches/:id/undo` |
| History | Finished games or sets | `segments[]` |
| Menu | Retire, walkover (only before the first point), abandon (friendly only), add scorer | |
| Finish | Appears when `complete` is true | `POST /matches/:id/complete` |

The design rules for this screen:

- The two point buttons are the whole screen's purpose. Make them **huge and easy to tell apart**,
  and put them under their side.
- After a tap, show the new score **at once**, then confirm with the server.
- The **callout** should be big and short.
- **Undo** must be one tap.

### 5.2 Per-sport scoreboard layouts

| Sport | Big number | Current score | Extra |
|---|---|---|---|
| Badminton | Games (0-2) | Points (0-30) | Court side of the server |
| Table tennis | Games (0-4) | Points | Serve indicator; changes every 2 points |
| Pickleball | Games | Points | Server 1 or 2 and the "4-7-2" call |
| Tennis / padel | Sets | 0 / 15 / 30 / 40 / AD | Games in the current set; tiebreak points as numbers |
| Volleyball | Sets (0-3) | Points | |

### 5.3 The spectator's view

It is the same scoreboard **without buttons**. It refreshes every 4 seconds, and a share button
uses the public link.

### 5.4 The result card (feed, profile, tournament)

- Winner highlighted.
- The `headline` score line (`21-17, 18-21, 21-19`).
- Sport icon and colour.
- A "Retired", "Walkover" or "Awaiting confirmation" label when it applies.

---

## 6. Tournaments: the model

```
Tournament  (name, dates, venue, visibility: public / unlisted / private)
 ├── Staff   (organizer, co-organizers, scorers, referees)
 ├── Courts  (each court can have its own scorer)
 └── Events  ("Men's Doubles", "Open Singles")
      │       sport + format + ruleset + draw format + tiebreakers + max entries
      ├── Entries   (one player for singles, two for doubles; optional seed)
      └── Stages    (1 for knockout or round robin, 2 for groups + knockout)
           ├── Groups   (Group A, Group B ... or "Main draw" for a bracket)
           └── Fixtures (a slot in the draw; becomes a match when it starts)
                └── Match (scored live with the same engine as friendlies)
```

- **A tournament holds many events.** Each event is its own competition: its own sport, format,
  rules and draw. One weekend can have badminton singles, badminton doubles and pickleball doubles.
- **A fixture is not a match.** A fixture is a place in the draw, for example "QF 2: winner of R1-3
  vs winner of R1-4". It becomes a real match when staff press Start, once both entries are known.
- **Tournament matches are normal matches**, so they use the same scoring screen, live updates,
  feed posts, records and ratings.

### 6.1 Statuses (for badges and filters)

| Object | Statuses |
|---|---|
| Tournament | draft → registration_open → registration_closed → in_progress → completed (or cancelled) |
| Event | draft → registration_open → registration_closed → **drawn** → in_progress → completed (or cancelled) |
| Entry | pending → approved, or withdrawn / disqualified |
| Stage | pending → in_progress → completed |
| Fixture | pending (waiting for entries) → **ready** (both known) → live → completed; or **bye**, or cancelled |
| Match | live → completed, retired, walkover, abandoned or disputed |

### 6.2 Who can do what

| Role | Can |
|---|---|
| **Organizer** (creator) | Everything. Can't be removed. |
| **Co-organizer** | Manage events, entries, the draw, courts, staff and results |
| **Scorer / referee** | Start and score tournament matches |
| **Court scorer** | Start and score matches on their assigned court |
| **Player** | Register an entry (they must be one of its players) while registration is open. The entry waits for approval. |

---

## 7. Tournament lifecycle, step by step

1. **Create the tournament** (`POST /tournaments`): name, dates, venue, visibility. Status: draft.
2. **Add events** (`POST /tournaments/:id/events`): sport, format, ruleset, draw format with its
   settings, tiebreakers and max entries. The server checks the rules and draw settings right away.
3. **Add staff and courts**, and optionally assign a scorer to each court.
4. **Open registration:** set the event to `registration_open`. The tournament opens with it.
5. **Entries come in** (`POST /tournament-events/:id/entries`):
   - When a player registers, the entry is **pending**. When an organizer adds it, it's
     **approved** straight away.
   - Checks: the right number of players for the format, no player twice, no player in two entries
     of the same event, not over max entries.
   - The organizer approves entries and sets seeds (`PATCH /entries/:id`). Each seed number can
     only be used once.
6. **Close registration**, then **make the draw** (`POST /tournament-events/:id/draw`):
   - `preview: true` shows the draw without saving it, so the organizer can look first.
   - `randomSeed` makes the draw reproducible: the same seed and the same entries give the same
     draw.
   - Saving it creates stages, groups and fixtures. Byes move on immediately. The event becomes
     **drawn**.
   - **Reset the draw** is allowed until a match has been played.
7. **Schedule** (`PATCH /fixtures/:id`): court and time for each fixture.
8. **Run matches** (`POST /fixtures/:id/start`): only a **ready** fixture can start. It creates
   the match, and the event and tournament become in_progress.
   - Alternatives: a **walkover or no-show** (`/fixtures/:id/walkover`), or a **manual result**
     (`/fixtures/:id/result`) if nobody scored it live.
9. **Automatic advancement:** every time a match is decided, in the same database transaction:
   - the winner moves into the next fixture (and the loser into the 3rd-place match, if there is
     one);
   - fixtures that now have both entries become ready;
   - when a group finishes, its standings are calculated and the knockout slots ("1st Group A")
     are filled;
   - when all fixtures of a stage, event or tournament are done, it is marked completed.
10. **Finish:** a knockout's podium is champion, runner-up and the 3rd-place winner.

---

## 8. Draw algorithms

There are three formats today: `knockout`, `round_robin` and `groups_knockout`. The engine is pure
code and fully unit-tested. The format list is open, so double elimination or Swiss can be added
later.

### 8.1 Seeding order

1. Seeded entries first, in seed order (1, 2, 3 ...).
2. Then the unseeded entries, **shuffled**. The shuffle is Fisher-Yates driven by a seeded random
   generator (mulberry32), so it can be reproduced.

### 8.2 Knockout (single elimination)

Settings: `thirdPlaceMatch` (default false). It needs at least 2 entries.

- **Bracket size** is the next power of two: 6 entries give a draw of 8, 12 give 16.
- **Standard seed placement**, so the top seeds meet as late as possible. For 8 lines the order
  is `1, 8, 4, 5, 2, 7, 3, 6`, which gives these first-round pairs:

```
R1-1:  Seed 1  v  Seed 8   ─┐
R1-2:  Seed 4  v  Seed 5   ─┴─ SF-1 ─┐
R1-3:  Seed 2  v  Seed 7   ─┐        ├─ Final
R1-4:  Seed 3  v  Seed 6   ─┴─ SF-2 ─┘
```

  Seeds 1 and 2 can only meet in the final, and seeds 1 to 4 only from the semi-finals.
- **Byes:** the empty lines go to the **top seeds**. With 6 entries, seeds 7 and 8 are byes, so
  seeds 1 and 2 go straight to round 2.
- **Round names** come from the rounds left: Final, Semi-final, Quarter-final, then Round of 16,
  32 and so on.
- **3rd-place match:** the two semi-final losers play. If a semi was a walkover, its loser doesn't
  play the 3rd-place match.

### 8.3 Round robin

Settings: `legs`, 1 or 2 (home and away). It needs at least 3 entries.

- Everyone plays everyone, scheduled with the **circle method**:
  - one entry stays fixed and the others rotate each round;
  - with an odd number of entries, one entry rests each round.
- n entries give n − 1 rounds (n rounds when n is odd), with no entry playing twice in a round.
- With 2 legs, the second leg repeats the rounds with the sides swapped.

### 8.4 Groups + knockout

Settings: `groupCount`, `qualifiersPerGroup` (default 2), `thirdPlaceMatch`, `legs`.

**Minimum entries** = groups × max(2, qualifiers + 1). For example, 2 groups with 2 qualifiers
each need at least 6 entries.

1. **Snake seeding into groups**, so every group gets a fair mix of strong and weak entries:

```
Row 1 →  A: seed 1   B: seed 2   C: seed 3
Row 2 ←  C: seed 4   B: seed 5   A: seed 6
Row 3 →  A: seed 7   B: seed 8   C: seed 9
```

2. Each group plays a round robin.
3. **The qualifiers are placed in the knockout rank by rank:** all group winners first, then all
   runners-up. With the standard bracket order this means **group winners don't meet their own
   runner-up early, and A1 meets B2 while B1 meets A2.**
4. The knockout slots say where their entry comes from ("1st Group A"), and they fill when that
   group finishes.

### 8.5 What the draw produces (for the bracket UI)

Each fixture has:

- `round`, `position` and `roundName`;
- its two **slot sources**: an entry, a bye, "winner of X", "loser of X", or "Nth of Group Y";
- where its winner goes (`next`) and where its loser goes (`loserNext`).

This is enough to draw the whole bracket with connecting lines **before any match is played**,
with placeholders such as "Winner QF 1" or "1st Group B".

---

## 9. Advancement, byes and walkovers

The engine keeps a state per fixture and moves entries through the draw:

| Situation | What happens |
|---|---|
| Both entries known | The fixture becomes **ready** and can start |
| One entry against a bye | The entry moves on at once; the fixture shows **bye** |
| Two byes | A bye is passed on to the next fixture |
| Match played or retired | The winner moves to `next`, the loser to `loserNext` (3rd-place match) |
| Walkover or no-show | The winner moves on; the loser does **not** go to the 3rd-place match |
| Double walkover | Nobody moves on; the next fixture gets a bye in that slot |
| Group finished | The ranking fills the knockout's "Nth of Group X" slots; missing ranks become byes |

All of this runs **in the same transaction as the match result**, so the bracket is never half
updated.

---

## 10. Group standings and tiebreakers

Each row has: played, won, lost, **major** won and lost (games, or sets in tennis), and **minor**
won and lost (points, or games in tennis). These come straight from each match's
`ScoreSummary.totals`, so the table works the same for every sport.

**Tiebreakers** are chosen per event, in order. The default is:

1. `match_wins`: matches won;
2. `head_to_head`: a mini-table of only the matches between the tied entries;
3. `major_diff`: games (or sets) won minus lost;
4. `minor_diff`: points (or games) won minus lost.

`major_won` and `minor_won` are also available.

**How ties are resolved,** following BWF and ITTF practice:

- Each tiebreaker splits the entries that are still level.
- **When a step leaves a smaller tie, that tie starts again from the first tiebreaker.** For
  example, if three players are level and a step separates one of them, the remaining two are
  decided by their own match.
- Anything still level after every tiebreaker is decided by seed, then by a fixed order.

**Walkovers in standings:** the winner gets the walkover score of the format. For badminton best
of 3 that's 2 games and 42 points; for tennis best of 3 it's 2 sets and 12 games.

---

## 11. Ratings, records and the feed

- **Ratings:** Elo per player per sport.
  - Everyone starts at **1000**, with K = 32.
  - In doubles, a side's rating is the average of its players, and both players get the same
    change.
  - A rating changes only when **every player is registered** and the match was **actually
    played** (completed or retired).
  - A manual friendly result changes ratings only **after the opponent confirms** it.
  - The rating history is kept per match, which is what the trend line on the profile shows.
  - Glicko-2 can replace Elo later; the database columns already exist.
- **Records** (played, won, lost, games and points) are **rebuilt from the decided matches** each
  time, never just incremented, so a disputed or corrected result can't leave them wrong.
- **Feed:** every played or retired match posts a result card to the feed automatically.
- **Guests:** a guest can be given a phone number. When that person signs up, `POST /players/claim`
  moves the guest's matches to their account.

---

## 12. Screens to design

### Scoring

| Screen | Key content |
|---|---|
| New match: pick a sport | Sport grid with icons and accent colours |
| New match: rules and players | Ruleset picker, singles/doubles, player search, add a guest, who serves first |
| **Live scoring** | See 5.1 |
| Match view (spectator) | Scoreboard without buttons, share link |
| Enter a result afterwards | A score per game or set; the engine says if it's impossible |
| Confirm a result | Accept or dispute, with a comment |
| Match result | Winner, headline, segments, rating change |

### Tournaments: organizer

| Screen | Key content |
|---|---|
| Create tournament | Name, dates, venue, visibility |
| Tournament dashboard | Events, status, staff, courts, quick actions |
| Add event | Sport, format, ruleset, **draw format with its settings**, tiebreakers, max entries |
| Entries | Pending and approved lists, approve, seed numbers, withdraw |
| **Draw preview** | Bracket or groups, Reshuffle (new seed), Confirm, Reset |
| Schedule | Fixtures by round, court and time |
| Court board | Each court with its scorer and its live or next match |
| Fixture | Start, walkover / no-show, enter result |

### Tournaments: player and spectator

| Screen | Key content |
|---|---|
| Tournament list | Public tournaments that are open or running |
| Tournament page | Events, dates, venue, Register button |
| Register | Choose partner (doubles), confirm |
| **Bracket view** | Rounds as columns, connecting lines, placeholders, live badges |
| **Group table** | Rank, P, W, L, games ±, points ±, qualifier highlight |
| My matches / my scorer duties | Fixtures where I play or score, ready or live |
| Public page (no login) | Tournament by slug, live scores, results |

---

## 13. What is not built yet

- **Formats:** double elimination and Swiss. The format interface is ready for them.
- **Scheduling help:** automatic court and time allocation. Today staff schedule each fixture.
- **Real-time push:** watchers refresh every 4 seconds; WebSockets or SSE are planned.
- **Offline scoring queue:** the phone can resend safely (`clientEventId`), but there is no full
  offline mode yet.
- **Volleyball** is hidden; **football and box cricket** need their plugins rebuilt on the new
  engine.
- **Push notifications** ("your match is up next on Court 2") need device registration first.
