# Project guidance

## Architecture

- Next.js 16.2 admin UI and API routes live in `src/app`; shared server logic is in `src/lib`.
- `worker/index.ts` runs sync jobs independently from the web process. Both processes share the SQLite database under `data/`.
- Telegram transfer behavior is concentrated in `src/lib/telegram/service.ts`; persistence is in `src/lib/db`.

## Project rules

- This repository uses Next.js 16.2. Before changing framework APIs or conventions, consult the matching guide in `node_modules/next/dist/docs/`; do not rely on older Next.js behavior.
- Keep Telegram credentials, login state, admin credentials, and encryption keys server-side. Never expose them through client components, browser responses, or logs.
- `captioned_only` applies only to Telegram albums (`groupedId`). It selects the captioned album member and skips the rest; non-album messages must be processed normally with or without text.
- Preserve the current transfer distinction: `forward` sends an album as a group, while `copy` handles its messages individually.
- Preserve resumability: terminal transfer records (`sent`, `warn`, `skipped`) are not processed again; failed or incomplete records remain retryable.

## Verification

Run the checks relevant to the change:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For transfer changes, add or update focused tests beside the Telegram logic and verify both album and non-album behavior.
