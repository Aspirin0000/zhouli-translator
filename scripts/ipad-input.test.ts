import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);

test("keeps controlled textarea state in sync with iPad input events", () => {
  assert.match(pageSource, /function syncInputText\(value: string\)/);
  assert.match(
    pageSource,
    /onInput=\{\(event\)\s*=>\s*syncInputText\(event\.currentTarget\.value\)\}/,
  );
  assert.match(
    pageSource,
    /onCompositionEnd=\{\(event\)\s*=>\s*syncInputText\(event\.currentTarget\.value\)\}/,
  );
  assert.match(
    pageSource,
    /onChange=\{\(event\)\s*=>\s*syncInputText\(event\.currentTarget\.value\)\}/,
  );
});

test("character count remains derived from synchronized textarea state", () => {
  assert.match(pageSource, /\{text\.length\} \/ \{inputLimit\}/);
});
