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

### 🟢 PHASE 3 — CREATIVE HUB: BUILT + VERIFIED AGAINST PROD, **not yet driven in a browser by Parsa**
`tsc` · `lint` · `build` green (15 routes). **Migration 0004 applied and schema-verified.**
Sidebar entry is **live**. Seed data left in prod so there's something to look at.

**The section's whole purpose is Parsa's phrase "keeps us consistent"** — so the design question
that mattered was how issues reach Learnings.

**⚠️ LEARNINGS IS A LENS, NOT A TABLE.** One `issues` table; a collection's Issues tab and the
app-wide Learnings list are two views of the same rows, rendered by the SAME component
(`learnings-panel.tsx`, scoped by an optional `collectionId`). Nothing is copied, so nothing can
drift and an issue can never be missing from Learnings. ✅ Proven: 2 issues app-wide, 1 in the
collection tab — the general workshop issue belongs in Learnings but names no collection.

**⚠️ `issues.collection_id` / `product_id` are `on delete SET NULL`, never cascade.** Deleting a
collection must not delete the lessons learned making it — that knowledge outlives the project.
✅ Proven against prod: collection deleted → **issue survived with its resolution intact**, while
its products correctly cascaded away (a product has no meaning without its collection).

**⚠️ `resolution` IS the solved state.** No separate boolean: a flag and a written fix would drift,
and "solved" with no explanation teaches nobody. Clearing the text reopens the issue, and the UI
says so.

**⚠️ COST IS COMPUTED AT READ TIME, NEVER STORED** (`lib/costing.ts`):
`round(grams/1000 × material rate) + round(hours × machine rate)`, integer kuruş, rounded per term.
A stored cost goes stale the moment a filament price changes, leaving numbers that are quietly
wrong. ✅ Proven: re-pricing PLA ₺800→₺1200/kg moved the keychain ₺38.75→₺48.75 **with the product
row unchanged** — there is no cost column to go stale.
⚠️ **Unknown cost returns `null`, never 0** — rendering ₺0,00 would claim the thing is *free*,
which is a different and worse statement than "not costed".
⚠️ **No transaction is written when a product is costed.** You logged the expense when you bought
the filament; writing one per print would double-count it.
⚠️ `grams`/`print_hours` are Postgres `numeric`, which arrives over PostgREST as a **string** —
`costing.ts` parses it. ✅ Tested that strings and numbers cost identically.

**Verified against prod:**
- ✅ Schema column-by-column; `app_settings` singleton enforced (a second row is refused, 23514).
- ✅ Costing: **12 unit cases** incl. string inputs, null-not-zero, per-term rounding, re-pricing.
- ✅ Live page render: keychain shows cost **₺38,75** vs price **₺90,00**, margin **₺51,25**, and the
  breakdown **₺20,00 + ₺18,75** — matching the unit tests exactly.
- ✅ Promote: idea → collection, `status=made`, "Became a collection" link renders and points back.
- ✅ Farsi: `dir=rtl lang=fa`, translated; light/dark tokens unchanged.
- ✅ No physical-direction classes, no raw hex.
- ⚠️ **One KNOWN-FALSE detector warning**: `detect.mjs` flags a "broken image" in
  `image-strip.tsx`. It is a regex that can't follow a JSX conditional — the `<img>` only renders
  when a signed URL exists, and a skeleton shows otherwise. Verified by reading; do not "fix" it.

**Sidebar fix (same session, Parsa reported):** the rail scrolled away on long pages. It had no
height, so `items-stretch` on the flex row grew it to the full PAGE height and the account/sign-out
footer ended up thousands of pixels down. Now `sticky top-0 h-dvh` on the `<aside>` +
**`md:items-start` on the layout row** (without which sticky can't work) + `self-stretch` on
`<main>`. Only the nav list scrolls.

**Not driven in a browser yet.** Worth Parsa's eyes: change the machine rate in Settings and watch
every product re-cost; answer "how did we fix it" on an open issue and see it flip to solved;
upload a product photo (the one path not exercised with a real file).

### 🟢 PHASE 2 — FINANCE: BUILT + VERIFIED AGAINST PROD, **not yet driven in a browser by Parsa**
`tsc` · `lint` · `build` green. **Migration 0003 applied and schema-verified.** Routes: `/finance`
(three tabs), `/finance/new`, `/finance/[id]`. Sidebar entry is **live**.

**Finance is the hub — `transactions` is a CONTRACT.** Equipment (4), Shipping (5), Clients (6) and
Marketing (7) all insert into it with `source_type` + `source_id`, so every figure traces back to
its cause. Don't reshape that table casually; later phases depend on it.

**Architecture, and why:**
- **ONE page, THREE tabs** (Transactions · Recurring · Categories) via
  `components/shell/tabbed-panels.tsx`. Every tab's data arrives in the page's **single
  `Promise.all`**, and switching is **pure client state** — no navigation, no refetch. Separate
  routes would have traded ~3ms for ~305ms on every switch.
- **Filtering is 100% client-side** (`useMemo` over rows already in memory). The URL mirrors filters
  via `replaceState`, **never `router.push`** — a push is a server round-trip plus one history entry
  per keystroke.
- **Optimistic + rollback** on every mutation that has an id (rename/archive category, pause/delete
  recurring). Create is deliberately not optimistic — there's no server id to render yet.
- Recurring materialisation runs in **`after()`**, so bookkeeping never blocks the response.

**⚠️ MONEY IS INTEGER KURUŞ** (`amount_minor bigint`). 1250.50 TRY = `125050`. Converted **exactly
once**, in the server action (`toMinor`). `amount_minor` is a **positive magnitude**; `direction`
carries the sign — a signed amount *plus* a direction is two sources of truth and they drift.
Display with **`formatMinor()`**, never `formatMoney()` (which takes lira and would render
₺125.050,00 for ₺1.250,50 — plausible and wrong).

**⚠️ THE +/− SIGNS ARE AN ACCESSIBILITY REQUIREMENT, NOT DECORATION.** Measured with the dataviz
validator against this project's real surfaces: **green↔red scores ΔE 6.5 under protanopia** (the
6–8 "floor band"), where blue↔red scores 19.2. Green/red is kept because it's the money convention,
but the floor band is legal **only with secondary encoding** — the sign and the text label ARE that
encoding. Do not strip them to tidy a layout. See `lib/chart-palette.ts`.

