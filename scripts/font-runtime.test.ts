import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const globals = readFileSync(new URL("app/globals.css", root), "utf8");
const page = readFileSync(new URL("app/page.tsx", root), "utf8");
const headers = readFileSync(new URL("public/_headers", root), "utf8");

const fontAssets = [
  ["zhouli-serif-ui-400.woff2", 100_000],
  ["zhouli-serif-ui-500.woff2", 100_000],
  ["zhouli-serif-ui-600.woff2", 100_000],
  ["zhouli-serif-full-400.woff2", 7_000_000],
  ["zhouli-serif-full-600.woff2", 7_000_000],
] as const;

test("self-hosts Source Han serif with deferred full dynamic coverage", () => {
  assert.match(globals, /font-family:\s*"Zhouli Serif UI"/);
  assert.match(globals, /font-family:\s*"Zhouli Serif Full"/);
  assert.match(globals, /font-display:\s*swap/);
  assert.match(globals, /font-synthesis:\s*none/);
  assert.match(globals, /--serif-dynamic:/);
  assert.match(globals, /\.result-content p\s*\{[\s\S]{0,260}var\(--serif-dynamic\)/);
  assert.match(globals, /\.input-panel textarea:placeholder-shown\s*\{[\s\S]{0,140}var\(--serif\)/);
  assert.match(headers, /\/fonts\/\*\s+Cache-Control: public,max-age=31536000,immutable/);

  for (const [name, minimumBytes] of fontAssets) {
    const file = new URL(`public/fonts/${name}`, root);
    assert.equal(existsSync(file), true, `${name} must be present`);
    assert.ok(statSync(file).size > minimumBytes, `${name} must contain font data`);
  }
});

test("card export uses the same runtime font instead of a system Songti fallback", () => {
  assert.doesNotMatch(page, /Songti SC|STSong|SimSun/);
  assert.match(page, /Zhouli Serif Full/);
  assert.match(page, /document\.fonts\.load\("400 39px \\\"Zhouli Serif Full\\\""\)/);
  assert.match(page, /document\.fonts\.load\("600 70px \\\"Zhouli Serif Full\\\""\)/);
});
