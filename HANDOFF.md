# ExxionOs — Handoff

> Read this first when starting a fresh chat.
> Companion: the plan at `C:\Users\p.mansouri\.claude\plans\ok-were-building-an-zesty-parrot.md`.

## Working style
- **Git authorship — ABSOLUTE RULE**: Parsa is the SOLE author of every commit. NEVER add Claude as
  co-author (`Co-Authored-By` trailers banned), and never mention Claude/AI in a commit message or
  PR body.
- **Collaborate**: agree with Parsa before locking significant decisions; propose with a
  recommendation. No subagents/orchestration unless he asks.
- **Phases**: work ships in 7 numbered phases (ledger below). Say **"next phase"** and the next
  unbuilt one starts. Each ends green on `tsc` · `lint` · `build`, with migrations applied AND
  schema-verified.
- **Verify, don't assume.** A green build proves compilation, not behaviour. Every claim in this
  file marked ✅ was measured or driven; anything unproven says so.
- **Make partial scope OBVIOUS** (scope ledger below) · keep this file current.

## What this is
**ExxionOs** — the internal system for **Exxion**, a premium 3D-printing company. **Two people**
(Parsa + Chaghar), so there are deliberately **no roles, no memberships, no permissions** — accounts
are created by hand in Supabase.

One login, six sections plus a dashboard and settings:
1. **Finance** — every expense/income. The hub: other sections write into it.
2. **Creative hub** — ideas · projects (collections → products) · issues → learnings.
3. **Equipment** — maintenance, supplies, reminders. Strongest finance link.
4. **Shipping** — the order lifecycle, client enquiry → build → delivered.
5. **Clients** — CRM + pattern analytics + events.
6. **Marketing** — campaigns, free samples, filming days, networking.

## ⚠️ BRANDING IS NOT DONE — read before any visual work
There is no brand yet. The current palette is a **deliberately neutral, high-quality placeholder**:
a deep magenta-rose brand (`oklch(0.58 0.19 344)`) with a cool cyan-teal accent, chosen to be
swappable rather than to say anything about Exxion.

**ALL colour lives in ONE place: the `@layer base` token block at the top of
`src/app/globals.css`.** Every component resolves colour through those CSS variables — a raw hex or
`rgb()` anywhere in a component is a bug. **The eventual brand pass edits that block and nothing
else.**

Two things to preserve when rebranding:
- **Contrast is measured, not eyeballed.** Dark: ink 17.7:1 · muted 9.1:1 · faint 5.6:1. Light:
  ink 18.0:1 · muted 6.7:1 · faint 4.7:1. `--danger-fill` exists *separately* from `--danger`
  because white text on the lighter `--danger` measured only 3.58:1 — the one irreversible button
  must clear 4.5:1 (it now measures 6.28:1). Re-measure after any palette change.
- **State colours are reserved.** `success`/`warning`/`danger` mean state and nothing else. Never
  use `success` to make a category badge look nicer — on the reference project a green "feature"
  tag collided with the green "done" state and had to be pulled. Category = icon + word.

## Stack & environment
- Next.js **16.2.10** (App Router, Turbopack, `staleTimes`), React **19.2.4**, Tailwind **v4**,
  lucide-react, recharts.
- Supabase project ref **`rzbvlpnfiuurgowxqjtc`**, region **`eu-north-1` (Stockholm)**.
  → `vercel.json` pins compute to **`arn1`**, beside the database. ⚠️ **If the DB region ever
  changes, change `vercel.json` in the same commit** or compute is stranded a continent away.
- Auth: email+password, accounts made by hand. **Public signups should be disabled in the
  dashboard — NOT yet verified.**
