#!/usr/bin/env node
// Guard against the containing-block bug that clipped every full-screen
// overlay to its wrapper's height — the "form cuts off halfway down" report.
//
//   npm run overlays
//
// ⚠️ WHAT WENT WRONG, so nobody reintroduces it.
//
// Per the CSS positioning spec, an ancestor with a `transform` other than
// `none` becomes the CONTAINING BLOCK for `position: fixed` descendants. Those
// descendants then resolve `inset-0` against THAT BOX rather than the viewport.
//
// `fade-rise`, `pop-in` and `toast-in` all use `both` fill mode, so their final
// keyframe persists for the life of the element. Ending on `translateY(0)` —
// visually identical to `none`, and the obvious way to write it — left every
// animated page wrapper permanently transformed. Any overlay nested inside one
// (client edit, print run, every ConfirmDialog) was clipped to the wrapper's
// content height and cut off mid-form.
//
// The keyframes must therefore END AT `transform: none`. This checks the BUILT
// css, not the source, so a Tailwind/PostCSS rewrite cannot slip past it.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ⚠️ fileURLToPath, not `.pathname` — on Windows the latter yields
// "/C:/Users/..." with a leading slash that no fs call accepts.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Keyframes whose final state must release the containing block. */
const GUARDED = ["fade-rise", "pop-in", "toast-in"];

function findCss(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) findCss(full, out);
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

// Prefer the built output — that is what the browser actually loads, so a
// PostCSS/Tailwind rewrite cannot slip past this. Turbopack emits under
// `.next/dev/...` for dev and `.next/static/...` for a production build, so
// scan `.next` wholesale rather than guessing one layout.
let files = findCss(join(ROOT, ".next")).filter(
  // Font modules and vendor chunks have no keyframes of ours; skipping them
  // keeps the output readable and the scan quick.
  (f) => !f.includes("_internal_font_")
);
let source = `built CSS (${files.length} file${files.length === 1 ? "" : "s"} under .next)`;
if (files.length === 0) {
  files = [join(ROOT, "src", "app", "globals.css")];
  source = "source CSS (no build found — run `npm run build` for a stronger check)";
}

console.log(`Checking ${source}\n`);

let failures = 0;
let checked = 0;

for (const file of files) {
  let css;
  try {
    css = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const name of GUARDED) {
    // Match `@keyframes <name> { ... }` — non-greedy to the first closing brace
    // at depth 0. Minified output has no whitespace, so keep this tolerant.
    const re = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\}\\s*(?=@|\\.|#|\\*|$)`, "g");
    let match;
    while ((match = re.exec(css)) !== null) {
      checked++;
      const body = match[1];

      // The `to` / `100%` stop is the one that persists under `both`.
      const finalStop = /(?:\bto\b|100%)\s*\{([^}]*)\}/.exec(body);
      if (!finalStop) {
        console.log(`  FAIL  ${name}: no \`to\`/100% stop found in ${file}`);
        failures++;
        continue;
      }

      const decls = finalStop[1];
      const transform = /transform\s*:\s*([^;}]+)/.exec(decls);

      if (!transform) {
        // No transform in the final stop at all — nothing persists. Fine.
        console.log(`  PASS  ${name}: final stop sets no transform`);
        continue;
      }

      const value = transform[1].trim().toLowerCase();
      if (value === "none") {
        console.log(`  PASS  ${name}: ends at \`transform: none\``);
      } else {
        console.log(
          `  FAIL  ${name}: ends at \`transform: ${value}\` — this keeps the\n` +
            `        element a containing block, so any \`position: fixed\`\n` +
            `        descendant is clipped to it instead of the viewport.\n` +
            `        Use \`transform: none\` (visually identical).\n` +
            `        in ${file}`
        );
        failures++;
      }
    }
  }
}

if (checked === 0) {
  console.log("\nNo guarded keyframes found — did they get renamed?");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The stronger half: full-screen surfaces must PORTAL out of the page subtree.
// ---------------------------------------------------------------------------
// ⚠️ `transform: none` on the final keyframe is necessary but NOT sufficient.
// It only clears the transform on the LAST FRAME, and an overlay can be opened
// while the wrapper's entry animation is still running — measured in headless
// Chrome, the overlay was still clipped mid-animation. Escaping the subtree via
// createPortal is the half that cannot regress.
const PORTAL_REQUIRED = [
  "src/components/ui/create.tsx",
  "src/components/ui/confirm-dialog.tsx",
  "src/components/ui/toast.tsx",
];

console.log("\nFull-screen surfaces must portal to document.body:\n");

for (const rel of PORTAL_REQUIRED) {
  const full = join(ROOT, rel);
  let src;
  try {
    src = readFileSync(full, "utf8");
  } catch {
    console.log(`  FAIL  ${rel}: not found — was it moved?`);
    failures++;
    continue;
  }

  const portals = /createPortal\s*\(/.test(src) && /document\.body/.test(src);
  if (portals) {
    console.log(`  PASS  ${rel}: portals to document.body`);
  } else {
    console.log(
      `  FAIL  ${rel}: renders \`position: fixed\` in place.\n` +
        `        Any ancestor with a transform (every page wrapper uses\n` +
        `        animate-fade-rise) becomes its containing block, so it will\n` +
        `        be clipped to the page instead of covering the viewport.\n` +
        `        Wrap the return in createPortal(..., document.body).`
    );
    failures++;
  }
}

console.log(
  failures === 0
    ? `\nOK — ${checked} keyframes release the containing block, and every` +
        ` full-screen surface portals out of the page subtree.`
    : `\n${failures} problem(s) would clip fixed-position overlays.`
);
process.exit(failures === 0 ? 0 : 1);
