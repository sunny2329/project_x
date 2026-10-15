# Parked scoring engines (not in MVP)

NOT IN THE MVP. The football (timed goals) and box cricket (overs) engines from the six-sport
version, parked here unchanged. They use the old engine contract (legacy-types.ts), are not
registered in the scoring registry, and the sports are seeded inactive with no rulesets.
To bring one back: port it to the ScoringPlugin interface (../types.ts), register it in
../index.ts, add a ruleset to src/catalog/sports.ts and set the sport active.
