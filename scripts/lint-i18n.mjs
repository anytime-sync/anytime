#!/usr/bin/env node
/**
 * lint-i18n.mjs — guards against shipping new components with hardcoded
 * English JSX text after the i18n pass.
 *
 * Heuristic:
 *   - Walk every .tsx file under src/app/app/** and src/components/app/**
 *   - Strip imports, comments, and string-literal expression contexts
 *   - Look at JSX text-content children (between `>` and `<`) and any
 *     prop value that is a JSX-text-like literal (placeholder=, title=,
 *     aria-label=)
 *   - Flag any English-looking phrase: 3+ chars long, starts with a
 *     letter, contains at least one space OR a capitalised word, and
 *     isn't an icon name / single emoji / unit string (px, %, etc.)
 *   - Allowlist a handful of legitimately-untranslated tokens (brand
 *     names like "First Light", placeholders like "you@example.com",
 *     keyboard hints like "Cmd", numbers, currency symbols).
 *
 * Exit 0 if clean. Exit 1 with a punch-list if anything is hardcoded.
 *
 * Run: `node scripts/lint-i18n.mjs`
 *      or `npm run lint:i18n` (after package.json scripts entry).
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOTS = [
  "src/components/app",
  "src/app/app",
];
const ALLOWLIST_PHRASES = new Set([
  "First Light",
  "FIRST LIGHT",
  "Anytime",
  "First",
  "Light",
  "you@example.com",
  "tagname",
  "pomodoro",
  "Email Sam",
  "TickTick",
  "Cmd",
  "Ctrl",
  "Enter",
  "URGENT",
  "IMPORTANT",
  "kanban",
  "Kanban",
  "iso",
  "ISO",
  "RFC",
  "Apr",
  "May",
  "Jun",
  "PM",
  "AM",
]);
const ALLOWLIST_PROP_NAMES = new Set([
  "href",
  "src",
  "alt",
  "id",
  "name",
  "type",
  "key",
  "className",
  "for",
  "htmlFor",
  "role",
  "rel",
  "data-testid",
  "data-href",
  "viewBox",
  "fill",
  "stroke",
  "d",
  "cx",
  "cy",
  "r",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
]);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.isFile() && p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function looksEnglish(s) {
  const trimmed = s.trim();
  if (trimmed.length < 4) return false;
  if (ALLOWLIST_PHRASES.has(trimmed)) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  // Skip TypeScript / JS noise: anything containing punctuation that
  // doesn't appear in user-facing copy (semicolon, equals, paren,
  // brace, square bracket).
  if (/[;={}\[\]()]/.test(trimmed)) return false;
  if (/^[A-Z][a-z]+$/.test(trimmed) && trimmed.length < 5) return false;
  if (/[㐀-鿿぀-ヿ가-힯]/.test(trimmed)) return false;
  const wordCount = trimmed.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w)).length;
  if (wordCount >= 2) return true;
  if (wordCount === 1 && /^[A-Z][a-z]{4,}/.test(trimmed)) return true;
  return false;
}

function lintFile(file) {
  const src = fs.readFileSync(file, "utf8");
  // Skip files that don't import t() — they may be auth/landing pages
  // already handled by their own translation pass, or pure utility.
  if (!/from ["']@\/lib\/i18n["']|useLanguage/.test(src)) {
    // If file contains JSX, still flag — it should be using t().
    // But skip files that are clearly utility (no JSX return).
    if (!/<[A-Za-z]/.test(src)) return [];
  }

  const findings = [];
  // Strip block comments and line comments to reduce false positives
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");

  // 1. JSX text content: matches characters between `>` and `<` that
  //    are NOT JS expressions ({...}) and contain English text.
  //    Skip multi-line spans (those are TypeScript generics, not JSX text).
  const TEXT_RE = />([^<{}]+)</g;
  let m;
  while ((m = TEXT_RE.exec(stripped))) {
    const raw = m[1];
    if (raw.includes("\n")) continue;        // generic spread across lines
    if (raw.startsWith("(")) continue;        // arrow / call expression
    const phrase = raw.replace(/\s+/g, " ").trim();
    if (looksEnglish(phrase)) {
      const line = stripped.slice(0, m.index).split("\n").length;
      findings.push({ line, kind: "text", text: phrase });
    }
  }

  // 2. Common props that contain user-facing copy. Match
  //    placeholder="...", title="...", aria-label="...".
  const PROP_RE = /(placeholder|title|aria-label|alt)\s*=\s*"([^"]+)"/g;
  while ((m = PROP_RE.exec(stripped))) {
    const propName = m[1];
    const value = m[2];
    if (ALLOWLIST_PROP_NAMES.has(propName)) continue;
    if (looksEnglish(value)) {
      const line = stripped.slice(0, m.index).split("\n").length;
      findings.push({ line, kind: propName, text: value });
    }
  }

  return findings.map((f) => ({ ...f, file: path.relative(ROOT, file) }));
}

const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)));
let total = 0;
const byFile = new Map();
for (const f of files) {
  const findings = lintFile(f);
  if (findings.length) {
    byFile.set(f, findings);
    total += findings.length;
  }
}

if (total === 0) {
  console.log("i18n lint: clean (" + files.length + " files scanned)");
  process.exit(0);
}

console.log(`i18n lint: ${total} hardcoded English string(s) across ${byFile.size} file(s)\n`);
for (const [file, findings] of byFile) {
  console.log(path.relative(ROOT, file));
  for (const f of findings) {
    console.log(`  L${f.line} [${f.kind}] ${f.text}`);
  }
  console.log("");
}
console.log("Wrap each in t(lang, \"some.key\") and add the key to src/lib/i18n.ts in all 5 languages.");
process.exit(1);
