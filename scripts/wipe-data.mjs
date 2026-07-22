#!/usr/bin/env node
/**
 * Wipe all BUSINESS data, keeping accounts and settings.
 *
 *   node scripts/wipe-data.mjs --dry        # count what would go (default)
 *   node scripts/wipe-data.mjs --confirm    # actually delete
 *   node scripts/wipe-data.mjs --confirm --keep-setup   # keep categories/rates
 *
 * ⚠️ WHY THIS SCRIPT EXISTS RATHER THAN "just delete the collections".
 * Three relationships in this schema DELIBERATELY SURVIVE their parent, because
 * the record outlives the link:
 *   - issues.collection_id / product_id  → set null (a lesson outlives the project)
 *   - maintenance_logs.transaction_id    → set null (the repair still happened)
 *   - transactions.source_id             → plain column (the money was spent)
 * So deleting collections does NOT clear issues, and deleting machines does NOT
 * clear their expenses. Every table has to be named explicitly, in FK order.
 *
 * NEVER touches: auth.users, profiles, app_settings (unless --all).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(
  /\r?\n/
)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const keepSetup = args.includes("--keep-setup");
const wipeSetupToo = args.includes("--all");

/**
 * Order matters: children before parents, so nothing is orphaned mid-run even
 * if the script is interrupted.
 */
const CONTENT = [
  // Marketing (phase 7), children first. ⚠️ `campaign_costs` must go before
  // `campaigns` (it cascades, but the explicit order keeps the count honest),
  // and BOTH must precede `transactions` below, which the costs point at.
  // `samples` points at products, clients and campaigns — all SET NULL, so
  // leaving it out would silently strand rows rather than error.
  "samples",
  "campaign_costs",
  "campaigns",
  // Clients (phase 6). `events` FIRST: it points at both `clients` and
  // `orders`, so it has to go before either. (Both links are SET NULL, so
  // leaving it would not error — it would silently leave a pile of orphaned
  // notes behind, which is exactly the surprise this explicit list exists to
  // prevent.)
  "events",
  // Shipping (phase 5) — before `transactions`, which its payments point at.
  // ⚠️ `clients` goes too: it holds customer data, so a "wipe the business
  // data" that left the customer list behind would be a nasty surprise.
  "order_payments",
  "order_stage_events",
  "order_lines",
  "orders",
  "clients",
  // Equipment (phase 4)
  "supply_restocks",
  "maintenance_logs",
  "supplies",
  "machines",
  // Creative (phase 3)
  "issue_images",
  "product_images",
  "product_files",
  "issues",
  "products",
  "ideas",
  "collections",
  // Finance (phase 2) — LAST, because equipment/creative rows point at it.
  "transactions",
  "recurring_items",
  // Foundation
  "reminders",
];

/** Configuration, not content. Wiped only with --all. */
// ⚠️ `supplies` is NOT here — it now holds real stock + the per-kg cost, so it
// is business data (in CONTENT above), not setup config.
const SETUP = ["categories"];

const targets = wipeSetupToo ? [...CONTENT, ...SETUP] : CONTENT;

console.log(`\nTarget: ${url}`);
console.log(confirm ? "MODE: DELETE" : "MODE: dry run (pass --confirm to delete)");
if (keepSetup && !wipeSetupToo) console.log("Keeping categories.");
console.log();

let total = 0;
const counts = [];
for (const table of targets) {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`  ? ${table.padEnd(20)} (${error.message})`);
    continue;
  }
  counts.push([table, count ?? 0]);
  total += count ?? 0;
  console.log(`  ${String(count ?? 0).padStart(6)}  ${table}`);
}

console.log(`\n  ${String(total).padStart(6)}  TOTAL ROWS`);

if (!confirm) {
  console.log("\nDry run — nothing deleted. Re-run with --confirm to delete.\n");
  process.exit(0);
}

if (total === 0) {
  console.log("\nNothing to delete.\n");
  process.exit(0);
}

// A typed confirmation, because this is irreversible and there is no undo.
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`\nType DELETE to remove all ${total} rows: `);
rl.close();

if (answer.trim() !== "DELETE") {
  console.log("Aborted.\n");
  process.exit(0);
}

console.log();
for (const [table] of counts) {
  // .neq on the PK matches every row; PostgREST refuses an unfiltered delete.
  const { error } = await db
    .from(table)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log(error ? `  ✗ ${table}: ${error.message}` : `  ✓ ${table} cleared`);
}

// Storage buckets hold files those rows pointed at; orphans are invisible but
// still billed, so clear them too.
for (const bucket of ["receipts", "creative"]) {
  const { data: files } = await db.storage.from(bucket).list("", { limit: 1000 });
  if (files?.length) {
    await db.storage.from(bucket).remove(files.map((f) => f.name));
    console.log(`  ✓ ${bucket} bucket cleared (${files.length} files)`);
  }
}

console.log("\nDone. Accounts, profiles and settings are untouched.\n");
