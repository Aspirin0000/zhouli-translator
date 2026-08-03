# Minimal Per-Generation Prompt A/B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `zhouli-v4` B prompt that is a compact semantic-accuracy extension of A and assign A/B independently at 50/50 for every generation request.

**Architecture:** Keep A's ask and explain builders as the single source of output style. B keeps the complete A user prompts and derives its system prompts through three localized sentence replacements, with no appended B section. Remove experiment state from both clients and let the shared Cloudflare Worker choose a fresh variant for each accepted request; keep production A-only until live comparisons are reviewed.

**Tech Stack:** Next.js 16 App Router, TypeScript, Node test runner, Cloudflare Workers/OpenNext, Cloudflare D1, DeepSeek API.

## Global Constraints

- Variant A remains `zhouli-v1` and its prompt behavior must not change.
- The new B is `zhouli-v4`; historical `zhouli-v2` and `zhouli-v3` rows remain distinct.
- B user prompts are byte-for-byte equal to A user prompts for identical input.
- B system prompts change only two existing ask-rule sentences and one existing explain-rule sentence.
- B adds no fixed opening, sentence count, verbatim repetition, reversible sentence, or dynamic task contract.
- Website and Bilibili Toy send no `experiment_bucket` and retain no experiment bucket in storage.
- Every enabled generation request is independently assigned at 50/50 by the Worker.
- Model, temperature, token limits, UI, feedback events, D1 schema, and API response shape remain unchanged.
- `AB_TEST_ENABLED` remains `false` during implementation and review.
- Evaluation artifacts remain under ignored `test-runs/` and no keys or user data enter Git.

---

### Task 1: Lock the Minimal B Prompt Contract

**Files:**
- Modify: `scripts/prompt-experiment.test.ts`
- Modify: `lib/prompt-variants.ts`

**Interfaces:**
- Consumes: `SYSTEM_PROMPT`, `PLAIN_SYSTEM_PROMPT`, `buildUserPrompt`, and `buildPlainPrompt` from `lib/prompt.ts`.
- Produces: unchanged `getPromptSet(...)` return shape with `variant`, `promptVersion`, `systemPrompt`, and `userPrompt`.

- [ ] **Step 1: Replace old B structural tests with failing minimal-delta tests**

Use an enabled test config with `promptVersionB: "zhouli-v4"`. For both directions, assert that B has exactly the same user prompt and only localized system-prompt differences:

```ts
const enabledConfig = {
  ...DEFAULT_ANALYTICS_CONFIG,
  abTestEnabled: true,
  abTestBPercent: 50,
  promptVersionB: "zhouli-v4",
};

test("variant B makes only localized edits inside A's ask prompt", () => {
  const input = {
    text: "老板说年轻人要多吃苦，我该怎样温言相劝",
    mode: "gentle" as const,
    level: "light" as const,
  };
  const a = getPromptSet("to_zhouli", "A", enabledConfig, input);
  const b = getPromptSet("to_zhouli", "B", enabledConfig, input);

  assert.equal(b.promptVersion, "zhouli-v4");
  assert.equal(b.userPrompt, a.userPrompt);
  assert.notEqual(b.systemPrompt, a.systemPrompt);
  assert.match(b.systemPrompt, /明确人物、篇名或引文/);
  assert.match(b.systemPrompt, /比喻仍只是类比/);
  assert.match(b.systemPrompt, /不能把请求变成回答或判断/);
});
```

Add the corresponding explain assertion and reject retired hard-rule phrases:

```ts
const forbidden = /可逆主句|总共只写两句|逐字输出|必须连续保留|原样保留|以原问句收尾/;
assert.doesNotMatch(b.systemPrompt, forbidden);
assert.doesNotMatch(b.userPrompt, forbidden);
```

- [ ] **Step 2: Run the prompt test and verify RED**

Run: `node --test scripts/prompt-experiment.test.ts`

Expected: FAIL because the current B uses `zhouli-v2`, custom user builders, exact-copy rules, and task contracts.

- [ ] **Step 3: Replace B with localized edits to A's existing rules**

In `lib/prompt-variants.ts`, remove `extractExplicitRewriteTarget`, `buildVariantBTaskContract`, `buildVariantBZhouliPrompt`, and their structural helpers. Derive B from A with exact replacements so the rest of each prompt remains unchanged:

```ts
const ZHOULI_VARIANT_B_SYSTEM_PROMPT = SYSTEM_PROMPT
  .replace(ASK_ALLUSION_RULE_A, ASK_ALLUSION_RULE_B)
  .replace(ASK_FIDELITY_RULE_A, ASK_FIDELITY_RULE_B);

const PLAIN_VARIANT_B_SYSTEM_PROMPT = PLAIN_SYSTEM_PROMPT.replace(
  PLAIN_ALLUSION_RULE_A,
  PLAIN_ALLUSION_RULE_B,
);
```

Assemble B with the same base user prompt as A:

```ts
const systemPrompt = isPlain ? PLAIN_SYSTEM_PROMPT : SYSTEM_PROMPT;
const userPrompt = isPlain
  ? buildPlainPrompt(sourceText, input.level, input.plainMode)
  : buildUserPrompt(sourceText, input.mode, input.level);

return {
  variant,
  promptVersion: variant === "B" ? config.promptVersionB : config.promptVersionA,
  systemPrompt: variant === "B"
    ? isPlain
      ? PLAIN_VARIANT_B_SYSTEM_PROMPT
      : ZHOULI_VARIANT_B_SYSTEM_PROMPT
    : systemPrompt,
  userPrompt,
};
```

- [ ] **Step 4: Run the focused prompt test and verify GREEN**

Run: `node --test scripts/prompt-experiment.test.ts`

Expected: all prompt experiment tests pass; A equality and forbidden-rule checks pass.

- [ ] **Step 5: Commit the prompt contract**

```bash
git add lib/prompt-variants.ts scripts/prompt-experiment.test.ts
git commit -m "feat: simplify prompt variant B"
```

---

### Task 2: Move Assignment to Every Worker Request

**Files:**
- Modify: `scripts/prompt-experiment.test.ts`
- Modify: `scripts/analytics-contract.test.ts`
- Modify: `lib/prompt-variants.ts`
- Modify: `app/api/translate/route.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `AnalyticsConfig` and `selectExperimentVariant(config, bucket)`.
- Produces: `selectRandomExperimentVariant(config, random?)` returning `"A" | "B"`; the public translate request no longer includes `experiment_bucket`.

- [ ] **Step 1: Add failing deterministic tests for fresh Worker assignment**

Add a helper contract that injects random values without probabilistic assertions:

```ts
test("each enabled assignment uses the current random draw", () => {
  assert.equal(selectRandomExperimentVariant(enabledConfig, () => 0.01), "B");
  assert.equal(selectRandomExperimentVariant(enabledConfig, () => 0.99), "A");
});

test("disabled assignment stays on A without drawing randomness", () => {
  let draws = 0;
  const variant = selectRandomExperimentVariant(
    DEFAULT_ANALYTICS_CONFIG,
    () => {
      draws += 1;
      return 0;
    },
  );
  assert.equal(variant, "A");
  assert.equal(draws, 0);
});
```

In `scripts/analytics-contract.test.ts`, read `app/page.tsx` and
`app/api/translate/route.ts`; assert the client contains neither
`zhouli-experiment-bucket` nor `experiment_bucket`, and the route calls
`selectRandomExperimentVariant(analyticsConfig)`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test scripts/prompt-experiment.test.ts scripts/analytics-contract.test.ts`

Expected: FAIL because the helper does not exist and the client still persists and sends a bucket.

- [ ] **Step 3: Implement a fresh assignment helper**

In `lib/prompt-variants.ts`:

```ts
export function selectRandomExperimentVariant(
  config: AnalyticsConfig,
  random: () => number = Math.random,
): PromptVariant {
  if (!config.abTestEnabled) return "A";
  const draw = random();
  const bucket = Math.min(99, Math.max(0, Math.floor(draw * 100)));
  return selectExperimentVariant(config, bucket);
}
```

The explicit clamping makes injected edge values deterministic; this is an
experiment assignment, not a security primitive.

- [ ] **Step 4: Remove browser bucket ownership**

In `app/page.tsx`:

- Remove `experiment_bucket?: number` from the request payload type.
- Delete `getExperimentBucket()` and its localStorage key.
- Remove `experiment_bucket: getExperimentBucket()` from `translate()`.
- Preserve privacy-notice and client-ID storage; they are unrelated.

- [ ] **Step 5: Make the Worker ignore legacy buckets**

In `app/api/translate/route.ts`:

- Remove `experiment_bucket` from the parsed body type.
- Remove `parseExperimentBucket` usage and import.
- Replace bucket parsing with:

```ts
const variant = selectRandomExperimentVariant(analyticsConfig);
```