**⚠️ Charts stay LTR in Farsi** (`dir="ltr"` on the plot). recharts doesn't mirror, and it
shouldn't: a time axis running right-to-left reads as reversed chronology.

**Verified against prod, not just built:**
- ✅ Schema column-by-column; negative amount **refused (23514)**; `receipts` bucket private.
- ✅ **Idempotency, the one that matters most**: the unique index
  `(recurring_id, occurred_on) where recurring_id is not null` **refuses a duplicate (23505)** while
  still allowing two identical *hand-entered* rows. Rent cannot double-charge.
- ✅ **Catch-up**: a template 3 months behind generated exactly 3 rows dated **2026-05-01,
  06-01, 07-01** — the months they belong to, not all today. Re-running changed nothing.
- ✅ **Date logic, 9 cases** incl. day-31 clamping to **Feb 28 (2026) and Feb 29 (2028)**, and
  quarterly anchoring on the *start* month (Feb/May/Aug/Nov, not Jan/Apr/Jul).
- ✅ **Money precision**: `1250.50` → `125050` → renders `₺1.250,50`; `0.10+0.20+0.07` = exactly
  `0.37` where float gives `0.37000000000000005`.
- ✅ **The cross-section contract**: an `equipment`-sourced transaction inserts, is retrievable by
  source, and its badge renders in the list.
- ✅ **Deep-link filters for real** — the dashboard link was parsed through the page's own reader
  (`from`/`to` populated). It imports `FINANCE_PARAMS` rather than hardcoding, so a rename is a
  compile error. A made-up param yields an unfiltered view; that's the bug this prevents.
- ✅ **Farsi**: `dir=rtl lang=fa`, translated, money still Latin digits, chart plot still LTR.
- ✅ Design detector clean; no physical-direction classes, no raw colours.

**Not driven in a browser yet.** Worth Parsa's eyes: add a transaction and watch the charts move;
switch tabs and confirm it's instant; create a recurring item dated in the past and confirm the
back-months appear.

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
  being hidden. ⚠️ **Flip `ready: true` in the SAME commit that ships the section** — a built
  section left `false` is invisible work; a `true` one that isn't built is a dead link.
- `src/components/shell/tabbed-panels.tsx` — **the instant-tab shell.** Server-rendered content per
  tab, switched in pure client state, `?tab=` via `replaceState`. Use this for every tabbed section.

**Finance (phase 2):**
- `src/lib/money.ts` — `toMinor`/`toMajor`/`signedMinor`/`netMinor`. **The only conversion points.**
- `src/lib/chart-palette.ts` — validated colours + the ΔE measurements behind them. **Re-run the
  dataviz validator for both modes if you change a value.**
- `src/lib/finance-series.ts` — pure aggregation (monthly series, category breakdown, totals). No
  React, no Supabase, so the arithmetic is directly testable — which for money it must be.
- `src/lib/use-finance-filters.ts` — **`FINANCE_PARAMS` is the deep-link contract.** Import it; a
  hardcoded param string is how you ship a link that silently filters nothing.
- `src/lib/data/recurring.ts` — the materialiser. Idempotent, catches up, never generates the future.
- `src/lib/finance-export.ts` — CSV. Escapes leading `=+-@` (Excel would treat them as formulas)
  and writes a BOM so Turkish/Persian characters survive.
- `src/components/finance/*` — panels (ledger/recurring/categories), charts, forms, receipt field.

