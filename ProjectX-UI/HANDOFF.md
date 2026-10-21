# ProjectX UI handoff

Read this file before building any screen. The designs are in `screens/`. Use them as the visual reference and rebuild them in this project's own stack. Don't copy the HTML in as-is.

## What's in `screens/`

- One `.dc.html` file per screen. Each one is 390 × 844 (phone size); `AddEvent` is 390 × 1180.
- Each file is plain HTML with inline styles.
  - `{{name}}` marks a value filled in from the small script at the bottom of the file.
  - `<sc-if>` / `<sc-for>` are "show if" and "repeat".
  - `<dc-import name="TabBar">` puts the shared tab bar in.
  - `<a href="X.dc.html">` means that tap goes to screen X.
- `Main.dc.html` is the flow map, showing every screen and where each tap goes.
- `canvas.json` groups the screens into sections and has short flow notes.
- `ScoreBadminton.dc.html` has working scoring logic in its script: rally scoring to 21, win by 2, cap 30, serve court from the score, game and match point, undo. Use it as a reference for the client-side preview of a point.

## Brand and theme

Every screen supports dark and light mode. The tokens are the CSS variables at the top of each file:

| Token | Dark | Light | Use |
|---|---|---|---|
| bg | #0A0A0A | #FFFFFF | screen background |
| surface | #161412 | #F7F3EF | cards, inputs |
| raised | #221F1C | #EEE8E2 | chips, dividers |
| line / line2 | #2C2825 / #3F3A35 | #E6DED6 / #D2C8BE | borders |
| fg | #F6F2EE | #16120F | main text |
| soft / muted / faint | #D8D1CA / #ABA39B / #7D756E | #3B3430 / #6B625B / #978D85 | secondary text |
| primary | #E85D04 | #C2410C | main buttons, active tab, + button |
| onPrimary | #0A0A0A | #FFFFFF | text on primary |
| accentText | #FF8A3D | #C2410C | orange text |
| sideB | #F2EDE7 | #1C1917 | second side's score button |
| live | #FF5468 | #FF5468 | LIVE badges, unread counts |
| good / bad | #4ADE80 / #FF8A98 | #15803D / #BE123C | win/ready, dispute/error |

Each sport has its own colour, taken from `backend/src/catalog/sports.ts`:

| Sport | Colour |
|---|---|
| Badminton | #A855F7 |
| Table tennis | #EAB308 |
| Pickleball | #F97316 |
| Padel | #06B6D4 |
| Tennis | #84CC16 |
| Volleyball | #14B8A6 |

Use dark text (#0A0A0A) on sport-coloured fills.

## Type

- Display and all score numbers: **Big Shoulders Display**, weights 700/800/900, usually uppercase.
- Everything else: **Instrument Sans**, weights 400–700.
- Both are on Google Fonts.

Sizes used:

| Element | Size |
|---|---|
| Big score | 104–132 |
| Screen title | 40–48 |
| Callout | 30 |
| Body | 15–17 |
| Labels | 12–13 |

## Layout rules

- Leave 54px at the top of each screen for the status bar; don't draw a fake one.
- Side padding is 20–24px.
- Touch targets are at least 44px. Main buttons are 56px tall with a 16px radius.
- Cards use 14–20px radius.
- The tab bar is 84px: Home · Tournaments · + New match (orange square) · Chats · Profile.

## Screens and flow

**Onboarding**
- Sign-up path: Welcome → SignupPhone → VerifyCode → SignupDetails → PickSports → ClaimMatches (only if the phone number has guest matches) → Home.
- Log-in path: Welcome → Login (password or phone code; Google/Apple only for linked accounts) → Home. Login → ForgotPassword (signs out every device) → Login.

**Home and social**
- Home has a Live-now row → Spectator. Result cards → MatchResult. Posts → PostDetail.
- Search → PlayerProfile → ChatThread. NewPost. ChatList → ChatThread.

**Friendly match**
- Main path: NewMatchSport → NewMatchSetup (rules, singles or doubles, players) → AddPlayer (registered player or guest) → ServeFirst → Score<Sport> → MatchComplete → MatchResult (rating change, posted to feed).
- During scoring, ⋯ opens ScorerMenu: share link, add scorer, retire (RetireSheet), walkover (only before the first point), abandon.
- Results afterwards: EnterResult (the engine rejects impossible scores) → opponent sees ConfirmResult (accept, or dispute with a note).
- Watching: Spectator (no buttons, refreshes every 4s) → PublicMatch (web, no login).

**Scoreboards**
- ScoreBadminton, ScoreTableTennis, ScorePickleball, ScoreTennis, ScorePadel, ScoreVolleyball all share one layout:
  - header
  - finished games or sets
  - callout (`callout`)
  - two big side buttons
  - undo
- **Draw button labels from the engine's `actions[]`**, so pickleball gets "Side out" / "Second server".
- Update the score on screen straight away after a tap, then confirm with the server using `version` and `clientEventId`.

**Profile**
- Profile (rating trend from rating history, record), MatchHistory (Retired / Walkover / Awaiting / Disputed labels), PlayerProfile (head-to-head), EditProfile, Settings (linked accounts, devices, sign out other devices).

**Tournaments for players**
- TournamentList → TournamentPage → EventPage (tabs: Matches, Groups, Bracket, Entries) → Register (partner) → MyMatches (Playing, Scorer duties).
- BracketView: rounds as columns, connecting lines, placeholders like "Winner QF 2", LIVE / READY / BYE states.
- GroupTable: P, W, L, games ±, points ±, qualifiers marked Q, a note on how ties were broken.
- Podium. PublicTournament (web, no login).

**Tournaments for organizers**
- CreateTournament (visibility: public, unlisted or private) → OrgDashboard (status steps) → AddEvent (sport, format, ruleset, draw format with its settings, tiebreak order, max entries) → StaffCourts (organizer, co-organizer, referee, court scorer) → Entries (approve, seed, withdraw) → DrawPreview / DrawGroups (reshuffle with a seed code, confirm, reset) → Schedule → CourtBoard → Fixture (start, walkover, enter result).

## Status badges

Map each backend status to a badge:

| Badge | Statuses |
|---|---|
| LIVE (red) | match live |
| READY (green) | fixture ready |
| PENDING (amber) | entry pending |
| WAITING (grey placeholder) | fixture pending |
| BYE | fixture bye |
| REGISTRATION OPEN (green) | tournament or event registration open |
| IN PROGRESS (red tint) | tournament or event in progress |
| EVENT COMPLETE | event completed |

## Not designed yet, because it isn't built in the backend

- Push notifications
- Automatic scheduling
- Double elimination and Swiss formats
- Football and box cricket