- Env (`.env.local`, gitignored, **strictly `KEY=value` — no spaces, no quotes**):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` (empty — the CLI is authenticated already,
  so `db push` works without it).
- GitHub `KaguSoftware/ExxionOs` (main). Windows 11 + PowerShell.

## Conventions — the inherited engineering rules
These come from KaguOs, where each was **measured**. They are why that system is fast.

- **COUNT WAVES, NOT QUERIES.** A round-trip is ~305ms; a query added to an existing `Promise.all`
  costs ~3ms. **One wave per route.** A new stat goes INSIDE the page's existing `Promise.all`,
  never in an `await` above it. See the comment in `src/app/(app)/page.tsx`.
- **`getClaims()`, never `getUser()`** for identity in pages/actions — local JWT verification vs a
  ~300ms auth round-trip. ✅ Confirmed this project uses **ES256** (asymmetric) keys, so local
  verification genuinely applies. Only `src/proxy.ts` calls the refreshing path; don't move code
  between `createServerClient` and `getClaims()` there, or sessions randomly drop.
- **Every query goes through `rowsOrThrow`/`selectOrThrow`/`countOrThrow` WITH A LABEL**
  (`src/lib/data/query.ts`). A failed query must THROW, not render a calm empty state — that
  confusion once turned a missing migration into a silent company-wide outage that looked like
  "no data". Wrap a QUERY, never a WAVE.
  - **One deliberate exception**: `src/lib/data/session.ts` does NOT throw. A failed session read
    means *signed out*, so it redirects. Throwing would crash every route including the way out.
- **Adjust state DURING RENDER, never `useEffect(() => setX(prop), [prop])`.** The effect commits
  the stale value first and the UI visibly bounces after every save. `react-hooks/set-state-in-effect`
  is an **error** here. Pattern: `if (seen !== prop) { setSeen(prop); setX(prop) }` — see
  `src/components/dashboard/reminders.tsx`.
- **Side effects inside `after()`** (`next/server`) so the user never waits on them.
- **Never bake a signed URL into server-rendered HTML — sign AT CLICK** (60s TTL), via
  `SignedFileLink`. A render-time URL is stale by construction and reads as "the button does
  nothing". Pass a `path` to the client, never a `signedUrl`.
- **Realtime**: `await supabase.realtime.setAuth(token)` BEFORE `.subscribe()`, or RLS streams
  nothing while the channel still reports SUBSCRIBED.
- **`todayInIstanbul()` for every domain date.** `new Date().toISOString().slice(0,10)` is UTC and
  answers *yesterday* between 00:00–03:00 local. `todayLocal()` is narrow (viewer-only things like
  a download filename) — on the server it's the Vercel runtime (UTC) and reintroduces the bug.
- **Every control is custom and typed** — no native `select`, `date`, or `checkbox`.
- **Every "add new X" is a dedicated spacious surface** (`/…/new` page or `CreateOverlay`), never
  an inline expander. **No required fields**: empty submit asks once, then proceeds.
- **Modals are for destructive confirms ONLY** (`ConfirmDialog`). An authoring surface in a modal
  is a cramped page.
- **Panels do not nest.** A panel inside a panel is the nested-card smell.

### ⚠️ i18n + RTL — the rules that must not erode
- `src/lib/i18n/en.ts` is the source of truth; `fa.ts` is typed as `Dictionary`, so **a missing
  Farsi key is a COMPILE ERROR**. ✅ Proven both directions: deleting one key fails `tsc` naming
  that key; restoring it goes clean.
- ⚠️ `Dictionary` is `Widen<typeof en>`, **not `typeof en` with `as const`** — the latter makes
  every value a string *literal*, so Farsi would have to contain the English text to compile.
- **Logical CSS properties only.** `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`/`text-start`/`text-end`,
  `border-s`/`border-e`. **`pl-`/`mr-`/`left-`/`text-left` are BANNED and fail lint** (the
  `no-restricted-syntax` rule in `eslint.config.mjs`). ✅ Verified firing on a bad line and silent
  on the good one. A genuinely physical icon uses `rtl:rotate-180`.
- Locale lives on `profiles.locale` + a cookie (not the URL). The cookie is what lets the root
  layout set `<html lang dir>` **without a DB round-trip in front of first paint**.
- Money is **always Latin digits** even in Farsi (`formatMoney`) — figures get compared down a
  column and copied into invoices; mixing ۱۲۳ with 123 is unreadable. Prose dates/numbers DO use
  Persian digits.
- The **calendar stays Gregorian** in both locales (Persian digits + month names, Gregorian
  system): every date here comes from a Gregorian business record.

### Database
- **RLS is enabled on every table**, but with two trusted users the domain policy is simply
  `to authenticated using (true)`. RLS being *on* is what stops the anon key. ✅ Verified: anon
  reads return nothing.
- ⚠️ **`profiles` uses per-column GRANTs.** Table-wide UPDATE is revoked and re-granted for
  `full_name, avatar_url, locale, theme, color` only. **Adding a user-editable profile column needs
  BOTH the RLS policy (already covers it) AND a new GRANT** — the grant is the half that gets
  forgotten, and the symptom is a bare "permission denied for table profiles".
  ✅ Verified: `full_name`/`locale` update fine, `created_at` is refused with 42501.
- A trigger creates the profile row on `auth.users` insert, so **an account made by hand in the
  dashboard just works**. ✅ Verified end-to-end with a throwaway user (created, checked, deleted).
- ⚠️ Triggers only fire on NEW inserts. Accounts that existed *before* 0001 had no profile and hit
  an unbreakable login loop — that's what `0002_backfill_profiles.sql` fixes (idempotent).

## Current status (2026-07-21)

### 🟢 PHASE 1 — FOUNDATION: BUILT, VERIFIED AGAINST PROD, **not yet driven in a browser by Parsa**
`tsc` · `lint` · `build` all green. Migrations **0001 + 0002 applied via `db push` and
schema-verified**. Routes: `/login`, `/` (dashboard), `/settings`.

**What works, and how it was proven** (not just "it compiles"):
- ✅ **Schema**: every column of `profiles` and `reminders` queried by name against prod.
- ✅ **RLS**: anon key blocked on both tables.
- ✅ **Column grants**: `full_name`/`locale` writable as a real signed-in user; `created_at`
  refused (42501). This is the 0015-lesson guard actually holding.
- ✅ **Auth trigger + cascade**: a created user got a profile automatically; deleting the user
  removed the profile.
- ✅ **Sign-in + reminder round-trip** as a real user (insert → delete, cleaned up).
- ✅ **Proxy**: signed-out `/` returns 307 → `/login?next=%2F`; `/login` returns 200.
- ✅ **Farsi/RTL**: `Cookie: exxion-locale=fa` renders `lang="fa" dir="rtl"` with Persian text,
  server-side, no flash.
- ✅ **Tokens shipped**: both themes present in the served CSS (dark `#0e0b0e`, light `#fff`,
  `--danger-fill` `#b71f30`), plus the `prefers-color-scheme: light` block. Lightning CSS compiles
  the oklch to hex + `lab()` fallbacks — that's expected, not a problem.
