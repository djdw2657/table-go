# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**테이블GO** — a small restaurant table-reservation app built on the [next-forge](https://github.com/vercel/next-forge) Turborepo template. Customers book a 2-hour time slot via the public `web` app; staff manage reservations via the `app` (admin) app. Business rules: closed Sat/Sun plus any date in the `Holiday` table, 6 fixed daily slots between 10:00–22:00, up to `SLOT_CAPACITY` (3) teams per date+slot.

## Commands

Run from the repo root unless noted. This is an npm workspaces + Turborepo monorepo (`npm@10.8.1`, Node >= 18).

- `npm run dev` — run all apps in parallel via `turbo dev` (not cached, persistent)
- `npm run build` — `turbo build` (builds packages before apps; runs `test` first per Turborepo task graph)
- `npm run test` — `turbo test` across all packages/apps
- `npm run check` / `npm run fix` — lint/format via `ultracite` (a Biome preset — see `biome.jsonc`, extends `ultracite/core`, `ultracite/react`, `ultracite/next`)
- `npx biome check --write <file>` — lint/format a single file directly
- `npx tsc --noEmit -p apps/<app>/tsconfig.json` — typecheck a single app (there's no root-wide typecheck script; each app has its own `typecheck` script)
- `npx vitest run <path>` — run a single test file (only `apps/api` and `apps/app` currently have vitest configs/tests)

Database (Prisma + Supabase Postgres, from `packages/database`):
- `npm run migrate` — format schema, generate client, `prisma migrate dev` (creates a migration)
- `npm run db:push` — format schema, generate client, `prisma db push` (declarative push, no migration history — **this is the workflow actually used in this repo**; there is no `prisma/migrations` folder)
- `npm run migrate:deploy` — generate + `prisma migrate deploy` (only relevant if migration history exists)

When changing `packages/database/prisma/schema.prisma`, always run `prisma generate` (`cd packages/database && npx prisma format && npx prisma generate`) and restart any running `next dev` processes — a running dev server holds the previously-generated Prisma Client in memory and will throw `PrismaClientValidationError` on fields added after it started, even though the source file is up to date.

Schema-DSL constraint: Prisma's schema language cannot express partial/filtered unique indexes, and this project provisions its schema via `db push` (not raw-SQL migrations), so partial uniqueness is emulated with a nullable "shadow" key column instead (see `Reservation.teamSlotIndex`) — Postgres treats every `NULL` in a unique column as distinct, so only non-null values collide.

## Apps and ports

| App | Port | Purpose | Vercel project |
|---|---|---|---|
| `apps/web` | 3001 | Public marketing site + customer-facing reservation flow (`/reservations`), no auth required | `table-go` → table-go-nine.vercel.app |
| `apps/app` | 3000 | Staff admin dashboard (Clerk-authenticated), reservation management at `/admin` | `table-go-admin` → table-go-admin.vercel.app |
| `apps/api` | 3002 | Health checks, cron (`complete-reservations`, `waitlist-timeout`, `keep-alive`), inbound webhooks (Clerk, payments) | `table-go-api` |
| `apps/email` | 3003 | React Email template preview |
| `apps/docs` | 3004 | Mintlify docs site |
| `apps/studio` | 3005 | Prisma Studio for `packages/database` |
| `apps/storybook` | — | Component development environment for `packages/design-system` |

`web` and `app` are cross-linked via the shared `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_WEB_URL` env vars (defined in `packages/next-config/keys.ts`, consumed through each app's local `env.ts`) — e.g. the admin dashboard's "예약 사이트 보기" button and the public site's "관리자 로그인" link.

`apps/api` is a separate Vercel project (`table-go-api`) created via `vercel link --cwd apps/api`, not through Vercel's normal "Import Project" flow — that path defaults the project's **Root Directory** to `.` (repo root) instead of `apps/api`, which made Vercel run the root `turbo build` unscoped (building every workspace, including unrelated ones like `@repo/cms`, which fails without `BASEHUB_TOKEN`) instead of Vercel's usual automatic per-app Turborepo scoping. Fixed via `vercel project update table-go-api --root-directory apps/api`. If Root Directory ever reverts to `.` (e.g. after unlinking/relinking), the build will fail the same way — check `vercel project inspect table-go-api` first.

## Architecture

Standard next-forge layout: `apps/*` are deployable Next.js apps; `packages/*` are internal workspace packages (`@repo/*`) providing shared, provider-swappable infrastructure (auth, database, design-system, analytics, observability, feature-flags, payments, email, security, rate-limit, webhooks, cms, seo, i18n, notifications, storage, collaboration, realtime). Each app composes only the packages it needs and declares its own env schema in `env.ts` via `createEnv` from `@t3-oss/env-nextjs`, extending the relevant packages' `keys()` exports (see `packages/next-config/keys.ts` for the core cross-app URLs).

Domain-specific code (not boilerplate) lives in:
- `packages/database/prisma/schema.prisma` — `TimeSlot`, `Holiday`, `Reservation`, `Waitlist`, `Feedback` models
- `apps/web/app/[locale]/reservations/` — public booking flow (`actions.ts` server actions, `reservation-form.tsx` client component, `waitlist-actions.ts`/`waitlist-dialog.tsx` for the waitlist)
- `apps/web/app/[locale]/waitlist/[token]/` — waitlist claim page (token-gated, `export const dynamic = "force-dynamic"` — see gotcha below)
- `apps/web/app/[locale]/survey/[token]/` — satisfaction survey page (token-gated, same `force-dynamic` requirement)
- `apps/app/app/(authenticated)/admin/` — staff reservation list + cancel action + waitlist cascade
- `apps/app/app/(authenticated)/statistics-actions.ts` + `components/statistics.tsx` — admin dashboard stats (reservations, cancellations, regular customers, feedback/NPS)
- `apps/api/app/cron/` — `complete-reservations` (flips past CONFIRMED reservations to COMPLETED), `waitlist-timeout` (expires stale NOTIFIED waitlist entries and cascades to the next one). Both run once daily (`apps/api/vercel.json`'s `crons`), deliberately conservative to stay within the Vercel **Hobby plan**'s cron limits — tighten the schedule if the project ever moves to Pro.
- Supabase Edge Function `send-survey-emails` (deployed to the Supabase project, not this repo's source tree — see "Satisfaction survey" below) — dispatches/reminds survey emails on a `pg_cron` schedule

### Reservation domain model

- `Reservation.status` is `PENDING | CONFIRMED | COMPLETED | CANCELLED`. Cancelling never deletes the row (history is preserved) — it only flips `status` and clears `teamSlotIndex`. `COMPLETED` is set by the `apps/api` `/cron/complete-reservations` sweep once a slot's start time has passed, which also stamps `completedAt` (used to time the satisfaction-survey dispatch window).
- `Reservation.teamSlotIndex` is a 1-based seat number (1..`SLOT_CAPACITY`) while the reservation is active, and `null` once cancelled. It carries a DB-level `@@unique([date, slotId, teamSlotIndex])` constraint, which is what actually prevents more than `SLOT_CAPACITY` active reservations from colliding on the same date+slot — application code must set/clear it correctly (`withSeatAssignment` in `reservation-shared.ts` sets it on insert/move, cancellation nulls it out) or the constraint becomes meaningless.
- Duplicate booking is defended at three layers, all necessary: (1) the client polls + subscribes to Realtime so booked slots render as "마감" and can't normally be clicked, (2) `createReservation`/`withSeatAssignment` re-checks availability server-side before writing so races are caught early with a friendly message, (3) the `teamSlotIndex` unique constraint is the actual source of truth if two requests still race past (1) and (2) — the resulting `P2002` error is caught and translated to the same user-facing message.
- Closed days = Sat/Sun (checked in application code, not stored) plus any row in `Holiday`. Date columns are stored as UTC-midnight `@db.Date`; because there's no time component, UTC day-of-week equals KST day-of-week, so this doesn't need timezone conversion.

### Waitlist

`Waitlist` rows queue customers for a full date+slot, FIFO by `createdAt` among `WAITING` entries. On a cancellation (customer self-service or admin), `cascadeWaitlistNotification(date, slotId)` notifies the earliest `WAITING` entry (sets `NOTIFIED` + a 24h `notifyExpiresAt`, emails a claim link). This function is **duplicated** across `apps/web/app/[locale]/reservations/reservation-shared.ts`, `apps/app/app/(authenticated)/admin/waitlist-cascade.ts`, and `apps/api/app/cron/waitlist-timeout/waitlist-cascade.ts` — these are three separately-deployed Next.js apps that can't import each other's route-local code, and the logic mixes `@repo/database` + `@repo/email` in a way that doesn't belong in either provider-swappable package. Keep all three in sync if this changes. The `apps/api` `/cron/waitlist-timeout` job expires entries whose `notifyExpiresAt` has passed and cascades to the next one.

### Satisfaction survey

`Feedback` rows are created at **dispatch** time (not response time) so `surveySentAt`/`reminderSentAt` can drive timing windows even before a customer responds. The dispatch/reminder logic lives in a Supabase **Edge Function** (`send-survey-emails`, deployed via the Supabase MCP/CLI, not part of this repo's build) invoked hourly by `pg_cron` (`select cron.schedule('send-survey-emails-hourly', '0 * * * *', ...)`, calling `net.http_post` with the project URL + publishable key stored in Supabase Vault as `project_url`/`publishable_key`). It finds `COMPLETED` reservations with `completedAt` ≥24h old and no `Feedback` row yet (dispatch), and `Feedback` rows sent ≥3 days ago with no response and no reminder yet (reminder). The Edge Function needs `RESEND_TOKEN`/`RESEND_FROM`/`WEB_URL` set as Supabase Edge Function secrets (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected) — without them it still runs and creates `Feedback` rows, it just silently no-ops the email send. Since `relationMode = "prisma"` means there are no real Postgres foreign keys, the function can't use PostgREST relationship embedding (`select=*,Reservation(*)`) — every join is a manual second query.

Because `/cron/complete-reservations` only runs once a day (see the Hobby-plan note above), the real-world gap between a visit and the survey landing in someone's inbox is closer to 1–2 days than a clean 24h — completion itself can lag the actual visit by up to a day before the 24h dispatch window even starts counting.

**Gotcha**: `service_role` (which the Edge Function uses) has `bypassrls` but that does **not** imply ordinary table GRANTs — Postgres still requires them separately, and since `db push` creates tables owned by the `prisma` role (see "Live availability" below), `service_role` had zero privileges on them until explicitly granted (`grant select on "Reservation" to service_role; grant select, insert, update on "Feedback" to service_role;`). If a table the Edge Function needs to touch is ever recreated, redo this grant or every query silently fails with `permission denied for table X` (visible in Supabase's `function_logs`, not `function_edge_logs`).

### Live availability (Supabase Realtime Broadcast)

The DB is Supabase Postgres accessed via Prisma's `@prisma/adapter-pg` (node-postgres) driver adapter (`packages/database/index.ts`), through Supabase's Supavisor **transaction-mode pooler** (port 6543, `?pgbouncer=true`) for app runtime — `packages/database/.env` (used only by the `prisma` CLI for `db push`/`generate`) instead uses the **session-mode pooler** (port 5432), since transaction mode doesn't support the prepared statements Prisma's migration engine needs.

"Live" updates use Supabase Realtime **Broadcast from Database**, not `postgres_changes`: a `SECURITY DEFINER` trigger (`public.broadcast_reservation_changes`, on both `Reservation` and `Waitlist`) calls `realtime.broadcast_changes()` on a single global `reservations` topic with `null` old/new records — **the broadcast payload deliberately carries no row data**, only a "something changed" signal, because `postgres_changes`/naive broadcast would otherwise leak customer PII (name/phone/email) to any subscriber. Both apps' browser clients (`@repo/realtime`'s `useReservationChangeSignal` hook) connect as the Supabase `anon` role (neither app uses Supabase Auth — `apps/web` is unauthenticated by design, `apps/app` uses Clerk) and, on any event, just re-run the existing safe server actions (`getAvailability`, `getFilteredReservations`, etc.) rather than reading the broadcast payload. A `realtime.messages` RLS policy grants `anon`/`authenticated` `SELECT` (safe, since the channel carries no data); `EXECUTE` on the trigger function is revoked from `anon`/`authenticated`/`public` since `SECURITY DEFINER` functions are otherwise callable via PostgREST RPC by default. All app tables (`TimeSlot`, `Holiday`, `Reservation`, `Waitlist`, `Feedback`) have RLS enabled with **no policies** (default-deny) as defense-in-depth — they're only ever queried through the `prisma` Postgres role (which has `bypassrls`), never through the Data API.

Client-side polling (`POLL_INTERVAL_MS` in `reservation-form.tsx`, `reservations-table.tsx`) is kept as a fallback in case the Realtime connection drops, layered under the instant broadcast-triggered refetch — don't remove it when touching this code.

**Gotcha**: any page whose `notFound()`/content depends on a DB row that can come into existence *after* the page was first requested (the `/waitlist/[token]` and `/survey/[token]` pages) must set `export const dynamic = "force-dynamic"`. Without it, Vercel's edge cached the first (404) response for a token indefinitely — a customer's very first click on an emailed link, sent seconds after the underlying row was created, could 404 forever even though the row is really there, because Next's build-time analysis doesn't detect a Prisma call as something that requires per-request rendering the way it does `fetch()`.

## Notes

- `apikey.txt` at the repo root contains a live API key and is **not** covered by `.gitignore`. Do not `git add -A`/`git add .` without checking `git status` first, and never commit this file.
- Auth is Clerk (`@repo/auth`), used only in `apps/app` (the admin dashboard) — the public `apps/web` reservation flow is intentionally unauthenticated. Neither app uses Supabase Auth.
- `packages/database/generated/` is Prisma's generated client output — do not hand-edit; it's regenerated by `prisma generate`.
- `packages/database/.env` (CLI-only, direct/session-pooler connection) and each app's `.env.local` (app-runtime, transaction-pooler connection) both set `DATABASE_URL` to different connection strings for the same Supabase project, on purpose — see "Live availability" above.
