# Mini Trello

Collaborative Kanban boards with real-time updates: workspaces with Admin/Member roles, boards,
columns and drag-and-drop tasks, comments with @mentions, an activity feed, notifications and task
history. Every change appears instantly for everyone on the board.

**Stack:** Next.js 16 · Express 5 · Socket.IO 4 · MongoDB 8 (Mongoose) · JWT in an httpOnly cookie ·
TanStack Query · shadcn/ui + Tailwind CSS · zod · Vitest

## Live demo

**https://usman-mini-trello.vercel.app** · API: https://mini-trello-api.onrender.com/health

- Register two accounts (for example in Chrome and in an incognito window) and add the second one to
  your workspace by email to see real-time updates.
- Runs on free tiers: the API sleeps after 15 idle minutes, so the **first request can take about a
  minute**. Use Chrome, Edge or Firefox; Safari blocks the cross-site session cookie (see
  [Deploy](#deploy-free-tiers)).

## Contents

- [Live demo](#live-demo)
- [Run it](#run-it) · [Configuration](#configuration-backendenv) · [Deploy](#deploy-free-tiers)
- [Architecture](#architecture)
- [Data model](#data-model)
- [API](#api)
- [Real-time](#real-time)
- [Concurrency and retries](#concurrency-and-retries)
- [Security](#security)
- [Tests](#tests)
- [Requirements and choices](#requirements-and-choices)
- [Limitations and how I'd finish them](#limitations-and-how-id-finish-them)
- [Credits and AI assistance](#credits-and-ai-assistance)

## Run it

### Option 1 — Docker (one command)

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))" > .env
docker compose up --build
```

Open http://localhost:3000. MongoDB runs as a replica set inside Compose; data is kept in a volume.

### Option 2 — Node.js

Requires **Node.js ≥ 22.12** and **MongoDB running as a replica set** (transactions need one; a
single node is enough — the API refuses to start otherwise). For example with Docker:

```bash
docker run -d --name mini-trello-mongo -p 27017:27017 mongo:8.0 --replSet rs0 --bind_ip_all
docker exec mini-trello-mongo mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
```

(Or a local MongoDB with `replication.replSetName: rs0` in `mongod.cfg` plus `rs.initiate()`, or any
MongoDB Atlas cluster.) Then:

```bash
npm install
cp backend/.env.example backend/.env           # set JWT_SECRET: see the command above
cp frontend/.env.example frontend/.env.local
npm run dev                                    # web: http://localhost:3000, API: http://localhost:4000
```

Or run each part on its own: `npm run dev -w @mini-trello/backend` (API) and
`npm run dev -w @mini-trello/frontend` (web).

To try real-time collaboration, register a second user in another browser and add them to your
workspace by email. `npm run check` runs format check, lint, typecheck and all tests (as CI does).

### Configuration (`backend/.env`)

| Variable                                               | Notes                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `NODE_ENV`                                             | required: `development` or `production` (Secure cookies, no dev routes)         |
| `MONGODB_URI`                                          | required, a replica set: `mongodb://127.0.0.1:27017/mini-trello?replicaSet=rs0` |
| `CORS_ORIGINS`                                         | required, allowed web origins, e.g. `http://localhost:3000`                     |
| `JWT_SECRET`                                           | required, ≥ 32 random characters (the example value is rejected)                |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE`                    | default: Secure in production, `lax`                                            |
| `TRUST_PROXY`                                          | number of reverse proxies in front of the API (default 0)                       |
| `PORT`, `AUTH_RATE_LIMIT_MAX`, `LOG_LEVEL`, `LOG_FILE` | optional                                                                        |

Frontend: `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:4000`). Deploy web and API on the same site
(e.g. `app.example.com` + `api.example.com`) so the session cookie stays first-party.

### Deploy (free tiers)

- **Database:** MongoDB Atlas free cluster (already a replica set). Allow access from anywhere
  (`0.0.0.0/0`) because the API host's IPs change.
- **API:** Render free web service from this repo using `backend/Dockerfile` (health check
  `/health`). Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS=<web URL>`,
  `TRUST_PROXY=1`, `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`. Free services sleep after 15 idle
  minutes; the first request then takes about a minute.
- **Web:** Vercel with root directory `frontend` and `NEXT_PUBLIC_API_URL=<API URL>`.
- `*.vercel.app` and `*.onrender.com` are different sites, so the session cookie is a cross-site
  cookie: works in Chrome, Edge and Firefox, but Safari blocks it. With a custom domain
  (`app.example.com` + `api.example.com`) keep `COOKIE_SAME_SITE=lax` and it works everywhere.

## Architecture

```
frontend/  Next.js · features/<name>/{api,hooks,components} · TanStack Query · Socket.IO client
backend/   Express routes → controllers → services → Mongoose models · Socket.IO server
shared/    zod request schemas, response types, error codes, Socket.IO event contract
```

- **Writes go through REST; Socket.IO only broadcasts.** A service writes the change, its activity
  entry, history revision and notifications in **one MongoDB transaction**; the controller broadcasts
  only after the commit, so a failed write is never broadcast.
- **One contract** (`shared/`): the same zod schemas validate requests on the API and forms in the
  browser.
- **One authorization layer** (`workspace-access.ts`, `board-access.ts`) used by REST and sockets.
- The client patches its TanStack Query cache from socket events, ignoring events older than its
  cached task `version`; drag-and-drop is optimistic with rollback.

## Data model

Embedded when small, bounded and always read with the parent; referenced when it grows, is paged or
filtered on its own, or is written independently.

| Collection                                                 | Notes                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `users`                                                    | email unique; password hash never returned                                                                                      |
| `workspaces`, `memberships`                                | memberships referenced (queried both ways: members of W, workspaces of U); `adminCount` guards "at least one Admin"             |
| `boards`                                                   | **columns embedded** (few, max 20, always read with the board; array order = display order)                                     |
| `tasks`                                                    | referenced; `position` (gapped floats for ordering), `version` (concurrency), `workspaceId` copied for one-lookup authorization |
| `comments`, `activities`, `notifications`, `taskrevisions` | referenced: unbounded and paged; notifications keep name/title snapshots                                                        |

**Indexes:** `users {email}` unique · `memberships {workspaceId, userId}` unique (every access check)
and `{userId}` · `boards {workspaceId, createdAt}` · `tasks {boardId, columnId, position}` (board in
display order) and `{workspaceId, assigneeId}` · `comments {taskId, _id}` · `activities {boardId, _id}`,
`{boardId, actorId, _id}`, `{boardId, action, _id}` (filtered feed pages) · `notifications {userId, _id}`
and `{userId, readAt}` (unread count) · `taskrevisions {taskId, version}` unique · `{boardId}` on child
collections for cascading deletes · `{creator, requestId}` unique on every created collection
(retry dedupe). Title search is an escaped, case-insensitive substring match scoped to one board
via the `boardId` index prefix — fine at board scale.

## API

Errors are always `{ "error": { "code", "message", "details"? } }`. Everything except
register/login/health needs the session cookie; state-changing requests need an allowed `Origin`.
Anything a user can't access returns **404**; a member without the Admin role gets **403**.

| Area              | Endpoints                                                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth              | `POST /api/auth/register`, `/login`, `/logout` · `GET /api/auth/me`                                                                                                                                 |
| Workspaces        | `GET/POST /api/workspaces` · `GET /api/workspaces/:id` · `GET/POST …/:id/members` (add: Admin) · `PATCH/DELETE …/members/:userId` (Admin, or leave yourself)                                        |
| Boards & columns  | `GET/POST /api/workspaces/:id/boards` · `GET/PATCH/DELETE /api/boards/:boardId` (delete: Admin) · `POST /api/boards/:boardId/columns` · `PATCH/DELETE …/columns/:columnId` (delete only when empty) |
| Tasks             | `GET /api/boards/:boardId/tasks?q=&assignee=&priority=&column=` · `POST /api/boards/:boardId/tasks` · `GET/PATCH/DELETE /api/tasks/:taskId` · `PATCH /api/tasks/:taskId/move`                       |
| Comments, history | `GET/POST /api/tasks/:taskId/comments` · `GET /api/tasks/:taskId/history` · `POST …/restore`                                                                                                        |
| Activity          | `GET /api/boards/:boardId/activity?cursor=&limit=&actor=&action=&from=&to=`                                                                                                                         |
| Notifications     | `GET /api/notifications` · `GET …/unread-count` · `PATCH …/:id/read` · `PATCH …/read-all`                                                                                                           |
| Health            | `GET /health` (database and transaction support)                                                                                                                                                    |

## Real-time

- **Handshake:** allowed `Origin` + the same session cookie as REST; sockets close when the session
  expires.
- **Rooms:** `board:<id>` (joined via `board:join`, which re-checks membership in the database) and
  `user:<id>` (personal events). Removing a member immediately takes their sockets out of that
  workspace's boards.
- **Client → server:** `board:join` (ack with online users), `board:leave`,
  `typing:start` / `typing:stop` `{ boardId, taskId, target: 'task' | 'comment' }`.
- **Server → client:** `task:created|updated|deleted`, `board:updated|deleted|stale`,
  `comment:created`, `activity:created`, `presence:update`, `typing:update` (board room);
  `notification:created`, `notifications:changed`, `workspaces:changed`, `board:access-revoked`
  (user room). REST calls send `X-Socket-Id` so the sender isn't echoed its own change.
- **Reconnect:** status shows Live / Reconnecting / Offline; after reconnecting the client re-joins
  its board and refetches everything. Presence is tracked per socket (multiple tabs stay online);
  typing indicators also expire on their own.

## Concurrency and retries

- **Same task edited by two people:** every task has a `version`. Edits, moves and restores send the
  version the user started from and run as one atomic `findOneAndUpdate({ _id, version })` that
  increments it. If someone saved first, the API returns **409 `VERSION_CONFLICT`**, writes and
  broadcasts nothing, and the editor loads the latest version for review (unsaved typing is never
  overwritten). _Test:_ open one task in two browsers, edit both, save both — the second gets the
  conflict message; or send two `PATCH /api/tasks/:id` with the same `version`.
- **Retries:** creates carry a client-generated `requestId` reused on retry; a unique index returns
  the original (200) instead of creating a duplicate, with no second broadcast. Updates are
  protected by `version`, deletes are idempotent, and optimistic drag-and-drop rolls back on failure.
- **Other rules:** the last Admin can't be removed or demoted (conditional decrement inside a
  transaction); columns are deleted only when empty; removed members are unassigned.

## Security

Argon2id passwords · HS256 JWT in an httpOnly, SameSite, Secure (production) cookie · Origin check on
every write and on the socket handshake (CSRF) · authorization on every route and socket event · zod
validation of every body and query (no mass assignment, escaped search) · rate limits on sign-in,
sign-up and comments · capped page and body sizes · helmet on the API and anti-framing headers on the
web app · no `dangerouslySetInnerHTML` · secrets only from the environment (weak or example secrets
are refused). `npm audit --omit=dev`: 0 vulnerabilities.

## Tests

Backend (Vitest + Supertest on an in-memory MongoDB replica set): auth, roles, workspace isolation,
CRUD, ordering, simultaneous edits, retries, comments, activity, filters, notifications, history,
Socket.IO auth/rooms/presence/typing/broadcasts, configuration safety. Frontend (Vitest + Testing
Library): API client, forms, live-update merging, ordering, filters, mentions, notification and
activity text. GitHub Actions runs format, lint, typecheck, tests and build on every push and PR.

## Requirements and choices

All mandatory requirements (sections 1–5 and 7 of the brief) are implemented.
**Additional challenges: A — Notifications** (assigned, unassigned, @mentioned; live; unread count;
mark read) and **B — Activity improvements** (cursor pagination; person, action and date filters) —
chosen because they build on daily workflow (assignments, the feed) and reuse the real-time and
activity infrastructure without new services. Also included: **E — task history** with restore,
**F — CI**, and Docker Compose.

## Limitations and how I'd finish them

| Limitation                                                                                   | Next step                                                                                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Invites only for registered users; invite and sign-up reveal whether an email has an account | Challenge D: e-mailed invite links with expiry and accept/reject, and a neutral "check your inbox" response |
| One API instance: presence, rooms and rate limits live in memory                             | Socket.IO Redis adapter and a Redis store for presence and rate limits                                      |
| 24-hour sessions, no refresh or early revocation                                             | Short access token + rotating refresh token, or a per-user token version checked on each request            |
| Title search is a scoped regex                                                               | MongoDB Atlas Search (or a text index) once boards hold thousands of tasks                                  |
| Restore keeps the task's current column                                                      | Offer "restore column too" in the history view                                                              |
| No e-mail, attachments or unread-comment counts                                              | Out of scope for the timebox (attachments = Challenge C)                                                    |

## Credits and AI assistance

Scaffolded with `create-next-app`; UI primitives from shadcn/ui (Radix). Built with the help of an AI
coding assistant (Anthropic's Claude, via Claude Code) for planning, code, tests, reviews and
documentation; every change was reviewed, run and tested before being committed.