**Creative (phase 3):**
- `src/lib/costing.ts` — `productCost` / `productMargin`. **Computed at read time, never stored.**
  Returns `null` (not 0) when uncosted. Parses `numeric`-as-string.
- `src/components/creative/learnings-panel.tsx` — **ONE component, two lenses.** Pass
  `collectionId` for a collection's Issues tab; omit it for app-wide Learnings. Do not fork this
  into a second implementation — they would drift, which is the failure this section exists to
  prevent.
- `src/components/creative/image-strip.tsx` — product/issue photos. Thumbnails signed WITH a
  `transform` (a transform appended to an already-signed URL silently returns the full-size image).
- `src/components/settings/costing-form.tsx` — machine rate + materials. Editing either re-costs
  every product, which is why its actions revalidate `/creative` too.
- `supabase/migrations/0001_foundation.sql` · `0002_backfill_profiles.sql` · `0003_finance.sql` ·
  `0004_creative.sql`.
- `scripts/apply-migration.mjs` — Management-API applier (alternative to `db push`).

## Roadmap / next steps
**7 phases. Say "next phase" to start the next unbuilt one.**

1. ✅ **Foundation** — auth, shell, i18n+RTL, tokens, UI kit, data layer, dashboard, settings.
2. ✅ **Finance** — transactions (the hub), categories, recurring, charts, CSV, receipts.
3. ✅ **Creative hub** — ideas · collections → products · issues → learnings · costing.
4. ⬅️ **NEXT — Equipment** — machines, maintenance, supplies, reminders. **The first real writer
   into `transactions`**: a repair logs an expense with `source_type='equipment'`, which is the
   contract Phase 2 was built to honour.
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
| Sections 4–7 | Nav entries render **disabled with a "soon" chip** — visible so the shape of the app is legible, not hidden | Four remaining sections | Phases 4–7 |
| Materials | Name, kind, cost per kg, archive | **Stock levels deliberately excluded** — tracking grams remaining turns this into an inventory system, and Equipment (Phase 4) owns supplies. Decide it there | Phase 4 |
| Product photos | Upload/remove on the product EDIT form only (a new product has no id to attach to yet) | Staged upload on create, reordering, a lightbox | Later |
| Per-collection P&L | Computed cost + price per product | Real revenue meeting computed cost, once orders exist | Phase 5 |
| Finance charts | 12-month in/out bars · category breakdown · net line | Budgets, per-collection P&L, forecasting — deliberately deferred until there's real data to budget against | Later |
| Receipts | One file per transaction (5 MB, image/PDF), private bucket, signed at click | Multiple attachments; OCR of totals | Later |
| Transaction window | The page loads ~13 months (cap 2000 rows) so filtering is instant client-side | Pagination or a server-side query once that cap is realistic — at ~50 rows/month it's ~3 years away | When the cap bites |
| Branding | Neutral placeholder tokens, measured for contrast, all in one CSS block | Real Exxion identity — a variable swap, not a rewrite | When branding exists |
| Dashboard | "Needs you" strip (reminders only) + reminders panel; activity area is a dashed placeholder | Per-section signals in the SAME `Promise.all` wave; real activity feed | Phases 2–7 |
| Reminders | Personal, optional due date, optional `source_type`/`source_id` back-link | Equipment maintenance auto-creates them via the back-link | Phase 4 |
| Realtime | `useRealtimeRefresh` + `<LiveRefresh>` built and mounted on the dashboard | In-place patching where a full refresh feels heavy | Later |
| Search (⌘K) | None | Palette over content, loaded once + client-filtered | Later |
| Notifications | None | In-app only if asked; **Telegram/email explicitly out of scope** | If asked |
| Mobile | Full-screen menu, responsive shell; reasoned from code + build | **Not driven on a real phone yet** | Needs a live pass |
| Storage | None; `SignedFileLink` exists ready for it | Private buckets for product photos, equipment docs, order photos | Phase 3+ |

## Gotchas / open issues
- ⚠️ **Never call `formatMoney()` on an `amount_minor`.** It takes LIRA. `formatMoney(125050)`
  renders ₺125.050,00 for what is actually ₺1.250,50 — plausible enough to ship unnoticed. Use
  **`formatMinor()`** for anything out of the database.
- ⚠️ **Don't "simplify" the recurring generator's unique-index reliance.** The index is what makes
  it safe, not the JS checks — those would lose a race between two tabs. A 23505 from the insert is
  the guarantee working and is deliberately swallowed.
- ⚠️ **Categories AND materials archive, never delete.** Deleting either nulls a foreign key on
  every historical row and silently changes what past months were spent on / what a product costs.
- ⚠️ **Never store a computed product cost.** It is derived from the material's current price and
  the machine rate on purpose; a cached copy is wrong the moment either changes.
- ⚠️ **`detect.mjs` reports one KNOWN-FALSE "broken image"** in `image-strip.tsx` — its regex
  can't follow the JSX conditional that guards the `src`. Verified correct; don't refactor to
  silence it.
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
