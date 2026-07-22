#!/usr/bin/env node
/**
 * Seed realistic sample data across EVERY section, honouring the money
 * contracts. Run AFTER `npm run wipe` on an empty (but migrated) database.
 *
 *   node scripts/seed-data.mjs          # dry run — prints what it would create
 *   node scripts/seed-data.mjs --write  # actually insert
 *
 * ⚠️ THE CONTRACTS THIS SCRIPT RESPECTS (see HANDOFF.md):
 *  - `transactions` is the ONE source of truth for money. Equipment repairs,
 *    supply restocks, order payments and campaign costs each write a real
 *    transaction with source_type/source_id. We do the same here.
 *  - A product's cost is COMPUTED (grams × supply ₺/kg + hours × machine rate);
 *    creating a product writes NO transaction.
 *  - A SAMPLE writes NO transaction — the filament was expensed when bought.
 *  - Order revenue is the PAYMENT, never orders.total_minor. Deposits are
 *    partial; the balance is the remainder.
 *  - Filament stock is in GRAMS; its cost is per KG.
 *
 * Not exhaustive, just enough that every screen has something real to show.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(
  /\r?\n/
)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const WRITE = process.argv.includes("--write");
const log = (...a) => console.log(...a);

// --- date helpers (past, so charts have history) ---------------------------
// Fixed anchor so the script is deterministic; adjust if you re-run much later.
function daysAgo(n) {
  const d = new Date("2026-07-22T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthsAgo(n) {
  const d = new Date("2026-07-22T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

const L = (major) => Math.round(major * 100); // lira → kuruş

async function insert(table, rows, select = "id") {
  const arr = Array.isArray(rows) ? rows : [rows];
  if (!WRITE) {
    log(`  [dry] ${table} +${arr.length}`);
    // Fake ids so downstream references have something in dry mode.
    return arr.map((_, i) => ({ id: `dry-${table}-${i}` }));
  }
  const { data, error } = await db.from(table).insert(arr).select(select);
  if (error) {
    console.error(`  ✗ ${table}: ${error.message}`);
    process.exit(1);
  }
  log(`  ✓ ${table} +${data.length}`);
  return data;
}

async function main() {
  log(`\nSeeding ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  log(WRITE ? "MODE: WRITE\n" : "MODE: dry run (pass --write to insert)\n");

  // Look up the fixed rows migrations already created.
  const { data: cats } = await db.from("categories").select("id,name");
  const catId = (name) => cats.find((c) => c.name === name)?.id ?? null;
  const { data: profiles } = await db.from("profiles").select("id").order("created_at");
  const owner = profiles?.[0]?.id ?? null; // Parsa
  const { data: supplyTypes } = await db
    .from("vocabularies")
    .select("label")
    .eq("kind", "supply_type");
  const hasType = (label) =>
    supplyTypes?.some((v) => v.label === label) ? label : label;

  // Machine hour rate — costing needs it. ₺25/h.
  if (WRITE) {
    await db.from("app_settings").upsert({ id: 1, machine_hour_rate_minor: L(25) });
  }
  log("  ✓ app_settings machine rate ₺25/h");

  // ===========================================================================
  // EQUIPMENT — supplies (filament in grams + packaging), machines
  // ===========================================================================
  log("\nEquipment");
  const [plaBlack, plaWhite, resinGrey] = await insert("supplies", [
    { name: "PLA Black", type: hasType("Filament"), unit: "g", quantity: 1000,
      low_threshold: 300, cost_per_kg_minor: L(800), last_price_minor: L(800) },
    { name: "PLA White", type: hasType("Filament"), unit: "g", quantity: 250,
      low_threshold: 300, cost_per_kg_minor: L(800), last_price_minor: L(800) },
    { name: "Grey Resin", type: hasType("Filament"), unit: "g", quantity: 500,
      low_threshold: 200, cost_per_kg_minor: L(1400), last_price_minor: L(1400) },
  ]);
  const [smallBox, stickers] = await insert("supplies", [
    { name: "Small mailer box", type: hasType("Boxes"), unit: "pcs", quantity: 40,
      low_threshold: 15, cost_per_kg_minor: null, last_price_minor: L(4) },
    { name: "Logo stickers", type: hasType("Stickers"), unit: "pcs", quantity: 8,
      low_threshold: 20, cost_per_kg_minor: null, last_price_minor: L(1.5) },
  ]);

  const [printerA, printerB] = await insert("machines", [
    { name: "Bambu X1C", kind: "FDM", model: "X1 Carbon", status: "operational",
      location: "Studio", purchased_on: monthsAgo(14), notes: "Main workhorse." },
    { name: "Elegoo Saturn", kind: "Resin", model: "Saturn 3", status: "needs_attention",
      location: "Studio", purchased_on: monthsAgo(6) },
  ]);

  // A repair with a cost → writes a Maintenance expense (the contract).
  const repairTx = (await insert("transactions", {
    occurred_on: daysAgo(9), direction: "out", amount_minor: L(450),
    description: "Nozzle + belt replacement", category_id: catId("Maintenance"),
    source_type: "equipment", source_id: printerB.id, created_by: owner,
  }))[0];
  await insert("maintenance_logs", {
    machine_id: printerB.id, performed_on: daysAgo(9), kind: "repair",
    description: "Nozzle + belt replacement", cost_minor: L(450),
    transaction_id: repairTx.id, performed_by: owner,
  });

  // A supply restock → writes a Filament expense + bumps stock (already in qty).
  const restockTx = (await insert("transactions", {
    occurred_on: daysAgo(20), direction: "out", amount_minor: L(800),
    description: "PLA Black restock", category_id: catId("Filament"),
    source_type: "supply", source_id: plaBlack.id, created_by: owner,
  }))[0];
  await insert("supply_restocks", {
    supply_id: plaBlack.id, restocked_on: daysAgo(20), quantity: 1000,
    cost_minor: L(800), transaction_id: restockTx.id, created_by: owner,
  });

  // A maintenance reminder pointed at the resin printer.
  await insert("reminders", {
    owner_id: owner, body: "Replace Saturn FEP film", due_on: daysAgo(-5),
    source_type: "equipment", source_id: printerB.id,
  });

  // ===========================================================================
  // CREATIVE — collections → products, ideas, issues→learnings
  // ===========================================================================
  log("\nCreative");
  const [deskColl, giftColl] = await insert("collections", [
    { name: "Desk Series", description: "Minimal desk accessories.",
      status: "in_progress", started_on: monthsAgo(3), created_by: owner },
    { name: "Gift Line", description: "Small giftable prints.",
      status: "done", started_on: monthsAgo(5), created_by: owner },
  ]);

  const [penHolder, cableTray, keychain, coaster] = await insert("products", [
    { collection_id: deskColl.id, name: "Pen Holder", kind: "Holder",
      supply_id: plaBlack.id, grams: 85, print_hours: 3, price_minor: L(180) },
    { collection_id: deskColl.id, name: "Cable Tray", kind: "Tray",
      supply_id: plaWhite.id, grams: 120, print_hours: 4.5, price_minor: L(240) },
    { collection_id: giftColl.id, name: "Star Keychain", kind: "Keychain",
      supply_id: plaBlack.id, grams: 12, print_hours: 0.5, price_minor: L(60) },
    { collection_id: giftColl.id, name: "Hex Coaster", kind: "Coaster",
      supply_id: resinGrey.id, grams: 40, print_hours: 1.5, price_minor: L(90) },
  ]);

  await insert("ideas", [
    { title: "Modular shelf brackets", body: "Snap-fit, no screws.",
      status: "exploring", collection_id: deskColl.id, created_by: owner },
    { title: "Seasonal ornament set", status: "new", created_by: owner },
  ]);

  await insert("issues", [
    { title: "Keychain ring hole too tight", body: "Ring won't fit after print.",
      collection_id: giftColl.id, product_id: keychain.id, severity: "medium",
      resolution: "Widened hole to 4.2mm in the model.", resolved_at: daysAgo(30),
      created_by: owner },
    { title: "Resin coaster warps on thin edge", body: "Edges curl during cure.",
      collection_id: giftColl.id, product_id: coaster.id, severity: "high",
      created_by: owner },
    { title: "Studio humidity spikes", body: "General workshop note, no collection.",
      severity: "low", created_by: owner },
  ]);

  // Print runs → deduct grams. Stock ledger movements (product on-hand).
  // Pen holder: printed 4 good units from PLA Black (85g each = 340g).
  await insert("print_runs", {
    product_id: penHolder.id, printed_on: daysAgo(12), units: 4, outcome: "good",
    grams_used: 340, supply_id: plaBlack.id, created_by: owner,
  });
  await insert("product_stock_movements", {
    product_id: penHolder.id, delta: 4, reason: "print_run",
    source_id: penHolder.id, apply_seq: 0, note: "Print run", created_by: owner,
  });
  // Keychain: printed 10 good units.
  await insert("print_runs", {
    product_id: keychain.id, printed_on: daysAgo(8), units: 10, outcome: "good",
    grams_used: 120, supply_id: plaBlack.id, created_by: owner,
  });
  await insert("product_stock_movements", {
    product_id: keychain.id, delta: 10, reason: "print_run",
    source_id: keychain.id, apply_seq: 0, created_by: owner,
  });

  // ===========================================================================
  // CLIENTS — directory + a timeline event
  // ===========================================================================
  log("\nClients");
  const [ayse, mehmet, studio] = await insert("clients", [
    { name: "Ayşe Demir", email: "ayse@example.com", city: "Istanbul",
      kind: "individual", source: "instagram", tags: ["gift", "repeat"] },
    { name: "Mehmet Kaya", phone: "+90 555 0100", city: "Ankara",
      kind: "individual", source: "referral", tags: ["desk"] },
    { name: "Studio Nord", email: "hello@studionord.example", city: "Izmir",
      kind: "business", source: "market", tags: ["wholesale"] },
  ]);

  await insert("events", {
    kind: "meeting", title: "Wholesale intro call", body: "Discussed a 20-unit order.",
    occurred_on: daysAgo(15), client_id: studio.id, created_by: owner,
  });

  // ===========================================================================
  // SHIPPING — orders with staged history + payments (deposits!)
  // ===========================================================================
  log("\nShipping");
  // Order 1: DELIVERED, ₺360 total, deposit ₺150 + balance ₺210 → ₺360 income.
  const order1 = (await insert("orders", {
    code: "EX-001", client_id: ayse.id, stage: "delivered",
    title: "Desk set for Ayşe", total_minor: L(360), promised_on: daysAgo(5),
    created_by: owner,
  }))[0];
  await insert("order_lines", [
    { order_id: order1.id, product_id: penHolder.id, description: "Pen Holder",
      quantity: 1, unit_price_minor: L(180), sort_order: 0 },
    { order_id: order1.id, product_id: cableTray.id, description: "Cable Tray",
      quantity: 1, unit_price_minor: L(180), sort_order: 1 },
  ]);
  // Stage history (append-only): enquiry → ... → delivered.
  const stages1 = ["enquiry", "quoted", "printing", "packed", "shipped", "delivered"];
  await insert(
    "order_stage_events",
    stages1.map((stage, i) => ({
      order_id: order1.id, stage, entered_at: `${daysAgo(20 - i * 3)}T10:00:00Z`,
      created_by: owner,
    }))
  );
  // Deposit ₺150 (a real income transaction), then balance ₺210.
  const depTx = (await insert("transactions", {
    occurred_on: daysAgo(18), direction: "in", amount_minor: L(150),
    description: "Deposit — EX-001", category_id: catId("Sales"),
    source_type: "order", source_id: order1.id, created_by: owner,
  }))[0];
  await insert("order_payments", {
    order_id: order1.id, paid_on: daysAgo(18), amount_minor: L(150),
    kind: "deposit", transaction_id: depTx.id, created_by: owner,
  });
  const balTx = (await insert("transactions", {
    occurred_on: daysAgo(5), direction: "in", amount_minor: L(210),
    description: "Balance — EX-001", category_id: catId("Sales"),
    source_type: "order", source_id: order1.id, created_by: owner,
  }))[0];
  await insert("order_payments", {
    order_id: order1.id, paid_on: daysAgo(5), amount_minor: L(210),
    kind: "balance", transaction_id: balTx.id, created_by: owner,
  });
  // Order lines consumed product stock (delivered).
  await insert("product_stock_movements", [
    { product_id: penHolder.id, delta: -1, reason: "order", source_id: order1.id,
      apply_seq: 0, created_by: owner },
  ]);

  // Order 2: quoted only (no payment → ₺0 income, proves the contract).
  const order2 = (await insert("orders", {
    code: "EX-002", client_id: studio.id, stage: "quoted",
    title: "Wholesale keychains", total_minor: L(600), promised_on: daysAgo(-10),
    created_by: owner,
  }))[0];
  await insert("order_lines", {
    order_id: order2.id, product_id: keychain.id, description: "Star Keychain",
    quantity: 10, unit_price_minor: L(60), sort_order: 0,
  });
  await insert(
    "order_stage_events",
    ["enquiry", "quoted"].map((stage, i) => ({
      order_id: order2.id, stage, entered_at: `${daysAgo(4 - i)}T10:00:00Z`,
      created_by: owner,
    }))
  );

  // ===========================================================================
  // MARKETING — a campaign with budget vs actual, a free sample (no tx!)
  // ===========================================================================
  log("\nMarketing");
  const promo = (await insert("campaigns", {
    name: "Summer Instagram Push", channel: "instagram", status: "running",
    goal: "Grow followers + drive desk-series sales", budget_minor: L(1000),
    starts_on: daysAgo(25), ends_on: daysAgo(-5), created_by: owner,
  }))[0];
  // Two campaign costs → each writes a Marketing expense (the contract).
  for (const [label, amount, day] of [
    ["Sponsored post", 400, 22],
    ["Reel boost", 250, 10],
  ]) {
    const tx = (await insert("transactions", {
      occurred_on: daysAgo(day), direction: "out", amount_minor: L(amount),
      description: `${label} — Summer Push`, category_id: catId("Marketing"),
      source_type: "marketing", source_id: promo.id, created_by: owner,
    }))[0];
    await insert("campaign_costs", {
      campaign_id: promo.id, label, amount_minor: L(amount), spent_on: daysAgo(day),
      transaction_id: tx.id, created_by: owner,
    });
  }
  // A free sample → NO transaction. Costed at read time from the product.
  await insert("samples", {
    product_id: keychain.id, description: "Keychain giveaway", client_id: ayse.id,
    campaign_id: promo.id, recipient: "Ayşe", quantity: 2, given_on: daysAgo(14),
    created_by: owner,
  });
  await insert("product_stock_movements", {
    product_id: keychain.id, delta: -2, reason: "sample", source_id: keychain.id,
    apply_seq: 0, note: "Giveaway", created_by: owner,
  });
  // A filming day — the events lens over the shared table.
  await insert("events", {
    kind: "filming", title: "Reel shoot — desk series", occurred_on: daysAgo(-3),
    created_by: owner,
  });

  // ===========================================================================
  // FINANCE — a couple of standalone rows + a recurring template
  // ===========================================================================
  log("\nFinance");
  await insert("transactions", [
    { occurred_on: daysAgo(28), direction: "out", amount_minor: L(120),
      description: "Mailer boxes + tape", category_id: catId("Packaging"),
      created_by: owner },
    { occurred_on: monthsAgo(1), direction: "in", amount_minor: L(300),
      description: "Market stall sales", category_id: catId("Sales"),
      created_by: owner },
  ]);
  await insert("recurring_items", {
    label: "Studio rent", direction: "out", amount_minor: L(3500),
    category_id: catId("Rent"), cadence: "monthly", day_of_month: 1,
    starts_on: monthsAgo(3), active: true,
  });

  log("\nDone.\n");
  if (!WRITE) log("Dry run only — re-run with --write to insert.\n");
}

main();
