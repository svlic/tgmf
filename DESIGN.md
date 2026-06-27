# TGMF design system

Admin console for Telegram channel transfer operations. Tone: calm, operational, high signal-to-noise — not marketing glassmorphism.

## 1. Color tokens

All UI colors come from `src/app/globals.css` `:root` and `@theme inline`. Do not introduce raw hex in components.

| Token | Use |
|-------|-----|
| `--background` / `--foreground` | Page canvas and body text |
| `--primary` | Primary actions, active nav, progress fill |
| `--secondary` / `--muted` | Surfaces and secondary text |
| `--border` | Dividers and card outlines |
| `--destructive` | Danger actions |
| `--success` / `--warning` | Status via `Badge` variants |

## 2. Typography

- **Sans**: Geist (`--font-geist-sans`) — UI and headings
- **Mono**: Geist Mono — IDs, env keys, channel refs
- **Page title**: `text-2xl font-semibold tracking-tight`
- **Section title**: `text-lg font-semibold`
- **Eyebrow / label**: `text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground`
- **Body**: `text-sm leading-6 text-muted-foreground` (max ~65ch in hero copy)
- **Tabular data**: `font-variant-numeric: tabular-nums` on stat values

## 3. Spacing and radius

- Page vertical rhythm: `space-y-6` between major blocks
- Card padding: `CardHeader` / `CardContent` defaults (px-6 py-5)
- Radius scale: `--radius-sm` through `--radius-xl` via Tailwind `rounded-lg`, `rounded-[var(--radius-xl)]`
- Dashboard max width: `max-w-[1400px]` in shell

## 4. Surfaces

- **Default card**: `Card` component (`surface-glass` + `surface-panel` baked in)
- **Inset stat / meta**: `rounded-lg border border-border/60 bg-background/80 px-4 py-3`
- **Avoid**: duplicate long custom shadows on every card; prefer default `Card` shadow

## 5. Components

| Pattern | Location |
|---------|----------|
| Primary / secondary buttons | `Button`, `LinkButton` |
| Page title + actions | `PageHeader` |
| Metric tile | `StatTile` |
| Status chips | `Badge` + `jobStatusVariant` from `@/lib/job-ui` |
| Empty lists | `EmptyState` |
| Forms | `Field` + `Button` |

## 6. Motion

- Transitions: `duration-200 ease-out` on interactive elements
- Hover lift: `hover:-translate-y-0.5` on buttons only (not every card)
- Progress bars: `transition-[width] duration-500`
- GPU-only: `transform`, `opacity`, `width` (progress)

## 7. Layout

- Dashboard: sticky sidebar (xl+), single main column
- Jobs list: compact rows for scanability; detail on `/jobs/[id]`
- No duplicate worker/status blocks on the same viewport