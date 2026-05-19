# Telegram Message Transfer

Telegram Channel Message Transfer management system built with Next.js, TypeScript, SQLite, GramJS, and a standalone worker process.

## What it does

- Password-protected admin console
- Multiple Telegram user accounts with saved sessions
- Phone login, code verification, and 2FA password flow
- Dialog and channel cache per Telegram account
- Sync jobs for forwarding or copying a message ID range between channels
- Worker heartbeat and per-message transfer records
- Single-machine deployment with Docker Compose

## Important constraints

- The app does not bypass Telegram permissions.
- Private channels are only accessible if the logged-in Telegram account already has access.
- Protected content and no-forward restrictions are not bypassed.
- Sensitive values such as `ADMIN_PASSWORD`, `APP_ENCRYPTION_KEY`, Telegram API hashes, login sessions, codes, and 2FA passwords must stay server-side.

## Environment variables

Copy `.env.example` to `.env` and fill in real values:

```env
DATABASE_URL=data/app.db
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
APP_ENCRYPTION_KEY=
ADMIN_PASSWORD=
APP_BASE_URL=http://localhost:3000
WORKER_ID=
```

### Notes

- `DATABASE_URL` should point to the SQLite database file shared by the web app and worker.
- `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` act as defaults for accounts that do not override them.
- `APP_ENCRYPTION_KEY` is used to encrypt stored secrets at rest and should be a strong random 32-byte secret.
- `ADMIN_PASSWORD` protects the admin console. It may be plain text or a bcrypt hash; production deployments should prefer a bcrypt hash.
- `WORKER_ID` is optional for local runs; Docker Compose sets it for the worker service.

## Local development

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev
```

Start the worker in a separate shell:

```bash
npm run worker:dev
```

The `worker:dev` script loads local values from `.env.local` during development. The production-safe `worker` script expects values to come from `.env` or the surrounding process environment.

Open [http://localhost:3000](http://localhost:3000) and log in with `ADMIN_PASSWORD`.

## Production build

```bash
npm run build
npm run start
```

The worker still runs separately:

```bash
npm run worker
```

This command does not force-load `.env.local`; set environment variables through `.env` or your process manager before starting it.

## Docker Compose

Build and start both services:

```bash
docker compose up --build
```

This starts:

- `web`: Next.js admin console on port `3000`
- `worker`: standalone polling worker sharing the same SQLite file

The `./data` directory is mounted into both containers so they share the same SQLite database.

## Current behavior and v1 limitations

- Worker design is single-machine and single-worker.
- `copy` mode currently supports text messages reliably. Media copy paths are not fully implemented yet.
- Album handling is partial:
  - `captioned_only` is implemented in a minimal form
  - `full_group` still needs deeper grouped-media handling
- Pending Telegram login state for code verification is currently stored in process memory during the login flow.
- The worker processes pending jobs, writes heartbeats, records per-message outcomes, and respects pause/cancel state checks between messages.

## Main scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run worker
npm run worker:dev
```

## Project layout

- `/opt/ocode/tgmf/src/app` - Next.js app routes and API routes
- `/opt/ocode/tgmf/src/components` - dashboard UI components
- `/opt/ocode/tgmf/src/lib` - auth, env, crypto, db, validation, Telegram services
- `/opt/ocode/tgmf/worker/index.ts` - standalone worker loop
- `/opt/ocode/tgmf/data` - SQLite database location

## Operational flow

1. Log into the admin console.
2. Create a Telegram account entry.
3. Start Telegram login with a phone number.
4. Complete verification code and 2FA if required.
5. Refresh dialogs/channels for that account.
6. Create a sync job with source, target, mode, order, and message ID range.
7. Run the worker and monitor job progress plus heartbeat status.
