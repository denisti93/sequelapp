# Game Plan: Racha Manager (Full Project Context for Future LLM Agents)

## 1. Purpose of This Document
This file is a handoff guide for a future LLM/coding agent. It explains how the project works end-to-end (backend + frontend), what business rules are already implemented, where key logic lives, and how to safely extend the app.

The product domain is "racha" (friendly soccer matches). In code, many entities still use `pelada` naming (models/routes/files), while UI labels generally say "Racha".

---

## 2. Current Stack and Architecture

### Backend
- Runtime: Node.js (ES modules)
- Framework: Fastify
- Database: MongoDB via Mongoose
- Auth: JWT (`@fastify/jwt`)
- Password hashing: `bcryptjs`
- Optional integrations:
  - AWS S3 for profile images
  - Web Push (`web-push`) for PWA notifications

Entry points:
- `backend/src/server.js`
- `backend/src/app.js`

### Frontend
- Framework: Angular 17 (standalone components)
- UI: Angular Material
- PWA: Angular Service Worker + web manifest
- State style: local component state + service calls (no global state library)

Entry points:
- `frontend/src/main.ts`
- `frontend/src/app/app.config.ts`
- `frontend/src/app/app.routes.ts`

---

## 3. Repository Map

- `backend/src/models`
  - `User.js`
  - `Pelada.js`
- `backend/src/routes`
  - `auth-routes.js`
  - `user-routes.js`
  - `pelada-routes.js`
- `backend/src/services`
  - `stats-service.js` (global stat recalculation)
- `backend/src/utils`
  - `pelada.js` (team validation and participant extraction)
  - `tournament.js` (round robin matches + standings)
  - `push-notification.js` (VAPID/web push)
  - `profile-image.js` (S3 upload/delete/fetch)
  - `user-visibility.js` (rating visibility by role)

- `frontend/src/app/pages`
  - `login`, `signup`
  - `pelada-list` (home list + admin panel)
  - `pelada-detail` (main racha operations)
  - `ranking`
  - `profile`
- `frontend/src/app/core/services`
  - `auth.service.ts`
  - `user.service.ts`
  - `pelada.service.ts`
  - `push-notification.service.ts`
- `frontend/src/app/models`
  - `user.ts`, `pelada.ts`

---

## 4. Local Run and Build

## Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

## Frontend
```bash
cd frontend
npm install
npm start
```

## Build checks used in this project
```bash
cd frontend && npm run build
cd backend && node --check src/routes/pelada-routes.js
```

There are no automated tests currently in the repo.

---

## 5. Environment Variables

Backend env file template: `backend/.env.example`

Required:
- `MONGO_URI`
- `JWT_SECRET`

