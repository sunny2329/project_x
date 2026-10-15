# Adding a sport

The core (matches, events, segments, tournaments, stats, ratings, API, app) knows nothing about
any particular sport. A sport is **data** plus, only if it scores in a new way, a **scoring
plugin**. No schema migration and no `if (sport === …)` anywhere.

## 1. Does an existing scoring model fit?

| Model (`scoringModel`) | Plugin | Fits |
| --- | --- | --- |
| `rally` | `backend/src/engine/scoring/plugins/rally.ts` | Every rally scores: badminton, table tennis, pickleball (rally), volleyball, squash (PAR) … |
| `side_out` | `plugins/side-out.ts` | Only the server scores: traditional pickleball, old-style squash/racquetball |
| `tennis` | `plugins/tennis.ts` | 15/30/40 games, sets, tiebreaks: tennis, padel, beach tennis |

If one fits, skip to step 3: a new sport is just a catalog entry with rulesets.

## 2. If not: write a plugin

Create `backend/src/engine/scoring/plugins/<model>.ts` implementing `ScoringPlugin`
(`backend/src/engine/scoring/types.ts`):

- `configSchema` (Zod): the ruleset's rules (with defaults). Stored as `scoring_rulesets.config`
  and snapshotted onto every match (`matches.ruleset_config`).
- `eventSchema` (Zod): what the scorer sends, e.g. `{ type: 'ball', runs, extra, wicket }`.
  Stored append-only in `match_events.payload`; scores are always replayed from events, so
  undo works for free.
- `validateSides`, `initialState`, `applyEvent` (pure, never mutate), `isComplete`.
- `summary(state)` → `ScoreSummary`: the only thing the app, feed, profile, public pages and
  standings read. Fill `actions` with the buttons the scorer may press next. The app draws
  those buttons generically, so the scoring screen needs no new code. Put the score hierarchy
  (innings → over, half …) in `segments`; it is mirrored into `match_segments`.
- Optional: `eventsForManualResult` (results typed in afterwards) and `walkoverScore`.

Register it in `backend/src/engine/scoring/index.ts` (`createDefaultRegistry`), then add tests next
to the plugin (see `rally.test.ts`). `registry.test.ts` proves a plugin registers without
touching the core, and checks that `src/engine` imports nothing from the app, DB or HTTP.

Stuck halfway? Engines for football (`timed_goals`) and box cricket (`overs`) are parked in
`backend/src/engine/scoring/parked/` and can be ported to the interface.

## 3. Add the sport to the catalog

Add an entry to `backend/src/catalog/sports.ts`:

```ts
{
  id: 9,                       // next free id; never reuse one
  slug: 'squash',
  name: 'Squash',
  category: 'racket',          // free text: racket, team, bat_and_ball …
  scoringModel: 'rally',
  isActive: true,              // false keeps it hidden from the app and API
  iconKey: 'racquetball',      // MaterialCommunityIcons name
  accentColor: '#F43F5E',
  sortOrder: 6,
  formats: [{ code: 'singles', name: 'Singles', playersPerSide: 1 }],
  rulesets: [
    { slug: 'par-11x5', name: 'Best of 5 · 11 points', scoringModel: 'rally', isDefault: true,
      config: { pointsToWin: 11, winBy: 2, bestOf: 5, serve: { rotation: 'rally_winner' } } },
  ],
}
```

Exactly one ruleset per active sport must be the default (`registry.test.ts` checks this and
validates every config against its plugin).

## 4. Seed

```bash
cd backend
npm test -- src/engine     # catalog + plugin tests
npm run db:seed            # upserts sports, formats, rulesets (never deletes)
```

The sport now appears in `GET /api/v1/sports`, in the app's sport picker, and in tournament
category creation. To hide a sport later, set `isActive: false` and seed again; its history stays.
