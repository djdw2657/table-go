# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 안내를 제공합니다.

## 프로젝트

**테이블GO** — [next-forge](https://github.com/vercel/next-forge) Turborepo 템플릿 기반의 작은 식당 테이블 예약 앱. 손님은 `web` 앱에서 2시간 단위 시간대를 예약하고, 직원은 `app`(관리자) 앱에서 예약을 관리합니다. 비즈니스 규칙: 토·일 휴무 + `Holiday` 테이블에 등록된 날짜, 10:00~22:00 사이 6개 고정 시간대, 날짜+시간대당 최대 `SLOT_CAPACITY`(3)팀.

## 명령어

특별한 언급이 없으면 저장소 루트에서 실행합니다. npm workspaces + Turborepo 모노레포입니다 (`npm@10.8.1`, Node >= 18).

- `npm run dev` — `turbo dev`로 모든 앱을 동시 실행 (캐시 안 됨, 지속 실행)
- `npm run build` — `turbo build` (앱보다 패키지를 먼저 빌드, Turborepo 태스크 그래프상 `test`가 먼저 실행됨)
- `npm run test` — 모든 패키지/앱에 대해 `turbo test`
- `npm run check` / `npm run fix` — `ultracite`(Biome 프리셋)로 린트/포맷 (`biome.jsonc` 참고, `ultracite/core`, `ultracite/react`, `ultracite/next` 확장)
- `npx biome check --write <file>` — 파일 하나만 직접 린트/포맷
- `npx tsc --noEmit -p apps/<app>/tsconfig.json` — 앱 하나만 타입체크 (루트 전체 타입체크 스크립트는 없고, 각 앱이 자체 `typecheck` 스크립트를 가짐)
- `npx vitest run <path>` — 테스트 파일 하나만 실행 (현재 `apps/api`, `apps/app`에만 vitest 설정/테스트가 있음)

데이터베이스 (Prisma + Supabase Postgres, `packages/database`에서 관리):
- `npm run migrate` — 스키마 포맷 → 클라이언트 생성 → `prisma migrate dev` (마이그레이션 생성)
- `npm run db:push` — 스키마 포맷 → 클라이언트 생성 → `prisma db push` (선언적 push, 마이그레이션 이력 없음 — **이 저장소에서 실제로 쓰는 워크플로우**이며 `prisma/migrations` 폴더는 없음)
- `npm run migrate:deploy` — 클라이언트 생성 + `prisma migrate deploy` (마이그레이션 이력이 있을 때만 의미 있음)

`packages/database/prisma/schema.prisma`를 수정할 때는 항상 `prisma generate`(`cd packages/database && npx prisma format && npx prisma generate`)를 실행하고 실행 중인 `next dev` 프로세스를 재시작해야 합니다 — 실행 중인 dev 서버는 이전에 생성된 Prisma Client를 메모리에 들고 있어서, 소스 파일이 최신이어도 서버 시작 후 추가된 필드에 대해 `PrismaClientValidationError`를 던집니다.

스키마 DSL 제약: Prisma의 스키마 언어는 부분/필터링 unique 인덱스를 표현할 수 없고, 이 프로젝트는 (raw SQL 마이그레이션이 아니라) `db push`로 스키마를 반영하므로, nullable "shadow" 키 컬럼으로 부분 unique를 흉내냅니다 (`Reservation.teamSlotIndex` 참고) — Postgres는 unique 컬럼의 모든 `NULL`을 서로 다른 값으로 취급하므로, non-null 값끼리만 충돌합니다.

## 앱과 포트

| 앱 | 포트 | 용도 | Vercel 프로젝트 |
|---|---|---|---|
| `apps/web` | 3001 | 퍼블릭 사이트 + 손님용 예약 플로우(`/reservations`), 인증 불필요 | `table-go` → table-go-nine.vercel.app |
| `apps/app` | 3000 | 직원용 관리자 대시보드(Clerk 인증), `/admin`에서 예약 관리 | `table-go-admin` → table-go-admin.vercel.app |
| `apps/api` | 3002 | 헬스체크, 크론(`complete-reservations`, `waitlist-timeout`, `keep-alive`), 인바운드 웹훅(Clerk, payments) | `table-go-api` |
| `apps/email` | 3003 | React Email 템플릿 미리보기 |
| `apps/docs` | 3004 | Mintlify 문서 사이트 |
| `apps/studio` | 3005 | `packages/database`용 Prisma Studio |
| `apps/storybook` | — | `packages/design-system` 컴포넌트 개발 환경 |

`web`과 `app`은 공유 환경변수 `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_WEB_URL`(`packages/next-config/keys.ts`에 정의, 각 앱의 `env.ts`를 통해 사용)로 서로 연결됩니다 — 예: 관리자 대시보드의 "예약 사이트 보기" 버튼, 퍼블릭 사이트의 "관리자 로그인" 링크.

`apps/api`는 `vercel link --cwd apps/api`로 만든 별도 Vercel 프로젝트(`table-go-api`)입니다. Vercel의 일반적인 "Import Project" 플로우를 거치지 않았기 때문에, 프로젝트의 **Root Directory**가 `apps/api`가 아니라 `.`(저장소 루트)로 기본 설정되어, Vercel이 (앱별로 자동 스코프하는 일반적인 Turborepo 동작 대신) 루트의 `turbo build`를 스코프 없이 실행해버려 `@repo/cms`처럼 관련 없는 워크스페이스까지 전부 빌드하려다 `BASEHUB_TOKEN` 없이 실패했습니다. `vercel project update table-go-api --root-directory apps/api`로 해결했습니다. Root Directory가 다시 `.`으로 되돌아가면(예: 재연결 시) 같은 이유로 빌드가 실패하니, 먼저 `vercel project inspect table-go-api`로 확인하세요.

## 아키텍처

표준 next-forge 구조: `apps/*`는 배포 가능한 Next.js 앱들이고, `packages/*`는 공유되는, 프로바이더 교체 가능한 인프라를 제공하는 내부 워크스페이스 패키지(`@repo/*`)입니다 (auth, database, design-system, analytics, observability, feature-flags, payments, email, security, rate-limit, webhooks, cms, seo, i18n, notifications, storage, collaboration, realtime). 각 앱은 필요한 패키지만 조합하고, `@t3-oss/env-nextjs`의 `createEnv`를 통해 자체 `env.ts`에서 관련 패키지들의 `keys()` export를 확장해 환경변수 스키마를 선언합니다 (앱 간 공통 URL은 `packages/next-config/keys.ts` 참고).

도메인 특화 코드(보일러플레이트 아님)의 위치:
- `packages/database/prisma/schema.prisma` — `TimeSlot`, `Holiday`, `Reservation`, `Waitlist`, `Feedback` 모델
- `apps/web/app/[locale]/reservations/` — 퍼블릭 예약 플로우 (`actions.ts` 서버 액션, `reservation-form.tsx` 클라이언트 컴포넌트, 대기자용 `waitlist-actions.ts`/`waitlist-dialog.tsx`)
- `apps/web/app/[locale]/waitlist/[token]/` — 대기자 확정 페이지 (토큰 기반, `export const dynamic = "force-dynamic"` — 아래 gotcha 참고)
- `apps/web/app/[locale]/survey/[token]/` — 만족도 설문 페이지 (토큰 기반, 동일하게 `force-dynamic` 필요)
- `apps/app/app/(authenticated)/admin/` — 직원용 예약 목록 + 취소 액션 + 대기자 cascade
- `apps/app/app/(authenticated)/statistics-actions.ts` + `components/statistics.tsx` — 관리자 대시보드 통계 (예약, 취소, 단골 고객, 설문/NPS)
- `apps/api/app/cron/` — `complete-reservations`(지난 CONFIRMED 예약을 COMPLETED로 전환), `waitlist-timeout`(만료된 NOTIFIED 대기자를 정리하고 다음 대기자에게 넘김). 둘 다 하루 한 번만 실행됩니다 (`apps/api/vercel.json`의 `crons`) — Vercel **Hobby 플랜**의 크론 제한 안에 들어가도록 일부러 보수적으로 잡은 값이며, Pro로 옮기면 더 촘촘하게 조정할 수 있습니다.
- Supabase Edge Function `send-survey-emails` (이 저장소의 소스 트리가 아니라 Supabase 프로젝트에 배포됨 — 아래 "만족도 설문" 참고) — `pg_cron` 스케줄로 설문 메일 발송/리마인드

### 예약 도메인 모델

- `Reservation.status`는 `PENDING | CONFIRMED | COMPLETED | CANCELLED`입니다. 취소해도 행을 삭제하지 않고(이력 보존) `status`만 바꾸고 `teamSlotIndex`를 비웁니다. `COMPLETED`는 시간대 시작 시각이 지나면 `apps/api`의 `/cron/complete-reservations`가 설정하며, 이때 `completedAt`도 함께 기록됩니다 (만족도 설문 발송 시점 계산에 사용).
- `Reservation.teamSlotIndex`는 예약이 활성 상태인 동안 1부터 시작하는 좌석 번호(1..`SLOT_CAPACITY`)이고, 취소되면 `null`이 됩니다. DB 레벨의 `@@unique([date, slotId, teamSlotIndex])` 제약이 실제로 같은 날짜+시간대에 `SLOT_CAPACITY`를 초과하는 활성 예약이 생기지 않도록 막아줍니다 — 애플리케이션 코드가 이 값을 정확히 설정/해제해야만(`reservation-shared.ts`의 `withSeatAssignment`가 생성/이동 시 설정, 취소 시 해제) 이 제약이 의미를 가집니다.
- 중복 예약은 3중으로 방어됩니다: (1) 클라이언트가 폴링 + Realtime 구독을 하기 때문에 마감된 시간대는 "마감"으로 표시되고 보통은 클릭할 수 없음, (2) `createReservation`/`withSeatAssignment`가 저장 전에 서버에서 다시 한 번 가용성을 확인해 친절한 메시지로 경합을 조기에 잡아냄, (3) (1)과 (2)를 뚫고도 경합이 발생하면 `teamSlotIndex` unique 제약이 최종 방어선 — 이때 발생하는 `P2002` 에러를 잡아서 동일한 사용자용 메시지로 변환합니다.
- 휴무일 = 토·일(애플리케이션 코드에서 체크, 별도 저장 안 함) + `Holiday` 테이블의 행. 날짜 컬럼은 UTC 자정으로 저장되는 `@db.Date`이며, 시간 요소가 없기 때문에 UTC 요일 = KST 요일이라 타임존 변환이 필요 없습니다.

### 대기자

`Waitlist` 행은 꽉 찬 날짜+시간대에 대해 손님을 줄 세우며, `WAITING` 상태인 것들 중 `createdAt` 기준 FIFO입니다. 취소가 발생하면(손님 셀프서비스 또는 관리자) `cascadeWaitlistNotification(date, slotId)`가 가장 먼저 대기 중인 항목에 알림을 보냅니다 (`NOTIFIED` + 24시간 `notifyExpiresAt` 설정, 확정 링크 메일 발송). 이 함수는 `apps/web/app/[locale]/reservations/reservation-shared.ts`, `apps/app/app/(authenticated)/admin/waitlist-cascade.ts`, `apps/api/app/cron/waitlist-timeout/waitlist-cascade.ts` 세 곳에 **중복**되어 있습니다 — 이 셋은 서로 다른 곳에 배포되는 별도의 Next.js 앱이라 서로의 라우트-로컬 코드를 import할 수 없고, 이 로직은 `@repo/database` + `@repo/email`을 섞어 쓰는데 이건 어느 프로바이더 교체형 패키지에도 어울리지 않기 때문입니다. 이 로직을 바꿀 땐 세 곳을 모두 동기화하세요. `apps/api`의 `/cron/waitlist-timeout` 작업이 `notifyExpiresAt`이 지난 항목을 만료시키고 다음 항목으로 넘깁니다.

### 만족도 설문

`Feedback` 행은 (응답 시점이 아니라) **발송 시점**에 생성되어서, 손님이 응답하기 전이라도 `surveySentAt`/`reminderSentAt`으로 타이밍 윈도우를 계산할 수 있습니다. 발송/리마인드 로직은 Supabase **Edge Function**(`send-survey-emails`, Supabase MCP/CLI로 배포되며 이 저장소의 빌드에는 포함되지 않음)에 있고, `pg_cron`이 매시간 호출합니다 (`select cron.schedule('send-survey-emails-hourly', '0 * * * *', ...)`, Supabase Vault에 `project_url`/`publishable_key`로 저장된 값으로 `net.http_post` 호출). 이 함수는 `completedAt`이 24시간 이상 지났고 아직 `Feedback` 행이 없는 `COMPLETED` 예약을 찾아 발송하고(dispatch), 발송된 지 3일 이상 지났는데 응답도 리마인더도 없는 `Feedback` 행을 찾아 리마인더를 보냅니다. Edge Function은 `RESEND_TOKEN`/`RESEND_FROM`/`WEB_URL`을 Supabase Edge Function 시크릿으로 필요로 합니다(`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`는 자동 주입됨) — 이 값들이 없어도 함수는 정상 실행되고 `Feedback` 행도 만들어지지만, 메일 발송만 조용히 no-op됩니다. `relationMode = "prisma"`라 실제 Postgres 외래키가 없으므로, 이 함수는 PostgREST의 관계 임베딩(`select=*,Reservation(*)`)을 쓸 수 없어 모든 join을 수동으로 두 번째 쿼리로 처리합니다.

`/cron/complete-reservations`가 하루에 한 번만 도는 탓에(위 Hobby 플랜 관련 설명 참고), 실제 방문부터 설문 메일이 도착하기까지의 간격은 깔끔한 24시간이 아니라 1~2일에 가깝습니다 — 24시간 발송 대기가 시작되기도 전에, 이용완료 처리 자체가 방문 시점보다 최대 하루 늦어질 수 있기 때문입니다.

**Gotcha**: Edge Function이 사용하는 `service_role`은 `bypassrls` 속성이 있지만, 이것이 일반적인 테이블 GRANT를 대신해주지는 **않습니다** — Postgres는 이걸 별도로 요구하며, `db push`가 만드는 테이블은 `prisma` 롤 소유이기 때문에(아래 "실시간 가용성" 참고) `service_role`은 명시적으로 권한을 주기 전까지 아무 권한도 없었습니다 (`grant select on "Reservation" to service_role; grant select, insert, update on "Feedback" to service_role;`). Edge Function이 다뤄야 하는 테이블이 재생성되면 이 권한 부여를 다시 해줘야 하며, 안 그러면 모든 쿼리가 `permission denied for table X`로 조용히 실패합니다 (Supabase의 `function_logs`에서 확인 가능, `function_edge_logs`가 아님).

### 실시간 가용성 (Supabase Realtime Broadcast)

DB는 Supabase Postgres이며, Prisma의 `@prisma/adapter-pg`(node-postgres) 드라이버 어댑터(`packages/database/index.ts`)로 접속하되, 앱 런타임에서는 Supabase Supavisor의 **트랜잭션 모드 풀러**(6543번 포트, `?pgbouncer=true`)를 씁니다 — `packages/database/.env`(오직 `prisma` CLI의 `db push`/`generate`용)는 대신 **세션 모드 풀러**(5432번 포트)를 쓰는데, 트랜잭션 모드는 Prisma의 마이그레이션 엔진이 필요로 하는 prepared statement를 지원하지 않기 때문입니다.

"실시간" 업데이트는 `postgres_changes`가 아니라 Supabase Realtime **Broadcast from Database**를 씁니다: `SECURITY DEFINER` 트리거(`public.broadcast_reservation_changes`, `Reservation`과 `Waitlist` 양쪽에 걸림)가 단일 전역 `reservations` 토픽으로 `realtime.broadcast_changes()`를 호출하는데, old/new record는 `null`로 넘깁니다 — **브로드캐스트 페이로드는 의도적으로 행 데이터를 담지 않고**, "뭔가 바뀌었다"는 신호만 담습니다. `postgres_changes`나 순진한 브로드캐스트를 썼다면 구독자 누구에게나 손님 개인정보(이름/전화번호/이메일)가 새어나갔을 것이기 때문입니다. 두 앱의 브라우저 클라이언트(`@repo/realtime`의 `useReservationChangeSignal` 훅)는 Supabase `anon` 롤로 접속하고(두 앱 다 Supabase Auth를 쓰지 않음 — `apps/web`은 설계상 비인증, `apps/app`은 Clerk 사용), 이벤트가 오면 브로드캐스트 페이로드를 읽는 대신 기존의 안전한 서버 액션(`getAvailability`, `getFilteredReservations` 등)을 그냥 다시 호출합니다. `realtime.messages`의 RLS 정책은 `anon`/`authenticated`에게 `SELECT`를 허용합니다(채널에 데이터가 없으니 안전함); 트리거 함수의 `EXECUTE` 권한은 `anon`/`authenticated`/`public`에서 회수했는데, `SECURITY DEFINER` 함수는 기본적으로 PostgREST RPC로 누구나 호출할 수 있기 때문입니다. 모든 앱 테이블(`TimeSlot`, `Holiday`, `Reservation`, `Waitlist`, `Feedback`)은 RLS가 켜져 있고 **정책은 없습니다**(기본 거부) — 심층 방어 차원이며, 이 테이블들은 오직 (`bypassrls`를 가진) `prisma` Postgres 롤을 통해서만 조회되고 Data API를 거치는 일이 없습니다.

클라이언트 측 폴링(`reservation-form.tsx`, `reservations-table.tsx`의 `POLL_INTERVAL_MS`)은 Realtime 연결이 끊겼을 때를 대비한 폴백으로 남겨뒀고, 즉시 반응하는 브로드캐스트 기반 refetch 아래 겹쳐 있습니다 — 이 코드를 건드릴 때 폴링을 제거하지 마세요.

**Gotcha**: 페이지가 처음 요청된 *이후에* 생겨날 수 있는 DB 행에 `notFound()`/내용이 좌우되는 페이지(`/waitlist/[token]`, `/survey/[token]`)는 반드시 `export const dynamic = "force-dynamic"`을 설정해야 합니다. 이게 없으면 Vercel 엣지가 어떤 토큰의 최초 응답(404)을 영구히 캐시해버립니다 — 해당 행이 생성된 지 몇 초 후 발송된 메일 링크를 손님이 처음 클릭해도, Next.js의 빌드타임 분석이 Prisma 호출을 `fetch()`처럼 요청마다 렌더링이 필요한 신호로 인식하지 못하기 때문에, 실제로는 행이 존재하는데도 영원히 404가 뜰 수 있습니다.

## 참고사항

- 저장소 루트의 `apikey.txt`에는 실제 API 키가 들어있고 `.gitignore`에 **포함되어 있지 않습니다**. `git status`를 먼저 확인하지 않고 `git add -A`/`git add .`를 실행하지 마세요. 이 파일은 절대 커밋하지 마세요.
- 인증은 Clerk(`@repo/auth`)이며 `apps/app`(관리자 대시보드)에서만 사용됩니다 — 퍼블릭 `apps/web` 예약 플로우는 의도적으로 비인증입니다. 두 앱 모두 Supabase Auth는 사용하지 않습니다.
- `packages/database/generated/`는 Prisma가 생성한 클라이언트 출력물입니다 — 직접 수정하지 마세요, `prisma generate`로 재생성됩니다.
- `packages/database/.env`(CLI 전용, direct/session 풀러 연결)와 각 앱의 `.env.local`(앱 런타임용, transaction 풀러 연결)은 둘 다 같은 Supabase 프로젝트에 대해 서로 다른 연결 문자열로 `DATABASE_URL`을 설정하는데, 이건 의도된 것입니다 — 위 "실시간 가용성" 참고.
