#!/usr/bin/env node
// Apply one migration to the linked Supabase project via the Management API.
//
//   npm run migrate supabase/migrations/0001_foundation.sql
//
// Why not `supabase db push`? It wants an interactive confirm, which a sandboxed
// shell cannot give it. This runs the SQL directly and returns immediately.
//
// ⚠️ TWO RULES, both learned the hard way on KaguOs:
//  1. A 201 is NOT proof the schema changed. Verify afterwards by querying
//     information_schema.columns / pg_indexes for the thing you just added.
//  2. Anything applied this way is invisible to the CLI's migration history, so
//     the next `db push` will try to run it again. Follow every apply with:
//       npx supabase migration repair --status applied <n> --linked

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const PROJECT_REF = "rzbvlpnfiuurgowxqjtc";

function readEnvLocal() {
  // .env.local must be strictly KEY=value — no spaces around `=`, no quotes.
  // Next's loader tolerates both, so a malformed line works in the app and
  // silently yields an empty token here. That exact bug cost KaguOs twice.
  const out = {};
  let raw;
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run migrate <path/to/migration.sql>");
  process.exit(1);
}

const env = readEnvLocal();
const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error(
    "SUPABASE_ACCESS_TOKEN not found.\n" +
      "Set it in .env.local as a bare KEY=value line (no spaces, no quotes)."
  );
  process.exit(1);
}

const query = readFileSync(file, "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  }
);

const body = await res.text();

if (!res.ok) {
  console.error(`✗ ${basename(file)} failed — HTTP ${res.status}`);
  console.error(body);
  process.exit(1);
}

console.log(`✓ ${basename(file)} applied (HTTP ${res.status})`);
if (body && body !== "[]") console.log(body);
console.log(
  "\nNow do both of these:\n" +
    "  1. Verify the schema really changed (information_schema / pg_indexes).\n" +
    `  2. npx supabase migration repair --status applied ${basename(file).slice(0, 4)} --linked`
);