Optional S3 (all required together if any is set):
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` (optional)
- `AWS_S3_PROFILE_PREFIX` (default `profile_image`)
- `AWS_S3_PUBLIC_BASE_URL` (optional)

Optional Web Push (both required together):
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

Frontend env (`frontend/src/environments/environment.ts`):
- `apiUrl`
- `webPushPublicKey`

Important: this project currently has a single `environment.ts` file (no `environment.prod.ts`). Production URL handling is done by replacing/editing this file before build or by introducing a runtime config strategy.

---

## 6. Data Model and Domain Concepts

## User model (`backend/src/models/User.js`)
Main fields:
- identity: `name`, `username`, `passwordHash`
- access: `role` (`ADM` or `JOGADOR`), `approvalStatus` (`PENDING` or `APPROVED`)
- profile: `position` (`ZAGUEIRO|MEIA|ATACANTE`), `profileImageUrl`
- rating: `initialRating`, `ratingAverage`
- cumulative stats:
  - `totalGoals`, `totalAssists`
  - `totalWins`, `totalDraws`, `totalLosses`
  - `totalCraquePoints`, `totalCraqueFirstPlaces`, `totalCraqueSecondPlaces`, `totalCraqueThirdPlaces`
  - `totalTournamentTitles`
- push subscriptions array (`pushSubscriptions`)

Serialization hides sensitive fields (`passwordHash`, `pushSubscriptions`).

## Pelada (Racha) model (`backend/src/models/Pelada.js`)
Main fields:
- `date`, `type` (`NORMAL` or `TOURNAMENT`), `status` (`OPEN` or `CONCLUDED`)
- `teams[]` each with:
  - `name`
  - `players[]` (registered users)
  - `guestPlayers[]` (name + position only)
  - `goalkeepers[]` (strings)
  - `wins`, `draws`, `losses`
- `playerStats[]` (goals/assists by registered player)
- voting:
  - `votingStatus` (`CLOSED|OPEN|FINISHED`)
  - `votes[]` (1..5 ratings)
  - `craqueVotes[]` (1st/2nd/3rd)
  - `craqueResult` snapshot (top3 points at close)
- presence:
  - `presenceOpenAt`
  - `presenceEntries[]` with timestamp ordering
- tournament:
  - `tournamentMatches[]` (home/away/round/goals)

Guest players are display-only in teams and do not participate in voting/stat totals.

---

## 7. Access Control and Visibility Rules

## Roles
- `ADM`: full management operations
- `JOGADOR`: limited operations + own profile/actions

## Approval gate
- New signup users are `JOGADOR` + `PENDING`.
- `authenticate` middleware blocks pending players from protected routes.
- ADM approves with `PATCH /users/:id/approve`.

## Rating visibility
- ADM can see all ratings.
- Players should not see other players' average ratings in general lists/details.
- Player can see own rating in `/users/me` and own match rating via rating cards response (`myMatchRating`).

Visibility helper: `backend/src/utils/user-visibility.js`.

---

## 8. Backend API Surface (What Exists)

## Auth
- `POST /auth/signup`
- `POST /auth/login`

## Users
- `GET /users/me`
- `PATCH /users/me/position` (player)
- `PATCH /users/me/profile` (player or admin self; used by player profile page)
- `POST /users/me/push-subscriptions` (player)
- `POST /users/me/push-subscriptions/remove` (player)
- `GET /users/pending` (ADM)
- `POST /users/notifications/broadcast` (ADM push to all approved players)
- `GET /users`
- `GET /users/ranking/by-position`
- `PATCH /users/:id/approve` (ADM)
- `PATCH /users/:id/initial-rating` (ADM)

## Rachas (`/peladas`)
- `GET /peladas`
- `POST /peladas` (ADM)
- `GET /peladas/:id`
- `PATCH /peladas/:id/teams` (ADM)
- `PATCH /peladas/:id/results` (ADM, non-tournament)
- `PATCH /peladas/:id/tournament-matches/:matchId` (ADM, tournament)
- `PATCH /peladas/:id/player-stats` (ADM)
- `POST /peladas/:id/voting/open` (ADM)
- `POST /peladas/:id/voting/finish` (ADM)
- `POST /peladas/:id/conclude` (ADM)
- `PATCH /peladas/:id/presence/config` (ADM)
- `POST /peladas/:id/presence/confirm` (player)
- `DELETE /peladas/:id/presence/confirm` (player)
- `POST /peladas/:id/votes` (participants during open voting)
- `POST /peladas/:id/craque-vote` (participants during open voting)
- `GET /peladas/:id/votes/details` (ADM)
- `PATCH /peladas/:id/votes/admin-edit` (ADM)
- `GET /peladas/:id/rating-cards`

---

## 9. Critical Business Rules (Already Implemented)

## Team configuration rules
- Backend validates 1 to 4 teams.
- Each team must have at least 1 and at most 5 players total (`registered + guests`).
- A registered player cannot belong to two teams in the same racha.
- Guest players require valid name + position.

Files:
- `backend/src/utils/pelada.js`
- `frontend/src/app/pages/pelada-detail/pelada-detail.component.ts`

## When teams are saved
- Team results/votes/craque votes are reset for that racha.
- Voting status returns to `CLOSED`.
- Tournament matches regenerate (if type is `TOURNAMENT`).
- Global user stats are recalculated.
- Push notification is sent to approved players: "Times do racha confirmados".

## Voting lifecycle
- Open voting: ADM action only.
- Finish voting: ADM action only.
- Concluded racha blocks further edits.
- Craque podium uses 5/3/1 weights and only contributes to global totals when voting status is `FINISHED`.

## Ratings
- Individual vote score is 1..5.
- Self-vote is forbidden.
- Duplicate vote (same fromUser -> toUser in same racha) is forbidden.
- Global average rating (`ratingAverage`) is recalculated from all received votes in history.

## Presence race condition handling
- Presence mark uses atomic `findOneAndUpdate` with conditions on:
  - open status
  - future date
  - window opened (`presenceOpenAt <= now`)
  - not already marked
- Order is based on exact `markedAt` timestamp and deterministic tie fallback.
- First 20 are confirmed, others waiting list.

## Tournament standings
- Double round-robin generation (ida/volta).
- Scoring: win +3, draw +1.
- Tie-breaks in standings: points -> head-to-head points -> goal diff -> goals for -> team name.

---

## 10. Global Stats Recalculation Strategy

Core service: `backend/src/services/stats-service.js`

Pattern:
1. Read all users and initialize total counters.
2. Read all rachas and aggregate:
   - team results -> wins/draws/losses
   - player stats -> goals/assists
   - votes -> rating sum/count
   - finished craque snapshot -> top3 totals
   - finished tournaments -> champion team players get title increment
3. Bulk update every user with computed totals.

This means totals are derived state (not incrementally trusted) and remain consistent after edits.

---

## 11. Frontend Architecture and Page Responsibilities

## Routing behavior
- `/login`, `/signup`: guest only
- `/peladas`: authenticated
- `/peladas/:id`: authenticated
- `/ranking`: authenticated
- `/perfil`: authenticated
- `/`:
  - admin -> `peladas`
  - player -> `perfil`

## Root shell
`AppComponent`:
- top navigation + mobile menu
- subscribes to `authService.user$`
- initializes web push registration for players via `PushNotificationService`

## Page: Pelada list (`pelada-list`)
- shared list/history for all users
- featured next open racha card
- admin tools:
  - create racha
  - approve pending users
  - broadcast push message to all players

## Page: Pelada detail (`pelada-detail`)
Main operational page:
- shows teams in field formation
- admin team editor (registered + guest players, max 4 teams)
- tournament fixtures and standings
- results and player stats forms
- presence controls (admin schedule, player mark/cancel)
- voting controls (open/finish/conclude)
- player rating flow and craque vote
- admin vote audit and edit
- export teams image feature (copy to clipboard or fallback download PNG)

## Page: Ranking (`ranking`)
- global table (goals/assists/titles/wins/draws/losses)
- admins also see average rating column and can set initial rating
- podium cards:
  - top scorers
  - top assists
  - top tournament titles
- top 3 by position (zagueiro/meia/atacante)

## Page: Profile (`profile`)
- player summary card
- edit name/last name
- set field position
- upload/remove profile image
- own rating is visible here because `/users/me` includes own rating context

---

## 12. PWA + Push Notification Flow

## PWA
- service worker enabled for production build
- manifest + icons configured
- Netlify SPA redirect is configured in `netlify.toml`

## Push registration
Frontend service: `frontend/src/app/core/services/push-notification.service.ts`
- only registers for `JOGADOR`
- requires SW enabled + `webPushPublicKey`
- asks notification permission
- sends subscription JSON to backend `/users/me/push-subscriptions`

## Push events currently emitted
- When teams are saved (`PATCH /peladas/:id/teams`)
- When voting opens (`POST /peladas/:id/voting/open`)
- When ADM sends manual broadcast (`POST /users/notifications/broadcast`)

Payload is built for Angular SW notification handling with `openWindow` URL action.

---

## 13. Deployment Notes

## Backend (Render typical setup)
- Build command: `npm install`
- Start command: `npm start`
- Required env: `MONGO_URI`, `JWT_SECRET`, optional S3/WebPush envs

## Frontend (Netlify)
Configured by `netlify.toml`:
- base: `frontend`
- build: `npm run build`
- publish: `dist/pelada-manager-frontend/browser`
- SPA redirect: `/* -> /index.html (200)`

Important: frontend production API URL must be set before build (current project uses static `environment.ts`).

---

## 14. Known Constraints / Caveats

1. No automated test suite yet.
2. CORS is currently permissive (`origin: true` in Fastify CORS).
3. Frontend environment is static; no runtime config loader.
4. Some older docs/readme lines may be stale compared to current features.
5. Component SCSS budget warning exists for `pelada-detail` (build still succeeds).

---

## 15. Safe Change Guidelines for Future Agents

When implementing new features, prefer this approach:
1. Keep role-based access enforced in backend routes first.
2. Update visibility rules (`user-visibility`) if exposing rating-sensitive data.
3. If changing any racha result/vote logic, ensure `recalculateAllUsersStats()` is still called where needed.
4. For anything time-sensitive/concurrent (presence), preserve atomic DB updates.
5. Keep guest players out of participant-only logic (`getParticipantIdSet` uses registered players only).
6. If adding push triggers, use `notifyPlayersSafely`/`sendPushNotificationToUsers` patterns.
7. For UI text, keep Portuguese labels consistent with existing app style.
8. If adding frontend service calls, mirror contract updates in `models/*.ts` and backend responses.

---

## 16. Quick Onboarding Checklist (for Next LLM Agent)

1. Read:
   - `backend/src/routes/pelada-routes.js`
   - `backend/src/routes/user-routes.js`
   - `backend/src/services/stats-service.js`
   - `frontend/src/app/pages/pelada-detail/pelada-detail.component.ts`
2. Confirm env settings for target environment.
3. Run frontend build to verify no type/template breakage.
4. For backend changes, run `node --check` on touched files at minimum.

This project has many cross-feature dependencies in the racha detail flow; most regressions come from changing one section without updating stats, visibility, or role restrictions.
