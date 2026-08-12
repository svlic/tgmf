# Project guide

## Structure

- `src/app`: Next.js 16 App Router UI and API routes; `src/components`: shared UI; `src/lib`: domain and server logic.
- `worker/index.ts`: independent sync worker. Web and worker share the SQLite database configured by `DATABASE_URL`.
- Telegram transfers live in `src/lib/telegram/service.ts`; persistence lives in `src/lib/db`.

## Invariants

- For Next.js API or convention changes, use the installed-version docs in `node_modules/next/dist/docs/`.
- Keep credentials, login state, admin secrets, and encryption keys server-side and out of browser payloads and logs.
- `captioned_only` affects only `groupedId` albums: process the captioned member and skip its siblings; process non-album messages regardless of text.
- `forward` preserves album grouping; `copy` processes album members individually.
- Transfer records in `sent`, `warn`, or `skipped` are terminal. Failed or incomplete records remain retryable.

## Verify

Run the relevant scripts: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Transfer changes require focused tests covering album and non-album behavior.