- ✅ **Design detector** (`impeccable`) returns clean; no raw colours, no physical-direction
  classes, no arbitrary z-index.

**Two real bugs found and fixed during the audit pass** (recorded so they aren't reintroduced):
1. The mobile menu's exit used `[animation-direction:reverse]` on a `both`-filled animation, which
   does not reliably paint as an exit — the overlay would **snap** shut. Now a real `overlay-out`
   keyframe. ⚠️ Its duration (180ms) must stay in sync with `EXIT_MS` in `mobile-nav.tsx`.
2. The skip link used an arbitrary `z-50`; now `var(--z-sticky)` from the semantic scale.

**Accounts**: `parsaa.mansourii@gmail.com` (profile backfilled by 0002) and
`cgheydary@gmail.com` (created this session; **temp password was shown once in chat — change it**).

**NOT driven in a browser yet.** Worth Parsa's eyes: add/tick/delete a reminder and confirm nothing
bounces after the save; switch to Farsi in Settings and confirm the sidebar moves to the right;
toggle light/dark/system.

## File map (key files)
- `src/app/globals.css` — **ALL design tokens**. The one file a rebrand touches. Contrast numbers
  are recorded in comments; state colours are reserved.
- `src/lib/i18n/{en,fa,index,server,client}.ts` — dictionaries + `t()`. `en` is the shape; `fa`
  must match or `tsc` fails.
- `src/lib/data/query.ts` — `rowsOrThrow`/`selectOrThrow`/`countOrThrow`. **Every new query uses
  one, with a label.**
- `src/lib/data/session.ts` — cached session context. Deliberately does NOT throw (redirects).
- `src/proxy.ts` — Next 16 proxy (not `middleware.ts`). `getClaims()` refresh + redirect. Don't
  reorder its internals.
- `src/lib/use-action.ts` — optimistic → run → rollback + toast. The one way clients call actions.
- `src/lib/utils.ts` — `cn`, **`todayInIstanbul()`**, `formatMoney` (TRY, Latin digits),
  locale-aware `formatDate`/`formatRelative`.
- `src/lib/theme.ts` — `resolveThemeAttr` returns **undefined for "system"** on purpose: the server
  can't know the OS scheme, so it writes no attribute and CSS decides.
- `src/components/ui/*` — the kit: button · panel · badge · empty-state · skeleton · field · input ·
  number-input (+MoneyInput) · checkbox · dropdown (+MultiDropdown) · date-picker · color-picker ·
  toast · confirm-dialog · create (CreatePage/CreateForm/CreateOverlay) · signed-file-link.
  ⚠️ `field.tsx` does NOT generate ids — the caller passes one from `useId()`, because two
  instances of a form with hardcoded ids make every label focus the FIRST row's input.
- `src/app/(app)/error.tsx` — the boundary the throws land on. Shows `digest`, **not**
  `error.message` (Next redacts it in production, so it would print an empty string).
- `src/lib/nav.ts` — the six sections. Unbuilt ones render disabled with a "soon" chip rather than
  being hidden.
- `supabase/migrations/0001_foundation.sql` · `0002_backfill_profiles.sql`.
- `scripts/apply-migration.mjs` — Management-API applier (alternative to `db push`).

## Roadmap / next steps
**7 phases. Say "next phase" to start the next unbuilt one.**

1. ✅ **Foundation** — auth, shell, i18n+RTL, tokens, UI kit, data layer, dashboard, settings.
2. ⬅️ **NEXT — Finance** — `transactions` (the hub), categories, recurring items, charts.
3. **Creative hub** — ideas · collections → products · issues → learnings.
4. **Equipment** — machines, maintenance, supplies, reminders. First real finance link.
5. **Shipping** — order lifecycle board, staged + timestamped.
6. **Clients** — CRM + pattern analytics + events.
7. **Marketing** — campaigns, samples, filming schedule, networking.

Finance is second **on purpose**: every later section writes into its `transactions` contract, so
that contract must exist before anything can honour it.

**Also outstanding:**
- Disable public signups in the Supabase dashboard (**not verified**).
- Change `cgheydary@gmail.com`'s temp password.
- Deploy to Vercel and confirm `x-vercel-id` shows `arn1`.

## Decisions locked with Parsa (2026-07-21)
| Question | Decision |
|---|---|
| Cross-tab expenses | **One `transactions` table.** Equipment/shipping/marketing INSERT a real row carrying `source_type` + `source_id`, so every figure clicks back to its cause. |
| Currency | **Turkish lira (TRY) only.** No FX, no multi-currency. |
| Shipping | **Order lifecycle board**, each stage transition timestamped → cycle-time stats free. No carrier API. |
| Issues → Learnings | **One `issues` table.** Learnings is a second lens, not a second table. |
| Creative hierarchy | **Collection → Product.** A "project" is a collection's build effort. |
| Clients ↔ Orders | **Same spine** — orders link to a client, so pattern charts are real queries. `client_id` nullable for walk-ins. |
| Events | **One `events` table**, kind-tagged. Marketing schedule and Clients' events are two lenses. |

## Deliberately partial — grows later (scope ledger)
| Area | What shipped now | Intended full shape | Grows in |
|---|---|---|---|
| Sections 2–7 | Nav entries render **disabled with a "soon" chip** — visible so the shape of the app is legible, not hidden | Six full sections | Phases 2–7 |
| Branding | Neutral placeholder tokens, measured for contrast, all in one CSS block | Real Exxion identity — a variable swap, not a rewrite | When branding exists |
| Dashboard | "Needs you" strip (reminders only) + reminders panel; activity area is a dashed placeholder | Per-section signals in the SAME `Promise.all` wave; real activity feed | Phases 2–7 |
| Reminders | Personal, optional due date, optional `source_type`/`source_id` back-link | Equipment maintenance auto-creates them via the back-link | Phase 4 |
| Realtime | `useRealtimeRefresh` + `<LiveRefresh>` built and mounted on the dashboard | In-place patching where a full refresh feels heavy | Later |
| Search (⌘K) | None | Palette over content, loaded once + client-filtered | Later |
| Notifications | None | In-app only if asked; **Telegram/email explicitly out of scope** | If asked |
| Mobile | Full-screen menu, responsive shell; reasoned from code + build | **Not driven on a real phone yet** | Needs a live pass |
| Storage | None; `SignedFileLink` exists ready for it | Private buckets for product photos, equipment docs, order photos | Phase 3+ |

## Gotchas / open issues
- ⚠️ **The `system` theme writes NO `data-theme` attribute.** The server can't know the OS scheme,
  so CSS decides via `prefers-color-scheme` scoped to `:root:not([data-theme])`. An explicit choice
  has higher specificity and always wins. ⚠️ The light tokens are therefore **duplicated** in that
  media query — CSS has no mixins, and the alternatives cost more. **Change one, change both.**
- ⚠️ **`db push` is interactive**; pipe `"Y"` into it. It works without `SUPABASE_ACCESS_TOKEN`
  because the CLI is already logged in. Anything applied via `scripts/apply-migration.mjs` instead
  must be followed by `npx supabase migration repair --status applied <n> --linked`.
- ⚠️ **A 201/"Finished" is not proof a migration landed.** Verify against `information_schema` /
  `pg_indexes`, as Phase 1 did.
- ⚠️ The dev server sometimes leaves an orphan on Windows (`Another next dev server is already
  running`). Find the PID in the message and `taskkill /PID <pid> /F`, or the next run drives STALE
  code.
- `staleTimes` is experimental — if a Next upgrade breaks the build, drop it from `next.config.ts`.
  Nothing depends on it for correctness, only for feel.
- Secrets live only in `.env.local` (gitignored via `.env*`) and Vercel env. The service-role key
  and a temp password appeared in chat — **rotate anytime** in the dashboard.

## Running it
- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
- `echo "Y" | npx supabase db push` — apply new migrations
- `npm run migrate supabase/migrations/00XX_name.sql` — Management-API alternative
- `node .claude/skills/impeccable/scripts/detect.mjs --json src` — design lint (clean as of
  2026-07-21)
