import assert from "node:assert/strict";
import test from "node:test";

import {
  assessGeneratedText,
  buildIncompleteRetryInstruction,
  getMinimumResultLength,
} from "../lib/generation-quality.ts";

test("short Zhouli inputs accept concise but complete results", () => {
  const minimum = getMinimumResultLength("to_zhouli", "饿", "standard");

  assert.equal(minimum, 12);
  assert.equal(
    assessGeneratedText("腹中既空，便先吃饭，礼数也要让人吃饱。", minimum),
    null,
  );
});

test("longer Zhouli inputs retain the existing completion floor", () => {
  assert.equal(
    getMinimumResultLength("to_zhouli", "老板说年轻人要多吃苦，我该怎样温言相劝", "standard"),
    40,
  );
  assert.equal(
    getMinimumResultLength("to_zhouli", "老板说年轻人要多吃苦", "light"),
    30,
  );
});

test("completion assessment distinguishes failure causes", () => {
  assert.equal(assessGeneratedText("", 12), "empty");
  assert.equal(assessGeneratedText("尚可。", 12), "too_short");
  assert.equal(
    assessGeneratedText("我听闻，此事当先辨明名分，再作定夺，", 12),
    "open_ending",
  );
  assert.equal(
    assessGeneratedText("我听闻", 3),
    "open_ending",
  );
  assert.equal(
    assessGeneratedText("此事已经说清，不必再添旁枝。", 12, "length"),
    "length",
  );
});

test("retry instruction asks for a fresh complete answer without changing the task", () => {
  const instruction = buildIncompleteRetryInstruction({
    reason: "too_short",
    direction: "to_zhouli",
    level: "light",
  });

  assert.match(instruction, /重新从头输出/);
  assert.match(instruction, /保留原意、对象、人称和语气/);
  assert.match(instruction, /80到150字/);
  assert.doesNotMatch(instruction, /继续续写/);
});