Do not read a legacy request field. JavaScript JSON parsing may retain unknown
properties in `body`, but they have no effect.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test scripts/prompt-experiment.test.ts scripts/analytics-contract.test.ts`

Expected: all focused tests pass.

- [ ] **Step 7: Commit per-request assignment**

```bash
git add app/page.tsx app/api/translate/route.ts lib/prompt-variants.ts scripts/prompt-experiment.test.ts scripts/analytics-contract.test.ts
git commit -m "feat: randomize prompt variant per generation"
```

---

### Task 3: Version and Document the New Experiment

**Files:**
- Modify: `lib/analytics.ts`
- Modify: `wrangler.jsonc`
- Modify: `analytics/README.md`
- Modify: `scripts/analytics-contract.test.ts`

**Interfaces:**
- Produces: B prompt version `zhouli-v4`; production remains `AB_TEST_ENABLED=false` with `AB_TEST_B_PERCENT=50` ready for a later release.

- [ ] **Step 1: Add failing version and production-safety assertions**

Update the analytics contract to expect:

```ts
assert.equal(DEFAULT_ANALYTICS_CONFIG.promptVersionB, "zhouli-v4");
assert.equal(config.vars.AB_TEST_ENABLED, "false");
assert.equal(config.vars.AB_TEST_B_PERCENT, "50");
assert.equal(config.vars.PROMPT_VERSION_A, "zhouli-v1");
assert.equal(config.vars.PROMPT_VERSION_B, "zhouli-v4");
```

- [ ] **Step 2: Run the analytics contract and verify RED**

Run: `node --test scripts/analytics-contract.test.ts`

Expected: FAIL because the repository still names B `zhouli-v2`.

- [ ] **Step 3: Update configuration and operator documentation**

- Change `DEFAULT_ANALYTICS_CONFIG.promptVersionB` to `zhouli-v4`.
- Change `wrangler.jsonc` `PROMPT_VERSION_B` to `zhouli-v4` and keep
  `AB_TEST_ENABLED` as `false`.
- Update `analytics/README.md`: assignment is per generation at the Worker;
  clients cannot pin a bucket; v2/v3 rows are historical and must not be merged
  with v4.

- [ ] **Step 4: Run the analytics contract and verify GREEN**

Run: `node --test scripts/analytics-contract.test.ts`

Expected: all analytics contract tests pass.

- [ ] **Step 5: Commit version and documentation**

```bash
git add lib/analytics.ts wrangler.jsonc analytics/README.md scripts/analytics-contract.test.ts
git commit -m "docs: prepare prompt experiment v4"
```

---

### Task 4: Evaluate Style Similarity and Semantic Precision

**Files:**
- Create ignored: `test-runs/run-prompt-v4-eval.mjs`
- Create ignored: `test-runs/prompt-v4-results-<timestamp>.json`
- Create ignored: `test-runs/prompt-v4-results-<timestamp>.md`

**Interfaces:**
- Consumes: actual `getPromptSet` output and local `DEEPSEEK_API_KEY` without printing it.
- Produces: ignored side-by-side A/B report with aggregate semantic and structural metrics.

- [ ] **Step 1: Adapt the existing evaluator without copying production data**

Reuse the existing representative local corpus and official DeepSeek endpoint.
For each ask and explain case, generate A and B with the same model and generation
parameters. Record only test fixtures, outputs, token counts, errors, and judge
results. Never print or persist the API key.

Add structural measurements:

```js
function outputShape(text) {
  return {
    chars: [...text].length,
    paragraphs: text.trim().split(/\n\s*\n/u).filter(Boolean).length,
    opening: /^(?:我曾?听闻|我听说)/u.test(text.trim())
      ? "heard"
      : "direct",
    repeatsSource: text.includes(currentCase.text),
  };
}
```

The blind judge compares semantic fidelity, unsupported facts, naturalness, and
Zhouli style. It must not reward B merely for being shorter.

- [ ] **Step 2: Run the live evaluator**

Run: `node test-runs/run-prompt-v4-eval.mjs`

Expected: zero failed API requests; JSON and Markdown reports created under
ignored `test-runs/`.

- [ ] **Step 3: Review acceptance evidence**

Inspect every case where B loses, changes speaker or speech act, invents a named
quotation/event, or repeats the source verbatim. Compare median length,
paragraph distribution, and `heard` opening rate. Do not activate production if
B forms a visibly different template from A or introduces a new systematic
semantic failure.

- [ ] **Step 4: Confirm evaluation artifacts remain ignored**

Run: `git status --short --ignored test-runs`

Expected: evaluator and reports appear only with `!!`; no generated evaluation
file is staged or tracked.

---

### Task 5: Full Repository Verification

**Files:**
- Verify only; do not modify unrelated files.

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: a locally verified, A-only production configuration ready for user review.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run static and production builds**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: Next.js production build succeeds for `/`, `/privacy`, and the three
API routes.

- [ ] **Step 3: Build and dry-run the Cloudflare artifact**

Run: `npx opennextjs-cloudflare build`

Expected: `.open-next/worker.js` generated successfully.

Run: `npx wrangler deploy --dry-run`

Expected bindings include `AB_TEST_ENABLED ("false")`,
`AB_TEST_B_PERCENT ("50")`, `PROMPT_VERSION_A ("zhouli-v1")`, and
`PROMPT_VERSION_B ("zhouli-v4")`.

- [ ] **Step 4: Run security and diff checks**

Run: `npm run public:audit`

Expected: no obvious secrets in tracked text files.

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short --ignored`

Expected: only intended source/doc changes are tracked; `.env.local`, Toy
artifacts, build output, evaluator, and reports remain ignored.

- [ ] **Step 5: Present results without releasing**

Report representative A/B examples, aggregate blind wins, semantic failures,
opening/length/paragraph similarity, and all verification commands. State
explicitly that production remains A-only and no deployment or push occurred.
