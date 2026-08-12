# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**테이블GO** — a small restaurant table-reservation app built on the [next-forge](https://github.com/vercel/next-forge) Turborepo template. Customers book a 2-hour time slot via the public `web` app; staff manage reservations via the `app` (admin) app. Business rules: closed Sat/Sun plus any date in the `Holiday` table, 6 fixed daily slots between 10:00–22:00, one active reservation per date+slot.

## Commands

Run from the repo root unless noted. This is an npm workspaces + Turborepo monorepo (`npm@10.8.1`, Node >= 18).

- `npm run dev` — run all apps in parallel via `turbo dev` (not cached, persistent)
- `npm run build` — `turbo build` (builds packages before apps; runs `test` first per Turborepo task graph)
- `npm run test` — `turbo test` across all packages/apps
- `npm run check` / `npm run fix` — lint/format via `ultracite` (a Biome preset — see `biome.jsonc`, extends `ultracite/core`, `ultracite/react`, `ultracite/next`)
- `npx biome check --write <file>` — lint/format a single file directly
- `npx tsc --noEmit -p apps/<app>/tsconfig.json` — typecheck a single app (there's no root-wide typecheck script; each app has its own `typecheck` script)
- `npx vitest run <path>` — run a single test file (only `apps/api` and `apps/app` currently have vitest configs/tests)

Database (Prisma + Neon Postgres, from `packages/database`):
- `npm run migrate` — format schema, generate client, `prisma migrate dev` (creates a migration)
- `npm run db:push` — format schema, generate client, `prisma db push` (declarative push, no migration history — **this is the workflow actually used in this repo**; there is no `prisma/migrations` folder)
- `npm run migrate:deploy` — generate + `prisma migrate deploy` (only relevant if migration history exists)

When changing `packages/database/prisma/schema.prisma`, always run `prisma generate` (`cd packages/database && npx prisma format && npx prisma generate`) and restart any running `next dev` processes — a running dev server holds the previously-generated Prisma Client in memory and will throw `PrismaClientValidationError` on fields added after it started, even though the source file is up to date.

Schema-DSL constraint: Prisma's schema language cannot express partial/filtered unique indexes, and this project provisions its schema via `db push` (not raw-SQL migrations), so partial uniqueness is emulated with a nullable "shadow" key column instead (see `Reservation.activeSlotKey`) — Postgres treats every `NULL` in a unique column as distinct, so only non-null values collide.

## Apps and ports

| App | Port | Purpose |
|---|---|---|
| `apps/web` | 3001 | Public marketing site + customer-facing reservation flow (`/reservations`), no auth required |
| `apps/app` | 3000 | Staff admin dashboard (Clerk-authenticated), reservation management at `/admin` |
| `apps/api` | 3002 | Health checks, cron, inbound webhooks (Clerk, payments) |
| `apps/email` | 3003 | React Email template preview |
| `apps/docs` | 3004 | Mintlify docs site |
| `apps/studio` | 3005 | Prisma Studio for `packages/database` |
| `apps/storybook` | — | Component development environment for `packages/design-system` |

`web` and `app` are cross-linked via the shared `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_WEB_URL` env vars (defined in `packages/next-config/keys.ts`, consumed through each app's local `env.ts`) — e.g. the admin dashboard's "예약 사이트 보기" button and the public site's "관리자 로그인" link.

## Architecture

Standard next-forge layout: `apps/*` are deployable Next.js apps; `packages/*` are internal workspace packages (`@repo/*`) providing shared, provider-swappable infrastructure (auth, database, design-system, analytics, observability, feature-flags, payments, email, security, rate-limit, webhooks, cms, seo, i18n, notifications, storage, collaboration). Each app composes only the packages it needs and declares its own env schema in `env.ts` via `createEnv` from `@t3-oss/env-nextjs`, extending the relevant packages' `keys()` exports (see `packages/next-config/keys.ts` for the core cross-app URLs).

Domain-specific code (not boilerplate) lives in:
- `packages/database/prisma/schema.prisma` — `TimeSlot`, `Holiday`, `Reservation` models
- `apps/web/app/[locale]/reservations/` — public booking flow (`actions.ts` server actions, `reservation-form.tsx` client component)
- `apps/app/app/(authenticated)/admin/` — staff reservation list + cancel action

### Reservation domain model

- `Reservation.status` is `PENDING | CONFIRMED | CANCELLED`. Cancelling never deletes the row (history is preserved) — it only flips `status` and clears `activeSlotKey`.
- `Reservation.activeSlotKey` is `"{date}_{slotId}"` while a reservation is active, and `null` once cancelled. It carries a DB-level `@unique` constraint, which is what actually prevents two active reservations from colliding on the same date+slot — application code must set/clear it correctly (`createReservation` sets it on insert, `cancelReservation` nulls it out) or the constraint becomes meaningless.
- Duplicate booking is defended at three layers, all necessary: (1) the client polls availability so booked slots render as "마감" and can't normally be clicked, (2) `createReservation` re-checks availability server-side before writing so races are caught early with a friendly message, (3) the `activeSlotKey` unique constraint is the actual source of truth if two requests still race past (1) and (2) — the resulting `P2002` error is caught and translated to the same user-facing message.
- Closed days = Sat/Sun (checked in application code, not stored) plus any row in `Holiday`. Date columns are stored as UTC-midnight `@db.Date`; because there's no time component, UTC day-of-week equals KST day-of-week, so this doesn't need timezone conversion.

### Live availability (no Supabase/websockets)

The DB is Neon Postgres accessed via Prisma's serverless driver adapter (`packages/database/index.ts`, `@prisma/adapter-neon`) — there is no Supabase Realtime or LISTEN/NOTIFY infrastructure in this project. "Live" slot/calendar updates in `reservation-form.tsx` are done via short-interval client polling (`POLL_INTERVAL_MS`), scoped only to the currently selected date and visible calendar month (never all dates), rather than a push-based subscription. Keep this constraint in mind before assuming any Supabase-flavored API (`.channel()`, `.on('postgres_changes', ...)`) is available anywhere in this codebase.

## Notes

- `apikey.txt` at the repo root contains a live API key and is **not** covered by `.gitignore`. Do not `git add -A`/`git add .` without checking `git status` first, and never commit this file.
- Auth is Clerk (`@repo/auth`), used only in `apps/app` (the admin dashboard) — the public `apps/web` reservation flow is intentionally unauthenticated.
- `packages/database/generated/` is Prisma's generated client output — do not hand-edit; it's regenerated by `prisma generate`.
