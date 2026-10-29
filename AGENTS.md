# Project guide

## Architecture

- Single host, single Worker (`worker/index.ts`); Web/Worker share SQLite (`DATABASE_URL`) and encryption key.
- Transfers: `src/lib/telegram/service.ts`; persistence: `src/lib/db`.

## Invariants

- Credentials, sessions, and encryption keys stay server-side, never logged. Preserve existing keys to keep stored sessions decryptable.
- Album policies affect only `groupedId` albums; other filters still apply:
  - `captioned_only`: select first nonblank caption; skip siblings (all if none).
  - `full_group`: reject whole albums crossing ID bounds or failing media/text filters; combine captions for text filtering.
- `forward` preserves albums; `copy` sends members individually.
- `sent`/`warn`/`skipped` records are terminal. [Recovery improvements](docs/recovery-plan.md) are planned, not implemented.

## References

- Next.js API/convention changes: installed docs in `node_modules/next/dist/docs/`.
- UI changes: [DESIGN.md](DESIGN.md).

## Verify

Run relevant checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Test transfers with albums and standalone messages.
