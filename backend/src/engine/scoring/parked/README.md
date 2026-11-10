# Parked scoring engines (not in MVP)

NOT IN THE MVP. The football (timed goals) engine from the six-sport version, parked here
unchanged. It uses the old engine contract (legacy-types.ts), is not registered in the scoring
registry, and the sport is seeded inactive with no rulesets. To bring it back: port it to the
ScoringPlugin interface (../types.ts), register it in ../index.ts, add a ruleset to
src/catalog/sports.ts and set the sport active. (`plugins/overs.ts` is how box cricket was ported.)
