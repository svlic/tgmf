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

- **Default card**: `Card` — `bg-card`, `border-border/70`, `shadow-[var(--shadow-panel)]`
- **Inset stat / meta**: `Panel` (or `StatTile`, which wraps `Panel`)
- **Section titles** (in-page, below `PageHeader`): `SectionHeading`
- **Avoid**: glassmorphism, multi-layer page gradients, `bg-white/80` on controls, raw emerald/amber in components

## 5. Components

| Pattern | Location |
|---------|----------|
| Primary / secondary buttons | `Button`, `LinkButton` |
| Page title + actions | `PageHeader` |
| Section title + description | `SectionHeading` |
| Metric tile | `StatTile` → `Panel` |
| Inset blocks | `Panel` |
| Status chips | `Badge` + `jobStatusVariant` from `@/lib/job-ui` |
| Empty lists | `EmptyState` |
| Forms | `Field` + `Button` |
| Tables | `DataTable` |

## 6. Motion

- Transitions: `duration-200 ease-out` on interactive elements
- Buttons: color/opacity only; no hover lift on cards or list rows
- Progress bars: `transition-[width] duration-500`
- GPU-only: `transform`, `opacity`, `width` (progress)

## 7. Layout

- Dashboard: sticky sidebar (xl+), single main column
- Jobs list: compact rows for scanability; detail on `/jobs/[id]`
- No duplicate worker/status blocks on the same viewport