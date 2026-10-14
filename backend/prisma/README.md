# Database migrations (Prisma)

The schema in `schema.prisma` is the source of truth for **all** of `project_x`:

- Everything above the `NEW CORE` marker is the legacy schema, introspected from `project_x`
  on 2026-10-14 and recorded by `0_baseline`. On `project_x` the baseline is only marked as
  applied; it runs for real in fresh databases and in throwaway test schemas.
- Everything below the marker is the generic core added by the racket-first pivot.

## Rules

- **Never run `prisma migrate dev` or `prisma migrate reset` against `project_x`.** Create new
  migrations with `prisma migrate diff`, review the SQL, and apply them with `npm run db:deploy`.
- Migration SQL is written without schema qualifiers (no `"public".`) so the same files deploy
  into test schemas (`?schema=test_xxx`).
- Some constraints can't be expressed in `schema.prisma`: CHECKs, partial unique indexes,
  `UNIQUE NULLS NOT DISTINCT`, and the `lower(username)` index. They are hand-written at the end of
  each migration. A future `migrate diff` will propose **dropping** `uq_fixtures_position` and
  `uq_match_segments_position` (and may miss the others), so delete those lines from any
  generated migration.

## New migration

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
  -o prisma/migrations/<n>_<name>/migration.sql   # then strip "public". and review
npm run db:deploy
```
