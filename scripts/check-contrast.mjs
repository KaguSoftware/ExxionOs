#!/usr/bin/env node
// Verify every colour token pair in globals.css against WCAG AA.
//
//   npm run contrast
//
// ⚠️ WHY THIS EXISTS. globals.css records a measured ratio in a comment beside
// each token, and those comments are the ONLY thing stopping the ramp from
// drifting. A comment cannot enforce itself: during the blue rebrand,
// `--brand-hover` was written from a probe against pure white (4.61:1) when the
// real `--brand-ink` is oklch(0.99 …) — worth ~0.13 — so the shipped value was
// actually 4.48:1, under the floor and invisible to review. This script reads
// the values BACK OUT of the file and measures them against the real
// neighbouring tokens, so that class of near-miss fails the build instead.
//
// Run it after ANY edit to the token block.

import { readFileSync } from "node:fs";

// --- OKLCH -> sRGB ---------------------------------------------------------

function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, c));
  };
  return [enc(R), enc(G), enc(B)];
}

const luminance = ([r, g, b]) => {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contrast = (c1, c2) => {
  const a = luminance(c1), b = luminance(c2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// --- read tokens back out of the stylesheet --------------------------------

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function grab(block, name) {
  const re = new RegExp("--" + name + ":\\s*oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)");
  const m = block.match(re);
  return m ? [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])] : null;
}

const root = css.slice(css.indexOf(":root {"), css.indexOf("/* --- DARK"));
const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'), css.indexOf("/* --- LIGHT"));
const lightBlock = css.slice(css.indexOf('[data-theme="light"]'), css.indexOf('The "system" case'));

// Theme blocks override :root; fall back to :root for anything not restated.
const D = (n) => grab(darkBlock, n) || grab(root, n);
const L = (n) => grab(lightBlock, n) || grab(root, n);

let failures = 0;
function check(label, fg, bg, min) {
  if (!fg || !bg) {
    console.log(`  MISSING  ${label} — token not found in globals.css`);
    failures++;
    return;
  }
  const ratio = contrast(oklchToRgb(...fg), oklchToRgb(...bg));
  const pass = ratio >= min;
  if (!pass) failures++;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}  ${label.padEnd(34)} ${ratio.toFixed(2)}:1  (min ${min})`
  );
}

/** Body text and icons: AA is 4.5:1. Focus rings are non-text: 3:1. */
function auditTheme(name, T) {
  console.log(`\n${name}`);
  const bg = T("bg"), surface = T("surface"), raised = T("raised");
  const brandInk = T("brand-ink");
  const dangerInk = T("danger-ink") || [0.99, 0.005, 22];

  // Text sitting ON a filled button.
  check("brand-ink on --brand", brandInk, T("brand"), 4.5);
  check("brand-ink on --brand-hover", brandInk, T("brand-hover"), 4.5);
  check("brand-ink on --brand-active", brandInk, T("brand-active"), 4.5);
  check("danger-ink on --danger-fill", dangerInk, T("danger-fill"), 4.5);

  // Brand/accent AS text, on each surface it can land on.
  check("--brand-text on --bg", T("brand-text"), bg, 4.5);
  check("--brand-text on --surface", T("brand-text"), surface, 4.5);
  check("--brand-text on --raised", T("brand-text"), raised, 4.5);
  check("--accent on --bg", T("accent"), bg, 4.5);
  check("--accent on --surface", T("accent"), surface, 4.5);

  // The text ramp, on every surface. --faint on --surface is the pair that
  // actually broke: hint text usually sits on a panel, not on the page.
  for (const [sName, s] of [["--bg", bg], ["--surface", surface], ["--raised", raised]]) {
    check(`--ink on ${sName}`, T("ink"), s, 4.5);
    check(`--muted on ${sName}`, T("muted"), s, 4.5);
    check(`--faint on ${sName}`, T("faint"), s, 4.5);
  }

  // Reserved state colours, as text.
  check("--success on --bg", T("success"), bg, 4.5);
  check("--warning on --bg", T("warning"), bg, 4.5);
  check("--danger on --bg", T("danger"), bg, 4.5);

  // Non-text: the focus ring only has to be perceivable.
  check("--focus vs --bg", T("focus"), bg, 3);
}

auditTheme("DARK", D);
auditTheme("LIGHT", L);

if (failures > 0) {
  console.log(`\n${failures} contrast failure(s). Fix the token, don't lower the bar.`);
  process.exit(1);
}
console.log("\nAll contrast pairs pass.");
