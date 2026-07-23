# ExxionOs — Handoff

> Read this first when starting a fresh chat.
> Companion: the plan at `C:\Users\p.mansouri\.claude\plans\ok-were-building-an-zesty-parrot.md`
> (that path is Parsa's WORK laptop — on any other machine this file is the whole context).

## 👋 START HERE — resuming in a brand-new chat

### 🟢 LATEST — 2026-07-23 (second session), Links everywhere + notes visible + polish round

**NOT committed yet** — working tree has this session's changes on top of the previous session's
uncommitted work. `tsc` · `lint` · `build` (32 routes) · `npm run contrast` all green.

**⚠️ NEW MIGRATION `0023_links.sql` — WRITTEN, NOT APPLIED** (joins the 0018–0021 queue; Parsa
must `npx supabase db push`). Adds `links text[] not null default '{}'` to **machines, supplies,
products, orders, clients, campaigns, collections**. Until applied, SAVING any of those forms
errors (the insert/update sends `links`) — loud, by design.

**A. Links feature (Parsa: "add a link section… opens in a new tab… multiple links… everywhere").**
- `normaliseLinks()`/`linkLabel()` in **`src/lib/links.ts`** (not in an action file — "use server"
  modules only export async fns): trim, cap 500 chars/20 links, prepend `https://` when no scheme,
  dedupe.
- **`ui/links-editor.tsx`** (fieldset of URL rows, add/remove, styled to match Field) in all seven
  forms; **`ui/links-list.tsx`** (new-tab anchors, `rel="noopener noreferrer"`, hostname+path label,
  `dir="ltr"` — URLs stay Latin in Farsi, `text-brand-text` never `text-brand`) in every detail view.
- Wired through every input type + row builder in actions/{equipment,creative,shipping,clients,
  marketing}. All tables `select("*")`, so no query edits.

**B. Notes now VISIBLE without opening edit** (the complaint that started the session):
machine-detail gained notes+links panels (it showed NEITHER before). Machine/supply/product forms'
notes label fixed from the wrong `creative.ideaBody` to new `common.notes`.

**C. Supplies got a real DETAIL PAGE** — `/equipment/supplies/[id]` is now read-only
(`equipment/supply-detail.tsx`: stock + low badge, threshold, cost/kg or last price, notes, links,
restock history from `supply_restocks`, restock button reusing `RestockForm`); the edit form moved
to **`/equipment/supplies/[id]/edit`**. Supply names in the list link to it; ⌘K search already
pointed at the detail URL. SupplyForm redirects back to the detail on save-of-existing.

**D. Polish backlog cleared (from the audit list below):**
- **ConfirmDialog async migration FINISHED** — all ~13 remaining callers converted (return the
  `run()` promise) or, where the delete is optimistic (ideas/learnings/machine-detail/categories/
  recurring), the dead `loading={pending}` was dropped and instant-close kept deliberately.
  image-strip needed nothing (no loading prop existed).
- **Filtered-empty dead ends** now offer "Clear filters": clients directory, maintenance panel,
  finance transaction-list (new `onClearFilters` prop wired to the ledger's `reset`).
- **Farsi error toasts**: every `run()` missing `errorMessage` got the section's `saveFailed`;
  `use-action.ts`'s hardcoded English fallback is now `t("common.somethingWentWrong")`.

**E. Contact QoL:** client email/phone/instagram are now `mailto:`/`tel:`/instagram.com links with
copy buttons (new **`ui/copy-button.tsx`**, clipboard + check-flash); order codes copyable in
order-detail. New i18n keys (en+fa): `common.{links,addLink,notes,copy,copied}`,
`equipment.{restockHistory,noRestocks,noRestocksHint,lastPrice}`.

**Not driven in a browser** — worth Parsa opening a machine (notes finally visible), a supply row
(new detail page), and adding `example.com` as a link (should save as https://example.com and open
in a new tab).

### 🟢 EARLIER — 2026-07-23, Focus-steal typing bug (system-wide) + measured filament per print

**NOT committed yet** — working tree has the changes below. `tsc` · `lint` · `build` all green
(4 pre-existing lint warnings, all in `scripts/seed-data.mjs`, untouched).

**⚠️⚠️ FOUR MIGRATIONS WRITTEN, NOT YET APPLIED — Parsa must `npx supabase db push`:**
- **`0018_order_code_sequence.sql`** — a Postgres sequence + `next_order_code()` RPC for auto
  `EX-###` order codes. Until applied, the new-order page's code auto-fill RPC returns null (the
  field just stays blank — non-fatal).
- **`0019_order_campaign.sql`** — `orders.campaign_id` (nullable, SET NULL) for campaign ROI.
  Until applied, the marketing page's `taggedOrders`/ROI query throws (loud, by design).
- **`0020_product_files.sql`** — `product_files` table (design files) reusing the `creative`
  bucket. Until applied, the Creative products tab throws.
- **`0021_product_measured_grams.sql`** (NEW this session) — `products.measured_grams numeric`
  (`> 0` or null). The weighed truth, supports included. Until applied, saving a measured weight or
  logging a first-print weigh **errors** (loud, by design). ⚠️ **Could NOT be applied by the
  assistant** — `npm run migrate` needs `SUPABASE_ACCESS_TOKEN` in `.env.local`, which is blank;
  `npx supabase db push` (CLI already authed) is the path.

**⚠️ THE TYPING BUG — root cause + system-wide fix (this session's first work):**
Parsa: *"whenever you go to type in the fields, it stops you after one single char — it un-focuses
the field"* (screenshot: the print-run Notes field showing just `d`). Root cause: **`CreateOverlay`
(`ui/create.tsx`) and `ConfirmDialog` (`ui/confirm-dialog.tsx`) listed the caller's `onClose`/
`onCancel` in a focus `useEffect`'s deps.** Callers pass those inline (`onClose={() => setOpen(false)}`),
so they're a NEW function every render → every keystroke re-ran the effect → `panelRef.focus()` stole
focus after one char. It hit **only overlay/dialog surfaces** (print run, idea edit, every confirm)
— `/…/new` PAGE forms have no such effect, which is why it was "about half the pages". **Fix: hold
the callback in a ref (synced in its own effect — writing a ref during render is banned by
`react-hooks/refs` here) and key the focus effect on `[open]` alone.** Covers every overlay + dialog
at once.

**⚠️ MEASURED FILAMENT PER PRINT (Parsa: "add filament usage incl. supports per print… weigh it the
first time, use it everywhere for supplies + price"). Decision: MEASURED OVERRIDES ESTIMATE.**
- New `products.measured_grams` (0021) = weighed grams per unit, **supports included** — the truth.
- The print-run overlay (`creative/print-run-button.tsx`) asks you to **weigh one unit ONLY on the
  first print** (while `measured_grams` is null). That number is **written back to the product inside
  `recordPrintRun`** and, from then on, is the single source for BOTH stock deduction AND costing.
- **`lib/costing.ts` gained `effectiveGrams(product)`** = `measured_grams ?? grams`. `productCost`
  now takes `measured_grams` and prefers it; `recordPrintRun` deducts against it too. One rule, one
  place — costing, deduction and every preview agree.
- Editable later on the product form (new "Measured grams" field). Product cards show the measured
  weight marked with a ● dot once known, else the estimate.
- ⚠️ `products.select("*")` everywhere means `measured_grams` flows through with no query edits.

**The 11-feature wave (commit `83f6912`, then fixes):**
1. **⌘K global search** (`components/shell/global-search.tsx` + `actions/search.ts`) — palette over
   clients/orders/products/collections/supplies/campaigns; fans out ONE action only while typing
   (nothing in any page wave). ⚠️ **PORTALLED to `document.body`** (`399eaf1`/first fix) — mounted
   in the sidebar which is `sticky h-dvh w-56`, a clipping ancestor; a `fixed` overlay inside it was
   constrained to the 56-wide box (rendered as a floating backdrop-less field). Every overlay in the
   app portals for this reason.
2. **Auto order codes** — needs 0018. `nextOrderCode()` in `actions/shipping.ts`.
3. **Low-stock reorder list** — a new Equipment tab (`components/equipment/reorder-panel.tsx`);
   `suggestedReorder()` in `lib/equipment.ts` (to 2× threshold).
4. **Dashboard money pulse** (`components/dashboard/money-pulse.tsx`) — open-order value +
   outstanding, from orders already in the wave. ⚠️ Neither is revenue and it says so.
5. **Per-client P&L** — `clientPnl()` in `lib/clients.ts`; a panel on `client-detail.tsx`.
6. **Per-product margin %** — `productMarginPct()` in `lib/costing.ts` (margin was already shown).
7. **Photo lightbox** (`components/creative/lightbox.tsx`) — click a thumb, full image signed at
   open. (Staged-upload-on-create deliberately NOT built — storage-contract risk.)
8. **CSV export** for clients/orders/supplies — `lib/csv.ts` (generic) + `lib/entity-export.ts`;
   `finance-export.ts` refactored onto them.
9. **Marketing schedule calendar** — a List/Calendar toggle in `components/marketing/schedule.tsx`
   (month grid over the SAME events lens, Gregorian).
10. **Campaign ROI** — needs 0019. `campaignRoi()` in `lib/marketing.ts`: revenue from
    `transactions` (NEVER order totals), spend Finance-sourced, **untagged-order count shown**.
11. **Transaction pagination** — client-side "show more" in `transaction-list.tsx` (render cap
    only; the whole ~13mo window stays in memory so filtering is still instant).

**Two ad-hoc features Parsa asked for mid-session:**
- **Product design files** (`1320ac7`, needs **0020**) — a "Files" button beside Print-run on each
  product uploads/keeps `.mb`/`.ma`/`.stl`. `components/creative/product-files-button.tsx` +
  `attachProductFile`/`detachProductFile` in `actions/creative.ts`. Browser→bucket upload (a 100MB
  scene never round-trips the server); downloads via `SignedFileLink`. 200MB cap, type-checked.
- **Idea editing** (`b06d032`, NO migration) — a pencil on each idea row opens `IdeaForm` (now
  edit-capable) in an overlay; new `updateIdea` action. Status stays on its own one-click control.

**⚠️ SYSTEM-WIDE UI FIX — the row-hover pattern (this session's last work):**
Parsa: *"when you hover a rounded element, the hovered bg isn't rounded… only half lights up."* The
bug was **full-bleed edge-to-edge hover bars** on row lists — a `<li border-b hover:bg-raised>` whose
hover painted a hard-cornered slab ignoring the panel's radius and padding. **First attempt (adding
`overflow-hidden`) was WRONG** — it only stopped the corner poking out, the slab was still ugly.
**The real fix: inset rounded pills.** New `.list-inset` (0.375rem pad) + `.row-hover` (rounded-lg,
`hover:bg var(--raised)`, token-only) utilities in `globals.css`. Applied to the four offenders:
**dashboard activity feed, shipping order-list, clients directory, finance transaction-list.** Every
other surface was already clean (card grids self-round; icon-button hovers are `rounded`; nav links
are `rounded-lg`). ✅ `/impeccable` review passed: consistent idiom, hover only on interactive rows,
no raw colours / physical-direction classes. **The activity feed was ALSO de-noised earlier this
session** — one line per order (its CURRENT stage, "now Printing"), not one row per stage transition.

**⚠️ NOT DRIVEN IN A BROWSER by the assistant** (no valid session cookie in the harness). Parsa is
using the live Vercel deploy and reporting UI issues from there — trust his screenshots over "it
compiles". The ranked-feature plan lives at
`C:\Users\p.mansouri\.claude\plans\go-through-the-entire-jiggly-raven.md`.

### 🟢 EARLIER — 2026-07-22, Auto-reminders (birthdays + machine service)

`bc1e10e` (+ migration **0017** APPLIED). Reminders now auto-create from two standing signals:
client **birthdays** and machine **`next_service_on`** (a new column on the machine form).
`materialiseAutoReminders()` in `lib/data/auto-reminders.ts` mirrors `materialiseRecurring` exactly:
runs in `after()` on dashboard load, idempotent via a **unique index**
`reminders (owner_id, source_type, source_id, due_on)`, catches up, never generates the future
(birthdays only within 14 days). Generated rows show an "Auto" badge. ✅ Idempotency proven against
prod (insert → 201, retries → 409, one row survives).

### 🟢 EARLIER — 2026-07-22, Supplies: Category (Finance) + Item; board lanes; restock pricing

Three reshaping changes this session (migrations 0015 AND 0016 both applied by Parsa):

**A. Supplies now have Category + Item (migration 0016, replaces 0015's `type`):**
- **`supplies.category`** = a real **Finance expense category** name (searchable/creatable; Filament,
  Packaging, Equipment…). ⚠️ **A restock books its expense under THIS category** (was hardcoded
  "Equipment"). Typing a new category creates a real Finance expense category (`categoryIdByName`).
- **`supplies.item`** = the specific thing (Cardboard, PLA Black…), backed by a new `supply_item`
  vocabulary (ComboCreate). Replaces `supplies.type`.
- **Printing behaviour is INFERRED from category**, no toggle: `isPrintingCategory()` in
  `lib/equipment.ts` returns true for category `"Filament"`/`"Resin"` → grams + cost-per-kg, unit
  locked to `g`, deducted per print. ⚠️ Matched by NAME — renaming those Finance categories stops
  filament being costed (documented in 0016).
- List **groups by category**. Sample supplies backfilled to the new shape.

**B. Shipping board grouped into 4 lanes** (`ffb8c39`): the 8 stages overflowed the viewport and a
card's stage dropdown got clipped by the `overflow-x-auto` container. `BOARD_LANES` in `lib/shipping.ts`
groups them into New / In production / Fulfilment / Delivered (Cancelled opt-in) that FIT the screen.
The 8 stages, their timestamped history and cycle-time stats are unchanged; the card dropdown still
sets any exact stage; dropping onto a lane moves to that lane's `entry` stage.

**C. Restock per-unit OR per-batch price** (`ffb8c39`): the restock dialog has a Total/Per-unit
segment; per-unit is × quantity, and the batch total is shown before confirming.

**Verified:** `tsc` · `lint` · `build` · `contrast` green; `/impeccable` on the reworked form + board.
Migrations 0015 + 0016 applied. **Not driven in a browser yet** — worth Parsa opening `/equipment`
(supplies grouped by category) and `/shipping` (4 lanes, dropdown no longer clipped).

⚠️ **`0012` and `0013` may still be unapplied** — Parsa confirmed 0014/0015/0016 are pushed; verify
0012 (product_stock) and 0013 (drop profile color) before relying on the Stock tab.

### 🟣 EARLIER — 2026-07-22, RESHAPING: Supplies tab reworked (filament vs packaging)

Second reshaping change, straight after the materials→supplies merge below. Parsa: *"supplies will
mainly be filament, and packaging things like cardboard, stickers etc… for selecting the type,
nothing is better than the dropdown you can search or create."*

**What changed (all decided with Parsa):**
- **Supply `type` is now a searchable/creatable category** (ComboCreate), backed by a NEW
  `supply_type` vocabulary kind — the same picker the product form uses. Replaces the old fixed
  `kind` enum (filament/resin/other). Seed types: Filament, Cardboard, Stickers, Tape, Boxes.
- **A per-supply "This is a printing material" checkbox** drives the form: ON → shows cost-per-kg +
  nudges unit to kg (filament/resin, deducted by grams); OFF → hides cost, counts pieces (packaging).
  ⚠️ **The signal is `cost_per_kg_minor != null`** — no new boolean column; the toggle just
  shows/clears the cost, and costing already treats null price as uncosted. The checkbox + its cost
  field are grouped in a bordered block.
- **The Supplies list is grouped by type** (heading per group; uncategorised sinks last; low-stock
  leads within each group; `overflow-hidden rounded-xl` per group so row hover clips).
- **Vocabulary plumbing** gained a `supply_type` branch in `refresh`/`renameVocabulary`/
  `countVocabularyUsage` (renaming a type propagates to `supplies.type`, label-not-FK like
  product types). `MaterialKind`/`MATERIAL_KINDS` deleted (nothing used them after the merge).

- **Migration `0015_supply_type.sql`** (⚠️ **WRITTEN, NOT APPLIED**): adds `supplies.type`, drops
  `supplies.kind`, widens the `vocabularies.kind` CHECK to allow `supply_type`, seeds the starter
  types. Additive except the kind→type swap; safe on the wiped DB.

**Verified:** `tsc` · `lint` · `build` · `npm run contrast` all green. `/impeccable` polish pass
(grouped the toggle+cost field). NOT driven in a browser; **0015 unapplied**, so the Supplies tab
throws until Parsa pushes.

⚠️ **NEXT SESSION, FIRST THING:** Parsa must `npx supabase db push` to apply **0012, 0013, 0014,
AND 0015** (all still pending). The Equipment → Supplies tab throws loudly until 0015 lands (missing
`type` column) — by design, not a bug.

### 🔵 EARLIER — 2026-07-22, "materials" folded into "supplies"

The first real reshaping change (Parsa: *"wtf is material doing in the settings tab? filament
should be added in the supplies tab"*). **All business data was WIPED first** (`npm run wipe` +
`db push`), so this is a clean forward-only schema change — no data migration.

**The decision (Parsa chose "one entry in Supplies, with a cost field"):** filament/resin were
entered TWICE — once in Settings → Costing to give them a per-kg price, once in Equipment →
Supplies to track grams. Now a **supply carries its own `cost_per_kg_minor` + `kind`**, and costing
reads the price straight off it. Filament is added **once**, in the Supplies tab. Settings → Costing
is now **machine-hour-rate only**.

**What changed:**
- **Migration `0014_supply_costing.sql`** (⚠️ **WRITTEN, NOT YET APPLIED** — only Parsa can push;
  see roadmap): `supplies` gains `cost_per_kg_minor` (nullable — a box has no per-kg price) + `kind`
  (filament/resin/other CHECK). `products` gains `supply_id` (SET NULL). **Drops `products.material_id`
  and the whole `materials` table.** This **reverses 0007's "two tables stay two tables"** on
  purpose.
- **`costing.ts`** now reads `supply.cost_per_kg_minor` via `product.supply_id`. Null price = no
  material cost (still null-not-zero). Print-run resolution **simplified** — reads `product.supply_id`
  directly, no more material→supply hop.
- **`supply-form.tsx`** gained a Kind dropdown + optional Cost/kg field. **`createSupply`/
  `updateSupply`** take `kind`/`costPerKg`; `updateSupply` now revalidates `/creative` (re-pricing a
  supply re-costs every product printed from it).
- **`costing-form.tsx`** stripped to the machine rate + a pointer note ("costs live on each supply
  now"). **`createMaterial`/`updateMaterial`/`archiveMaterial` deleted.**
- Product form + products-panel + collection-detail/pnl + all four consumer pages + the whole
  Marketing sample-costing chain repointed `materials`→`supplies`. **`wipe-data.mjs`**: `materials`
  removed from SETUP; `supplies` is business data (already in CONTENT).

**Verified:** `tsc` · `lint` · `build` (28 routes) · `npm run contrast` all green. `/impeccable`
polish pass on the two changed surfaces: on-system, one import-order drift fixed, no a11y/i18n
issues. **NOT driven in a browser, and 0014 is not applied**, so the Stock/costing path is unproven
against prod until Parsa pushes the migration.

⚠️ **NEXT SESSION, FIRST THING:** Parsa must `npx supabase db push` to apply **0012, 0013, AND
0014** (all three are written-but-unapplied). Until 0014 lands, the Supplies cost field, product
costing, and print-run deduction all point at columns that don't exist yet — `rowsOrThrow` will
throw loudly (by design), not render empty.

### 🔵 EARLIER — 2026-07-22, big UI/UX sweep (5 commits, all pushed to main)

An overnight "find every UI issue and fix it" pass. Six audit agents swept the whole surface
against the project's own rules; findings were verified in code, then fixed in five themed
commits. **`tsc` · `lint` · `build` · `npm run contrast` · design-detector all green after each.**
No schema/migration changes — this was purely the app layer.

**What shipped (newest first — `git log` for the full messages):**
1. `78c8d28` — **ConfirmDialog async contract**: an `onConfirm` that returns a promise keeps the
   dialog open with a spinning confirm button until it settles, then closes. Fixes ~a dozen
   delete dialogs that passed `loading={pending}` but closed synchronously, so the spinner was
   dead code. Escape/backdrop blocked while in flight. **Only order-detail's two deletes +
   client archive/unarchive/event-delete are converted so far — the other ~13 `ConfirmDialog`
   callers still use the old fire-and-close and can migrate incrementally (see the list under
   "NOT YET DONE").** Also: `interpolate()` now renders interpolated COUNTS in Persian digits in
   Farsi (money is untouched — it's already a Latin string before `t()`); Dropdown/ComboCreate
   got `aria-activedescendant`, Home/End, Tab-to-close, scroll-into-view; DatePicker's clear
   button is no longer a nested-in-`<button>` (was invalid HTML).
2. `88b3b94` — **recharts deferred** on Shipping via `next/dynamic` (only the heaviest dep, only
   the hidden Insights tab); **realtime refresh skips a hidden tab** and flushes once on return.
3. `82cb587` — **decimal money is typeable again**: `NumberInput` kept rendering the parsed
   number, so `1.05`/`12.50` were literally impossible to type. Now holds a draft string while
   focused. Payment/balance forms: removed blocking validators, real `<form>` (Enter submits),
   overpayment warning, `useId`. Login lost native `required`. Severity badge no longer collides
   with the `success` state colour. Photo delete now confirms; product thumbs have real alt text.
4. `626bda1` — **instant client-side language switch** (no server round-trip / `router.refresh()`;
   both dictionaries already ship to the client). Provider holds locale in state; the 22
   server-rendered strings that would have gone stale now pass a KEY to a client component
   (`CreatePage`/`PageHeader` gained `titleKey`/`descriptionKey`; new `DashboardGreeting`). Plus a
   **synchronous double-submit ref guard in `useAction`** covering all ~30 call sites.
5. `e26cfdf` — **badge contrast bug**: the `*-soft` tints lived only in `:root`, so light theme
   put dark-theme tints under deep light-theme text — four of five badge tones under AA in
   daylight. Each family now has a third `--*-badge` ink, re-tuned per theme; `check-contrast.mjs`
   gained alpha-compositing so it can SEE `-soft` pairs (it couldn't before, which is why this
   shipped). Also: `app/(app)/not-found.tsx` + `loading.tsx` (10 `notFound()` calls had no styled
   page; dictionary keys already existed), chart theme-switch bug, NetChart drew losses in the
   income green, `viewport`/`themeColor`, focus ring legible on saturated fills, `--scrim` token.

**⚠️ NOT YET DONE — the audit surfaced more than got fixed. Pick up here:**
- ✅ **DONE 2026-07-23 (second session)**: the ConfirmDialog migration, the filtered-empty dead
  ends, and the missing-errorMessage/use-action fallback items below are all fixed — see LATEST.
  Still open from this list: the consistency backlog (Stat/IconButton/chip primitives, 📷 emoji,
  product-delete cascade wording), server actions' ~20 hardcoded English error literals, and the
  deeper a11y items (DatePicker arrow keys, Field's dead `data-described-by`).
- **Finish the ConfirmDialog migration**: ~13 callers still fire-and-close, so their delete
  spinner is invisible. Convert each to return the `run(...)` promise from `onConfirm` and drop
  the manual `loading`/synchronous close: `creative/{ideas-panel,learnings-panel,stock-panel,
  product-form,collection-form,image-strip}`, `equipment/{machine-detail,machine-form}`,
  `finance/{categories-panel,recurring-panel,transaction-form}`, `marketing/{campaign-detail,
  sample-list,schedule}`. **stock-panel print-run delete and campaign-cost delete are the
  highest-value** (non-optimistic, slow, currently zero feedback).
- **Error strings reaching Farsi users**: several `run()` calls pass no `errorMessage`, so a raw
  English/DB error can toast (`client-detail:103,221`, `campaign-detail:114,270,286`, one each in
  `reminders`/`sample-list`/`schedule`). And `use-action.ts` has a hardcoded English
  `"Something went wrong."` fallback + toasts raw `error.message`. Server actions return 20-ish
  hardcoded English error literals — should become i18n keys or sentinel codes (auth.ts already
  does this with `"invalid"`).
- **Filtered-empty dead ends** (no "clear filters" action): `clients/directory.tsx:175`,
  `equipment/maintenance-panel.tsx:82`, `finance/transaction-list.tsx` filtered branch. The
  pattern to copy is `creative/collections-panel.tsx:72` / `learnings-panel.tsx:158`.
- **Consistency backlog** (a whole agent's report): promote ONE `Stat`/`StatGrid` primitive
  (5 bespoke copies), ONE `IconButton`, ONE chip; normalise list containers to
  `<ul rounded-xl overflow-hidden>`; add `overflow-hidden` to rounded lists whose rows hover
  (transaction-list + recurring-panel need it now); replace the `📷` emoji in `products-panel.tsx`
  with a lucide icon; product-delete confirm should name the cascade (print runs + stock deleted).
- **Deeper a11y still open**: DatePicker day-grid has no arrow-key navigation (up to 42 tab stops);
  `Field`'s `aria-describedby` is written to a dead `data-*` attribute so hints aren't announced.

Everything above is **verified-but-unfixed** — real, cited, safe to act on. None of it blocks; the
app is in a better state than it was, just not a finished one.

---

**ALL SEVEN PHASES ARE DONE.** If Parsa says "next", "next phase", or "continue", the next work
is **THE RESHAPING PASS — "make it ours"** (the section immediately below). There is no Phase 8
to build from a spec; the next move is to use the system and change what's wrong.

- **Phases 1–7 are DONE, verified against prod, and pushed.** 7 of 7. Every section in
  `src/lib/nav.ts` is `ready: true` — nothing renders as "soon" any more.
- **The reshaping pass is not a phase with a plan.** Read the section below, then ask Parsa what
  is wrong with what he's been using. Renames, re-ordered screens, different numbers — all of it
  is expected and none of it is scope creep.
- The scaffold is finished and correct: the schema, the money contracts, the performance rules,
  the i18n discipline. Those were the expensive-to-get-wrong parts, and they are done properly.
- **Ask Parsa the design questions first** (as every previous phase did) rather than assuming.
- **Commit as Parsa alone. NEVER add `Co-Authored-By`, never mention Claude or AI** in a commit
  message or PR body. This is an absolute rule.

## ⚠️ RESHAPING EXPECTED — "it's a system, but it's not OUR system yet"

Parsa, 2026-07-21: *"this system will need ALOT of changes. and not only visual. cuz like now its
a system. but its not OUR system you know?"*

**Read this as a standing instruction, not a complaint.** Phases 1–7 build a **correct, verified
SCAFFOLD**: the schema, the money contracts, the performance rules, the i18n discipline. Those are
the parts that are expensive to get wrong later, and they are done properly.

What is deliberately **NOT** settled yet:
- **Naming and vocabulary** — "collections", "issues", "learnings", "supplies" are reasonable
  guesses at how Exxion actually talks. Expect Parsa to rename things once he uses it.
- **What is on each screen, and in what order** — the tab layouts are informed guesses.
- **Branding** — see the branding section below. Not started, by design.
- **Which numbers matter** — the charts show what seemed useful; real usage will disagree.

**So: do not treat any surface as finished, and do not defend a layout choice because it shipped.**
When Parsa says "change this", that is the plan working, not scope creep. The reshaping pass
happens after Phase 7, when there is real usage to reshape against.

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

**All six are built.** Every nav entry is `ready: true`.

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

### 🟢 PHASE 7 — MARKETING: BUILT + VERIFIED AGAINST PROD **— THE SEVENTH AND LAST SECTION**
`tsc` · `lint` · `build` green (**29 routes**). **Migration 0010 applied and schema-verified.**
Sidebar entry is **live — every section is now `ready: true`.** Routes: `/marketing` (4 tabs),
`/marketing/campaigns/[id]`, `/marketing/campaigns/new`.

**⚠️⚠️ RULE 1 — A SAMPLE IS COSTED, NEVER EXPENSED.**
A sample links to a Creative product, so `productCost()` knows what it cost to make. It writes
**NO Finance transaction**, and `recordSample` must never be "fixed" to write one: the filament
was expensed when it was BOUGHT (Phase 4), so charging again when the print is given away counts
the same lira twice. Identical to Phase 3's rule for products.
- ✅ **Proven against prod**: creating a sample leaves the transactions table **byte-identical**
  (10 rows → 10 rows), and no `source_type='marketing'` row appears for it.
- ✅ Its value is computed at READ time: a 50g / 2h product at ₺1000/kg + ₺25/h costs ₺100, so
  2 of them = **₺200**. Delete the product and it costs **`null`, never ₺0** — ₺0,00 would claim
  the giveaway was free.
- `givenAwayMinor()` returns an **`uncostedCount`** so the headline figure never silently
  under-reports while looking authoritative.

**⚠️⚠️ RULE 2 — `campaigns.budget_minor` IS THE PLAN; `transactions` IS THE MONEY.**
Fourth in the family after `maintenance_logs.cost_minor` (P4), `orders.total_minor` (P5) and
client lifetime value (P6). A campaign planned at ₺5.000 that never ran spent ₺0.
- Each `campaign_costs` row calls the **shared `syncTransaction()`** — Marketing is its THIRD
  writer. ✅ Proven: two costs → **exactly two** `source_type='marketing'` OUT rows, the ledger
  and the cost rows agree at ₺1.200, and `transaction_id` is stored on both (without it the next
  edit would create a duplicate).
- ✅ **COUNTER-PROOF**: budget + spend reports **₺2.200 for ₺1.200 actually spent**.
- ✅ `budgetUsage().ratio` is **`null` when the budget is 0**, not 0 — "0% of budget used" on an
  unbudgeted campaign reads as headroom that doesn't exist, so the UI says "No budget set" and
  draws no bar at all.
- ✅ Deleting the Finance row leaves the cost standing with a null link (SET NULL).

**⚠️ THE SCHEDULE IS A LENS, NOT A TABLE.** `events` was **not touched by this migration**. The
Marketing schedule reads `kind in ('filming','networking','campaign')` from the SAME table the
client timeline reads, and reuses the same `createEvent`/`deleteEvent` actions from
`actions/clients.ts`. ✅ Proven: a filming event created here is one row of `events`. Phase 6 put
those kinds in the CHECK on purpose so this phase needed no migration for them.

**⚠️ INSIGHTS DELIBERATELY DOES NOT CLAIM CAMPAIGNS EARNED MONEY.** Nothing in the data proves an
order came from a campaign, so there is no ROI figure anywhere — an invented attribution number is
worse than none, because it gets believed and then spent against. What it reports: spend per
campaign (from Finance), what the giveaways cost, and **which channel new clients said they came
from** (Phase 6's `clients.source`). The panel says so in its own subtitle. If real ROI is ever
wanted it needs `orders.campaign_id` and the discipline of tagging every order — a decision, not
a chart.

**✅ VERIFICATION — 40 checks, all passing:**
- **14 schema checks** against prod: every column of all three tables by name, RLS blocks anon on
  each, CHECK constraints reject `channel:'billboard'` / `status:'vibing'` / `quantity:0`, the
  Marketing category seeded as an expense, and deleting a campaign **cascades its costs but leaves
  the sample standing** with `campaign_id` nulled.
- **12 unit tests** on `lib/marketing.ts` (pure — no React, no Supabase).
- **14 end-to-end** against prod with real rows, cleaned up afterwards.
- **Farsi + light/dark driven signed-in on all FOUR tabs** in EN and FA: `lang` correct,
  `dir=ltr`, Persian text present, **no untranslated leaks**, money in Latin digits, no
  physical-direction classes. A bogus campaign id **404s**. The other four sections still render.
  ⚠️ Note for future checks: `TabbedPanels` renders **only the active tab's panel**, so asserting
  on another tab's copy needs `?tab=<id>` — the first Farsi run "failed" on exactly this and the
  code was right.
- Design detector clean (only the documented known-false `image-strip.tsx` warning).
- `npm run wipe` dry-run lists `samples` · `campaign_costs` · `campaigns` child-first.

**Still worth Parsa's eyes**: create a campaign with a ₺1.000 budget, log two costs over it, and
watch the bar turn red AND the expense appear in Finance tagged *Marketing*. Then log a sample and
confirm Finance does **not** move.

### 🟢 PHASE 6 — CLIENTS: BUILT + VERIFIED AGAINST PROD **and driven in a browser**
`tsc` · `lint` · `build` green (**26 routes**). **Migration 0009 applied and schema-verified.**
Sidebar entry is **live**. Routes: `/clients` (2 tabs), `/clients/[id]`, `/clients/new`.

**⚠️⚠️ THE RULE THIS PHASE TURNS ON — LIFETIME VALUE IS MONEY THAT ARRIVED.**

> **`orders.total_minor` IS THE AGREED PRICE. `transactions` IS THE MONEY.**

`revenueByClient()` in `lib/clients.ts` joins **transaction → order → client** (a transaction's
`source_id` is the ORDER, not the client) and lets `direction` carry the sign, so a refund
subtracts. **Never rank clients by summing `orders.total_minor`.**
- ✅ **Proven against prod**: a client with a ₺5.000 quote and no payment has a lifetime value of
  **₺0**, while a client who paid ₺5.000 across a deposit + balance + a second order reads
  **₺5.000**. The same test demonstrates that the naive sum reports **₺5.000 for the client who
  has never sent a lira**, ranking them **level with the best client on the board**. Third in the
  family of bugs after `maintenance_logs.cost_minor` (Phase 4) and order revenue (Phase 5).
- ✅ A refund subtracts: ₺5.000 → **₺4.500** after a ₺500 `direction:'out'` row.

**Migration 0009 is ADDITIVE ONLY.** `clients` gains `kind`, `source`, `tags`, `birthday`,
`address`, `postal_code`, `country`. Nothing dropped, renamed or retyped — `orders.client_id` and
every past sale depend on those rows staying as they are.
- `kind`/`source` are **CHECK-constrained text, not enums** (matching `orders.stage`), so adding
  "tiktok" later is a two-line `alter constraint`, not an `alter type` that locks the table.
  ✅ Verified: `kind:'wizard'` and `source:'carrier pigeon'` are both **refused with 23514**.
- ⚠️ **`source` is NULLABLE and null is a REAL ANSWER.** "Nobody asked how they found us" is not
  "other", and `bySource()` **returns the unknown bucket rather than filtering it out** — dropping
  it would make the percentages add to 100% of a subset while looking like 100% of the business.

**⚠️ `events` IS ONE TABLE WITH TWO LENSES**, the same shape as `issues` → Learnings. A client's
timeline and Phase 7's Marketing schedule are two VIEWS of "something happened on a date".
- ⚠️ **The Marketing kinds are already in the CHECK** (`filming`, `networking`, `campaign`) even
  though Phase 6 renders none of them. ✅ Proven: inserting a `filming` event **succeeds today**.
  Phase 7 adds a lens, not a migration.
- ⚠️ **Both links are SET NULL, never cascade** — matching `issues.collection_id`. ✅ Proven
  against prod: deleting a client leaves the **complaint standing** with `client_id` nulled, and
  then deleting the order leaves it standing again with `order_id` nulled. Deleting a client also
  leaves **the orders AND their revenue** intact (Phase 5's guarantee, re-proven).

**⚠️ `goneQuiet` REQUIRES 2+ ORDERS, deliberately.** A client who ordered once and never came back
is not "at risk" — they are a one-time buyer, which is the largest group there is. Including them
would bury the handful of genuinely lapsed regulars, and a list that always has fifty names in it
stops being read. ✅ Unit-tested both directions.

**⚠️ `repeatRate` returns `null`, never `0`, when nobody has ordered** — same guard as `lostRate()`.
A 0% rendered on a dashboard reads as "nobody ever returns", a claim about the business rather
than about the data. Same reason `averageOrderMinor` is `null` and not ₺0,00.

**`createClientRecord`/`updateClientRecord` MOVED** out of `actions/shipping.ts` into
**`src/lib/actions/clients.ts`** — the same lift-and-share as `syncTransaction()` in Phase 5. One
implementation, so the field trimming can't drift. **Clients ARCHIVE, never delete** (the confirm
dialog says the orders and revenue stay); events DO delete, since nothing references them.

**Dashboard**: a gone-quiet signal was added **INSIDE the existing `Promise.all`**, and — unlike
Phase 4's `machinesDown` — **it is actually rendered** in `NeedsYou`, deep-linking to
`/clients?tab=insights`.

**✅ VERIFICATION — 41 checks, all passing:**
- **16 schema checks** against prod: every new column queryable by name, all 10 `events` columns,
  RLS blocks the anon key, the CHECK constraints reject bad values, defaults land.
- **14 unit tests** on `lib/clients.ts` (pure, no React/Supabase — same as `costing.ts`).
- **11 end-to-end** against prod with real rows, cleaned up afterwards.
- **✅ FARSI + LIGHT/DARK — THE PHASE 5 DEBT IS NOW CLEARED.** Driven signed-in on the real dev
  server for `/clients`, `/clients/[id]`, `/clients/new` **AND `/shipping`**, in EN and FA:
  `lang` correct, `dir=ltr` (Parsa's call), Persian text present, **no untranslated leaks**,
  **money still Latin digits**, no physical-direction classes in the served HTML. A bogus client
  id correctly **404s** instead of rendering an empty shell.
  ⚠️ The trick Phase 5 lacked: **don't hand-write the session cookie** — `@supabase/ssr` chunks
  and encodes them. Sign in with `createServerClient` and let it serialise the jar itself.
- Design detector clean (only the documented known-false `image-strip.tsx` warning).
- `npm run wipe` dry-run lists **`events` first** — it must precede `clients` and `orders`.

**Still worth Parsa's eyes**: make a client, attach an order, take a deposit, and watch the
lifetime value on `/clients` move by the DEPOSIT — not by the order total.

### 🟢 PHASE 5 — SHIPPING: BUILT + VERIFIED AGAINST PROD (the revenue half of the system)
`tsc` · `lint` · `build` green (**23 routes**). **Migration 0008 applied and schema-verified.**
Sidebar entry is **live**. Routes: `/shipping` (3 tabs), `/shipping/orders/[id]`,
`/shipping/orders/new`.

**⚠️ THIS PHASE CLOSED THE LOOP: Finance now has INCOME.** Phases 1–4 only recorded money going
out. Orders are the first `direction:'in'` writer into the `transactions` contract.

**⚠️⚠️ THE MOST IMPORTANT RULE IN THIS SECTION — DEPOSITS.**
Parsa confirmed deposits are normal for Exxion, and that **overturned the original design**. The
plan said "revenue on delivered"; that is WRONG when a deposit already arrived, because it either
ignores the deposit or counts it twice.

> **THE STAGE IS THE WORK; THE PAYMENT IS THE MONEY.**

- `orders.total_minor` is the **AGREED PRICE**. `order_payments` is the **MONEY**.
  **NEVER sum `orders.total_minor` for revenue** — a quoted order that was never paid would be
  booked as income. ✅ Proven: a ₺5.000 quote with no payment writes **nothing** to Finance.
- Each payment writes ONE Finance transaction (`source_type:'order'`, category *Sales*).
- Reaching `delivered` prompts for the **OUTSTANDING BALANCE** (total − payments so far),
  pre-filled, and says out loud that the deposit was subtracted. If already paid in full it says
  so and writes nothing.
- ✅ **Proven end to end against prod**: ₺3.000 order → ₺1.000 deposit → outstanding reads
  **₺2.000, not ₺3.000** → balance recorded → Finance holds **exactly ₺3.000 across 2
  transactions, not ₺4.000**. The test also demonstrates that summing the total *plus* the
  payments would report **₺6.000 for a ₺3.000 order** — the bug this design avoids.
- A **refund** is `kind:'refund'`, written as an OUT transaction: positive magnitude, direction
  carries the sign, exactly as the ledger does.

**⚠️ `syncTransaction()` MOVED.** It was lifted out of `actions/equipment.ts` into
**`src/lib/actions/finance-link.ts`** because Shipping became its second writer. It is the
contract every section honours, not one section's helper. It gained a `direction` parameter
(defaults to `'out'`, so Equipment is unchanged). ✅ **Phase 4's ₺450 repair verification was
re-run as a regression and still passes**, including the ₺450-not-₺900 no-double-count proof.

**Stage history is append-only.** `orders.stage` says *where*; `order_stage_events` says *when*.
**Both are written on every transition** — updating only the column loses history silently and
cycle-time quietly becomes wrong. ✅ Proven: 5 transitions → 5 rows with distinct timestamps.

**⚠️ Cycle time uses the MEDIAN, not the mean.** One order that sat in "quoted" for six months
while a client went quiet would drag an average into uselessness. ✅ Unit-tested: a 365-day
outlier among 2-day quotes still reports **2 days**.

**⚠️ Three SET NULL guarantees, all proven against prod:**
- Delete the Finance transaction → the **payment row survives**, link nulled.
- Delete a Creative **product** → the **order line survives** with its description intact
  (`description` is denormalised at write time for exactly this).
- Delete a **client** → the **order and its revenue survive**.
- Delete the **order** → lines and stage events cascade away, but **the Finance income stays** —
  that money really was received. The confirm dialog says so.

**`clients` was built HERE, not in Phase 6**, so orders had a real FK from day one instead of a
text field to migrate later. `/clients` stays `ready: false` — the table exists, the section
doesn't.

**Per-collection P&L shipped** (the item deferred since Phase 3). Third tab on a collection.
Revenue = what SOLD; cost = `productCost() × quantity sold`, **still computed at read time**. A
design nobody bought costs nothing. Lines whose product was deleted are counted in revenue but
can't be costed — the panel says so rather than flattering the margin.

**Two bugs found and fixed while building:**
1. **`NeedsYou` accepted `machinesDown` and `lowSupplies` and never rendered them** — a broken
   machine reached the dashboard in Phase 4 and then vanished. Now rendered, with deep links.
2. **The Reminders composer was crushed** (Parsa reported with a screenshot): the panel was pinned
   in a fixed `20rem` rail, so the text input collapsed to a few characters. The rail is now
   `xl:minmax(26rem,32rem)` and the input has `basis-48` instead of `min-w-0` — a basis gives it a
   floor to defend instead of shrinking to nothing.

**⚠️ `react-hooks/purity` is an ERROR here.** `Date.now()` / `todayInIstanbul()` **cannot** be
called during render — an impure read gives a different answer on each re-render, so a stage's
measured duration would creep upward as you click around. `today` is stamped once in
`(app)/shipping/page.tsx` and passed down as a prop. Do not "simplify" that back.

**❌ NOT VERIFIED — Farsi and light/dark on the new surfaces.** Every earlier phase confirmed this
by driving the real page; this time the harness could not forge a valid `@supabase/ssr` session
cookie (it chunks and signs them), so every protected route returned 307. **The signed-out
redirect is correct behaviour, not a bug** — but it means the Farsi pass is genuinely outstanding.
`tsc` proves both dictionaries have every key; it does **not** prove they render. **Worth doing
first thing next session**, ideally by Parsa just switching to Farsi in Settings and opening
`/shipping`.

**Also not driven in a browser yet.** Worth Parsa's eyes: make an order with two items, take a
deposit, drag it to Delivered, and confirm the prompt asks for the REMAINDER.

### 🟢 PHASE 4 — EQUIPMENT: BUILT + VERIFIED AGAINST PROD (+ deploy unblocked, Farsi now LTR, filament stock)
`tsc` · `lint` · `build` green (20 routes). **Migrations 0005 · 0006 · 0007 applied.** Sidebar live.

**⚠️ EQUIPMENT IS THE FIRST REAL WRITER INTO THE `transactions` CONTRACT.** Logging a repair with a
cost creates a genuine Finance expense tagged `source_type='equipment'`, `source_id` = the machine,
categorised *Maintenance*. That is what `transactions.source_type`/`source_id` (0003) was built for.
✅ **Proven end to end**: a ₺450 repair appeared in Finance, in July's net, correctly categorised.

**⚠️ THE TRANSACTION IS THE SINGLE SOURCE OF TRUTH FOR MONEY.** `maintenance_logs.cost_minor` is the
INPUT that creates it; Finance is where it's counted. **Never sum `cost_minor` for a total** — the
verification demonstrates that summing both sources reports **₺900 for a ₺450 repair**. "Spent on
this machine" reads `transactions`, always (see the query comment in `(app)/equipment/page.tsx`).

**⚠️ `transaction_id` is `on delete SET NULL`.** ✅ Proven: deleting the Finance row leaves the
maintenance log intact with a null link — the repair still happened. Deleting the *machine* cascades
its logs but **leaves the expenses standing**, because that money really was spent; the confirm
dialog says so.

**Machine purchase price is OPT-IN, and this was a real question from Parsa** ("I added a printer,
why didn't the cost show up in Finance?"). It doesn't, by default: most machines are entered long
after they were bought and were already expensed then, so auto-logging would **double-count and
date it to today**. Migration **0006** adds `machines.purchase_transaction_id` and the form now has
a checkbox — off by default, and when ticked the expense is dated to **`purchased_on`**, not today.

**⚠️ FILAMENT STOCK — deducted per PRINT RUN, never per product** (migration **0007**). A product is
a *design*; creating it consumes nothing, and printing it 50 times is what empties the spool.
- `materials.supply_id` (nullable) links the costing material to the stocked supply it physically
  IS. Null is normal — a material bought per job has no stock. Two tables stayed two tables: gloves
  and boxes have no cost-per-kg, and a per-job material has no count.
- `print_runs` records units + a **snapshot** of `grams_used`. Undoing a run restores from the
  snapshot, **not** from the product's current grams — the design may have been edited since.
- ✅ Proven: 1000g spool → 12 × 25g → 700g → 20 more → 200g, tripping low-stock at the threshold.
- The print-run dialog states what will be deducted **before** you confirm, including
  "No stock linked — nothing was deducted", so an unlinked material is never a silent no-op.

**Reminders reuse — no new table.** `reminders` (0001) already carries `source_type`/`source_id`,
so "service this printer in 3 months" is a reminder pointed at a machine, and it lands in the
dashboard strip for free.

**⚠️ FARSI IS NOW LTR (Parsa's call, 2026-07-21).** He asked for translation only, no mirrored
layout. `DIRECTIONS.fa` is `"ltr"` in `lib/i18n/index.ts`. ✅ Verified: `dir=ltr lang=fa` with
Persian text intact. **The logical CSS properties and their lint rule STAY** — they cost nothing
while LTR and mean re-enabling RTL is that one line, not another sweep of every component.

**Deploy unblocked.** Vercel refused the build because `parsaa.mansourii@gmail.com` matched no
GitHub account. ⚠️ **An empty commit alone would NOT have fixed it** — the new commit carries the
same email. Fixed by `git config user.email parsaxavier@gmail.com` (going forward only, no history
rewrite); ✅ commit `bc3fc09` is now attributed to GitHub user **ParSaMnSS**.
⚠️ **If the build still fails it's the ENV VARS** — `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are read at BUILD time and must be set in the Vercel
dashboard. Only Parsa can do that; they're gitignored and must stay so.

**`npm run wipe`** (`scripts/wipe-data.mjs`) — clears all business data, keeps accounts/settings.
Dry-run by default; `-- --confirm` requires typing DELETE. ⚠️ It names every table **explicitly**
because three relationships deliberately survive their parent (issues, maintenance logs,
transactions) — "delete all collections" would leave issues behind.

**Not driven in a browser yet.** Worth Parsa's eyes: log a repair with a cost and watch it appear in
Finance; link PLA to a spool in Settings then log a print run and watch grams drop.

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
  are recorded in comments; state colours are reserved. ⚠️ **Row lists use `.list-inset` +
  `.row-hover`** (inset rounded-pill hover) — NOT `<li border-b hover:bg-raised>`, which paints a
  full-bleed edge-to-edge slab that ignores the panel's radius. Add a hover row via those utilities.
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
- `src/lib/nav.ts` — the six sections, **all now `ready: true`**. The disabled-with-a-"soon"-chip
  path still exists for anything added later. Unbuilt ones render disabled rather than
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
  Returns `null` (not 0) when uncosted. Parses `numeric`-as-string. ⚠️ **As of 0014 it reads the
  per-kg price off the SUPPLY (`product.supply_id` → `supply.cost_per_kg_minor`), not a `materials`
  row** — the `materials` table is gone.
- `src/components/creative/learnings-panel.tsx` — **ONE component, two lenses.** Pass
  `collectionId` for a collection's Issues tab; omit it for app-wide Learnings. Do not fork this
  into a second implementation — they would drift, which is the failure this section exists to
  prevent.
- `src/components/creative/image-strip.tsx` — product/issue photos. Thumbnails signed WITH a
  `transform` (a transform appended to an already-signed URL silently returns the full-size image).
- `src/components/settings/costing-form.tsx` — machine rate + materials. Editing either re-costs
  every product, which is why its actions revalidate `/creative` too.
**Equipment (phase 4):**
- `src/lib/actions/equipment.ts` — **`syncTransaction()` is the contract in one function.** Cost set
  → create; changed → update; **cleared → DELETE** (a ₺0 expense is ledger noise). The returned id
  is the only link; store it or the next edit creates a second transaction.
- `src/lib/equipment.ts` — `isLowStock` (⚠️ `numeric` arrives as a STRING; `"9" > "10"` is true for
  strings), status rank/tone.
- `src/components/equipment/*` — panels, machine detail, forms.
- `src/components/creative/print-run-button.tsx` — **where filament leaves stock.**
**Shipping (phase 5):**
- `src/lib/actions/finance-link.ts` — **`syncTransaction()` + `categoryIdByName()`, THE
  CROSS-SECTION CONTRACT.** Lifted here from `equipment.ts` so Equipment and Shipping share one
  implementation. Takes a `direction` (`'out'` default). ⚠️ The returned id is the only link —
  store it or the next edit creates a second transaction.
- `src/lib/shipping.ts` — pure order arithmetic. **`outstandingMinor()` is the number the whole
  phase turns on.** Also `paidMinor` (refunds subtract), `medianStageDurations` (median, not
  mean), `lostRate` (null when nothing has finished — a rate over zero orders reads as good news).
  No React, no Supabase, so the money logic is directly testable.
- `src/lib/actions/shipping.ts` — orders, lines, stage events, **`recordPayment` (the Finance
  writer)**. `setOrderStage` writes BOTH the column and the event row, and returns the outstanding
  balance so the UI can prompt.
- `src/components/shipping/balance-prompt.tsx` — **the dialog that keeps deposits right.**
- `src/components/shipping/order-board.tsx` — the board. ⚠️ Drag-and-drop is a convenience; the
  **stage dropdown on every card is the real control** and the only one reachable by keyboard.
- `src/components/creative/collection-pnl.tsx` — per-collection P&L.
- `src/components/finance/charts.tsx` — ⚠️ `useChartMode`, `AXIS`, `compactMinor`, `monthLabel`
  and `ChartTooltip` are **exported and reused** by Shipping's charts. Don't copy them.
**Clients (phase 6):**
- `src/lib/clients.ts` — **pure analytics, and the file that enforces "money that ARRIVED".**
  `revenueByClient()` (transaction → order → client, refunds subtract) · `clientStats` ·
  `repeatRate` (null, not 0) · `newVsReturning` · `bySource` (keeps the unknown bucket) ·
  `goneQuiet` (2+ orders on purpose) · `topClients`. Also `CLIENT_KIND_KEY` / `CLIENT_SOURCE_KEY` /
  `EVENT_KIND_KEY` — value→i18n key in ONE place each, like `STAGE_KEY`.
- `src/lib/actions/clients.ts` — clients + events. **`createClientRecord`/`updateClientRecord`
  moved here from `actions/shipping.ts`.** Clients **archive**; events delete. Tags are
  lowercased/trimmed/de-duplicated here so "Gift" and "gift " never become two tags.
- `src/components/clients/*` — `panels` (Directory · Insights) · `directory` (client-side filters) ·
  `client-detail` · `client-form` · `event-timeline` · `insights`.
  ⚠️ `insights.tsx` reuses `useChartMode` from `finance/charts.tsx` and the validated
  `CATEGORY_COLORS` / `OTHER_COLOR` — don't introduce a second palette.
- `scripts/wipe-data.mjs` — `npm run wipe`. Dry-run by default. ⚠️ **`events` is listed FIRST**:
  it points at both `clients` and `orders`, and because both links are SET NULL, leaving it out
  would not error — it would silently strand a pile of orphaned notes.
**Marketing (phase 7):**
- `src/lib/marketing.ts` — **pure logic, and the file that enforces both rules.**
  `campaignSpendMinor` · `budgetUsage` (**null ratio on a zero budget**) · `sampleCostMinor`
  (**null, never 0**, reuses `productCost`) · `givenAwayMinor` (reports `uncostedCount`) ·
  `newClientsBySourceByMonth` (the honest signal) · `overBudgetCampaigns` · `groupCosts`. Plus
  `CAMPAIGN_CHANNEL_KEY` / `CAMPAIGN_STATUS_KEY` / `MARKETING_EVENT_KIND_KEY`.
- `src/lib/actions/marketing.ts` — campaigns (**archive, not delete**), `addCampaignCost` /
  `deleteCampaignCost` (**the third `syncTransaction()` writer**), `recordSample` /
  `deleteSample` (**writes NO transaction, deliberately**).
- `src/components/marketing/*` — `panels` (4 tabs) · `campaign-list` (exports **`BudgetBar`**,
  reused by the detail page) · `campaign-detail` · `campaign-form` · `schedule` (**the events
  lens — reuses `createEvent`/`deleteEvent` from `actions/clients.ts`**) · `sample-list` ·
  `insights`.
- `supabase/migrations/0001_foundation.sql` · `0002_backfill_profiles.sql` · `0003_finance.sql` ·
  `0004_creative.sql` · `0005_equipment.sql` · `0006_machine_purchase_expense.sql` ·
  `0007_material_stock.sql` · `0008_shipping.sql` · `0009_clients.sql` · `0010_marketing.sql` ·
  `0011_vocabularies.sql` … `0016_supply_category_item.sql` (all APPLIED per Parsa) ·
  **`0017_auto_reminders.sql`** (APPLIED) · **`0018_order_code_sequence.sql`** ·
  **`0019_order_campaign.sql`** · **`0020_product_files.sql`** (the last THREE are ⚠️ **WRITTEN,
  NOT YET APPLIED** — see the LATEST section at the top).
- `scripts/apply-migration.mjs` — Management-API applier (alternative to `db push`).

## Roadmap / next steps
**7 phases. Say "next phase" to start the next unbuilt one.**

1. ✅ **Foundation** — auth, shell, i18n+RTL, tokens, UI kit, data layer, dashboard, settings.
2. ✅ **Finance** — transactions (the hub), categories, recurring, charts, CSV, receipts.
3. ✅ **Creative hub** — ideas · collections → products · issues → learnings · costing.
4. ✅ **Equipment** — machines, maintenance, supplies, filament stock. **The first real writer
   into `transactions`**: a repair logs an expense with `source_type='equipment'`, which is the
   contract Phase 2 was built to honour.
5. ✅ **Shipping** — order lifecycle board, staged + timestamped, **payments → Finance income**,
   per-collection P&L. The revenue half of the system.
6. ✅ **Clients** — directory + pattern analytics + the `events` table. **Lifetime value is read
   from `transactions`, never from `orders.total_minor`** — a client with an unpaid ₺5.000 quote
   is worth ₺0, proven against prod.
7. ✅ **Marketing** — campaigns with budget vs actual, the schedule (a LENS over `events`), free
   samples, honest insights. **A sample is COSTED, never EXPENSED**; **the budget is the plan,
   `transactions` is the money** — both proven against prod.
8. ✅ **"Make it ours"** — the reshaping pass. All 14 items Parsa raised after using the system,
   in four phases:
   - **Vocabularies** (`11e26d5`) — `vocabularies` registry with database-enforced dedupe;
     `ComboCreate` type-to-create; product types and client tags; search on any list ≥5.
   - **Identity + UI** (`b376172` `5dd300f` `f44247d` `53c8ab7` `fd7793a` `900603c` `e6f0d31`) —
     EXXION blue + amber accent with **`npm run contrast`** guarding 44 measured pairs; wordmark
     and app icon; the four reported layout bugs; two row densities replacing six ad-hoc pairs;
     a defect pass over all seven sections.
   - **Product stock** (`067af91`) — append-only `product_stock_movements` ledger, print
     outcomes, order/sample/correction wiring. See the ⚠️ block below.
   - **Shell** (`4f523da`) — user colour removed, Finance category safe-delete, language toggle
     in the sidebar and mobile sheet.

⚠️ **FOUR MIGRATIONS ARE WRITTEN BUT NOT APPLIED** — `SUPABASE_ACCESS_TOKEN` is empty in
`.env.local`, so `npm run migrate` cannot run and **only Parsa can push these**:
- **`0012_product_stock.sql`** — until it lands, the Creative **Stock** tab and the dashboard
  out-of-stock signal throw `PGRST205`. That is deliberate (see `lib/data/query.ts`): a missing
  migration must be loud, not an empty state.
- **`0013_drop_profile_color.sql`** — drops `profiles.color` and **re-issues the column-grant
  list without it**. The app already ignores the column, so this is safe to run at any time;
  running it is what makes the grants correct. See the grant note in `0001_foundation.sql`.
- **`0014_supply_costing.sql`** (2026-07-22) — folds `materials` into `supplies`: adds
  `supplies.cost_per_kg_minor` + `kind`, adds `products.supply_id`, **drops `products.material_id`
  and the `materials` table**. Until it lands, the Supplies cost field, product costing, and
  print-run deduction throw. Reverses 0007's two-table split. Safe to push on the wiped DB — no
  data to migrate.
- **`0015_supply_type.sql`** (2026-07-22) — reworks the Supplies tab: adds `supplies.type`
  (searchable category), **drops `supplies.kind`**, widens `vocabularies.kind` CHECK to allow
  `supply_type`, seeds starter types. Until it lands, the Supplies tab throws (missing `type`).

**⚠️ The stock idempotency key is subtler than it looks.** `product_stock_movements_once_idx` is
`(reason, source_id, product_id, delta_sign, apply_seq)` and every part earns its place — four
simpler keys were tried and each let a real double-write through. The reasoning is recorded in
`src/lib/stock-write.ts`; **read it before "simplifying" that index.** On-hand is always
`sum(delta)`, never a stored column.

Finance is second **on purpose**: every later section writes into its `transactions` contract, so
that contract must exist before anything can honour it.

**Also outstanding:**
- ✅ ~~Farsi + light/dark pass on the Phase 5 surfaces~~ — **DONE in Phase 6**, for `/shipping`
  as well as `/clients`. See the ✅ VERIFICATION block under Phase 6 for the technique.
- ⚠️ **Set the Vercel env vars** — `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The first two are read at
  BUILD time, so the deploy fails without them. **Only Parsa can do this.**
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
| All seven sections | ✅ **Every one is `ready: true`.** Nothing renders as "soon" any more | — | Done |
| Campaigns | ✅ **Shipped (Phase 7).** Budget vs actual, itemised costs each writing one Finance expense, archive | Per-campaign ROI — needs `orders.campaign_id` and the discipline of tagging orders. Deliberately NOT guessed at | If asked |
| Samples | ✅ **Shipped (Phase 7).** Costed from the product at read time, never expensed. Optional links to client and campaign | Opt-in "also log a print run" so a sample printed for the occasion deducts filament in one step | Later |
| Marketing schedule | ✅ **Shipped (Phase 7)** as a LENS over `events` — filming, networking, campaign moments | A calendar view rather than two lists | Later |
| Materials / Supplies | ✅ **MERGED + RESHAPED (2026-07-22, migrations 0014 + 0015).** One `supplies` row carries stock (grams/pieces, low-stock, restocks) AND the per-kg cost. Type is a **searchable/creatable category** (`supply_type` vocabulary); a **"printing material" checkbox** (signal = non-null cost) splits filament (grams+cost) from packaging (pieces). List grouped by type. `materials` table dropped | — | Done (pending 0014+0015 push) |
| Product photos | Upload/remove on the product EDIT form + **✅ a lightbox** (2026-07-22, `components/creative/lightbox.tsx`) | Staged upload on create + reordering (staged-create deliberately NOT built — storage-contract risk) | If asked |
| Product design files | ✅ **Shipped (2026-07-22, migration 0020).** `.mb`/`.ma`/`.stl` per product, beside Print-run; browser→bucket upload, download at click | Versioning / preview | If asked |
| Filament per print | ✅ **Shipped (2026-07-23, migration 0021 — PENDING PUSH).** `products.measured_grams` (supports included) captured on FIRST print via the print-run overlay, then overrides the estimate for stock deduction AND cost everywhere (`effectiveGrams()`); editable on the product form | Per-run weight history / averaging across runs (chose single measured value, not per-run) — and "warn if a later run's weight drifts far from measured" | If asked |
| Per-collection P&L | ✅ **Shipped (Phase 5).** Revenue from order lines meeting computed cost | Time series, per-product margin trends | Later |
| Clients | ✅ **Shipped (Phase 6).** Directory (search · kind/source/tag filters · archive) + Insights (top clients, repeat rate, new vs returning, source breakdown, gone quiet) + per-client detail with order history and event timeline | Per-client P&L against computed cost; birthday reminders auto-created via the `reminders` back-link; CSV export | Later |
| Events | ✅ **Table shipped (Phase 6)**, client lens only. Marketing kinds already pass the CHECK | The Marketing lens — filming days, networking, campaigns — over the SAME rows | Phase 7 |
| Client tags | Free-form, lowercased, capped at 25. Filterable in the directory | A managed vocabulary if the free-form list gets messy | If asked |
| Carrier / tracking | Plain text fields, by decision | No carrier API integration is planned | Not planned |
| Order codes | ✅ **Auto `EX-###` (2026-07-22, migration 0018 — PENDING PUSH).** Sequence + `next_order_code()` RPC pre-fills the new-order form, still editable | — | Done (pending 0018) |
| Finance charts | 12-month in/out bars · category breakdown · net line | Budgets, per-collection P&L, forecasting — deliberately deferred until there's real data to budget against | Later |
| Receipts | One file per transaction (5 MB, image/PDF), private bucket, signed at click | Multiple attachments; OCR of totals | Later |
| Transaction window | The page loads ~13 months (cap 2000 rows) so filtering is instant client-side; ✅ **client-side "show more" render cap (2026-07-22)** so a long ledger doesn't paint every row | Server-side query when the 2000 cap bites (~3 years away) | When the cap bites |
| Branding | Neutral placeholder tokens, measured for contrast, all in one CSS block | Real Exxion identity — a variable swap, not a rewrite | When branding exists |
| Dashboard | "Needs you" strip (reminders only) + reminders panel; activity area is a dashed placeholder | Per-section signals in the SAME `Promise.all` wave; real activity feed | Phases 2–7 |
| Reminders | Personal, optional due date, optional `source_type`/`source_id` back-link | Equipment maintenance auto-creates them via the back-link | Phase 4 |
| Realtime | `useRealtimeRefresh` + `<LiveRefresh>` built and mounted on the dashboard | In-place patching where a full refresh feels heavy | Later |
| Search (⌘K) | ✅ **Shipped (2026-07-22).** Palette over clients/orders/products/collections/supplies/campaigns; fans out one action while typing; portalled to body | Fuzzy ranking, recent items | If asked |
| Campaign ROI | ✅ **Shipped (2026-07-22, migration 0019 — PENDING PUSH).** `orders.campaign_id` (human-tagged); revenue from `transactions`, untagged-order count shown | — | Done (pending 0019) |
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
- ⚠️⚠️ **NEVER SUM `orders.total_minor` FOR REVENUE.** It is the AGREED PRICE. The money is
  `order_payments`, and authoritatively the `transactions` rows they wrote. Summing totals books
  quoted-but-unpaid orders as income. Same family of bug as summing `maintenance_logs.cost_minor`.
- ⚠️ **Deposits mean "log the total on delivery" is WRONG.** Reaching `delivered` must prompt for
  the OUTSTANDING BALANCE (`outstandingMinor()` in `lib/shipping.ts`), never the total. This was
  Parsa's own answer overturning the original plan — don't let a later refactor "simplify" it back.
- ⚠️⚠️ **NEVER RANK CLIENTS BY `orders.total_minor`.** A client's lifetime value is the
  `transactions` their payments wrote — `revenueByClient()` in `lib/clients.ts`. Summing agreed
  prices puts someone who has paid nothing level with the best client on the board (proven with
  real rows against prod). Third in the family after `maintenance_logs.cost_minor` and order
  revenue.
- ⚠️ **`clients.source` null ≠ 'other'.** Null means nobody asked; 'other' means they told you
  something off the list. `bySource()` returns the unknown bucket rather than dropping it —
  filtering it out makes the percentages add to 100% of a subset while looking like the whole
  business.
- ⚠️ **`goneQuiet` deliberately needs 2+ orders**, and `repeatRate`/`averageOrderMinor` return
  **null, never 0**, when there is nothing to divide. A 0% reads as a claim about the business.
- ⚠️ **`events` is ONE table with TWO lenses** (client timeline · Phase 7 Marketing). The
  Marketing kinds already pass the CHECK — add the lens, not a migration. Both `client_id` and
  `order_id` are **SET NULL**: deleting a client must not delete the record that the meeting
  happened.
- ⚠️⚠️ **A SAMPLE WRITES NO FINANCE TRANSACTION, EVER.** The filament was expensed when it was
  bought; charging again when the print is given away double-counts it. Its value is computed at
  read time by `sampleCostMinor()`, and is **null (not ₺0) when it can't be costed** — ₺0,00 would
  claim the giveaway was free. Same rule as products (P3) and machine purchase prices (P4).
- ⚠️⚠️ **NEVER ADD `campaigns.budget_minor` TO CAMPAIGN SPEND.** The budget is the PLAN; the
  `transactions` rows are the money. Adding them reports **₺2.200 for ₺1.200 spent** (proven).
  Fourth in the family after `maintenance_logs.cost_minor`, `orders.total_minor`, and ranking
  clients by agreed prices.
- ⚠️ **`budgetUsage().ratio` is null on a zero budget** — render "No budget set" and NO bar. A bar
  at 0% reads as headroom that doesn't exist.
- ⚠️ **Marketing's Insights must not claim a campaign earned money.** Nothing links an order to a
  campaign, and an invented attribution number gets believed. Real ROI needs `orders.campaign_id`
  and the discipline of tagging every order — a decision, not a chart.
- ⚠️ **`TabbedPanels` renders ONLY the active tab's panel.** A test asserting on another tab's
  copy must pass `?tab=<id>`, or it fails against perfectly correct code (this happened during the
  Phase 7 Farsi pass).
- ⚠️ **Driving a protected route in a script needs a REAL session cookie.** Don't hand-write it —
  `@supabase/ssr` chunks and base64-encodes them, which is why Phase 5's Farsi pass failed with
  307s. Sign in through `createServerClient` with an in-memory jar and reuse what it serialises.
- ⚠️ **`setOrderStage` must write BOTH** the `stage` column and an `order_stage_events` row.
  Updating only the column loses history silently and cycle-time becomes quietly wrong.
- ⚠️ **`react-hooks/purity` is an ERROR.** Never call `Date.now()` or `todayInIstanbul()` during
  render — stamp it on the server and pass it as a prop (see `(app)/shipping/page.tsx`).
- ⚠️ **A Supabase embedded relation is typed as an ARRAY** even when the FK guarantees one row
  (`products.collections`). Declaring it as an object compiles against a lie and reads `undefined`
  at runtime. Normalise with a helper — see `shipping/orders/new/page.tsx`.
- ⚠️ **Never sum `maintenance_logs.cost_minor` (or `supply_restocks.cost_minor`) for a total.**
  The linked `transactions` row is the money; the cost column is only the input that created it.
  Summing both reports double. Machine spend queries `transactions` by `source_id`.
- ⚠️ **A machine's `purchase_price_minor` does NOT create an expense unless the checkbox is
  ticked** — most machines are entered after they were already expensed. When ticked, the expense
  is dated to `purchased_on`, not today.
- ⚠️ **Filament deducts on a PRINT RUN, never on product creation** — a product is a design.
  Undo restores from the run's `grams_used` snapshot, not the product's current grams.
- ⚠️ **`materials` and `supplies` are ONE table now (0014).** A supply carries `cost_per_kg_minor`
  (nullable — null = not a printing material) and a free-text `type` (0015, searchable category
  backed by the `supply_type` vocabulary — NOT the old `kind` enum, which is dropped).
  `products.supply_id` is what costing and print-run deduction both read. There is no `materials`
  table and no `products.material_id` — don't reintroduce them. Re-pricing a supply re-costs every
  product printed from it (why `updateSupply` revalidates `/creative`).
- ⚠️ **"Is this a printing material?" has NO dedicated column** — the signal is
  `supplies.cost_per_kg_minor != null`. The supply form's checkbox just shows/clears the cost field;
  costing keys off the null-ness. Don't add an `is_printing` boolean — it would be a second source of
  truth that can disagree with the cost.
- ⚠️ **Adding a new `vocabularies.kind` needs BOTH a CHECK widen (migration) AND branches** in
  `refresh`/`renameVocabulary`/`countVocabularyUsage` (`actions/vocabulary.ts`). `supply_type` (0015)
  is the third kind after `product_type`/`client_tag`; it propagates to `supplies.type` on rename.
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
