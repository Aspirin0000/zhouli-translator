# Minimal Prompt A/B Redesign

## Goal

Create a new B prompt that behaves like variant A in tone, openings, structure,
length, and Zhouli-style humor while making a small improvement to semantic
fidelity and factual restraint. Change assignment from a persistent
browser-level bucket to an independent 50/50 choice for every generation.

This design supersedes the standalone `zhouli-v3` design. Variant A remains
`zhouli-v1`; the new B is identified as `zhouli-v4` so its analytics are not
mixed with historical `zhouli-v2` or `zhouli-v3` rows.

## Prompt Design

### Shared Structure

Variant B reuses A without replacing any of its established prompt builders:

- Ask derives its system prompt from `SYSTEM_PROMPT` with two localized text
  replacements and uses `buildUserPrompt` exactly as A does.
- Explain derives its system prompt from `PLAIN_SYSTEM_PROMPT` with one
  localized text replacement and uses `buildPlainPrompt` exactly as A does.
- B's user prompt is byte-for-byte equal to A's for the same input.
- B does not append a second instruction block or introduce a new prompt
  section. All unchanged system-prompt text remains byte-for-byte equal to A.
- Tone, level, examples, preferred `我听闻` opening frequency, paragraph
  structure, and length behavior remain controlled by A.

The B delta must not prescribe a fixed opening, exact sentence count, verbatim
source repetition, a reversible first sentence, or a separate response shape.
It must not introduce input-specific task contracts.

### Ask Delta

The ask delta changes only two existing A rules:

1. The fake-citation rule says explicit people, titles, or quotations are used
   only when reliable; uncertain material remains a generic old-time scene.
2. The semantic-reversibility rule clarifies that a metaphor stays a metaphor
   rather than becoming a source fact, and that a request must not turn into an
   answer or judgment.

### Explain Delta

The explain delta changes only the existing uncertain-allusion rule: fictional
or uncertain old stories are treated as stylistic packaging, and only claims
supported by the text are translated into plain language. It adds no required
first sentence or output template.

## Per-Generation Assignment

The Worker owns experiment assignment:

- When the experiment is enabled, every accepted generation request obtains a
  fresh random value and selects A or B at 50/50.
- Website and Bilibili Toy clients no longer generate, persist, or send an
  `experiment_bucket`.
- The Worker ignores any legacy client-provided bucket, preventing a public
  caller from pinning a variant.
- Retries are new generation requests and therefore receive a new independent
  assignment.
- When the experiment is disabled, every request uses A.

The response and D1 records continue to include `variant` and
`prompt_version`. No user identifier or cross-surface identity is introduced.

## Scope

In scope:

- Minimal B prompt delta for ask and explain.
- `zhouli-v4` configuration and documentation.
- Worker-owned per-generation random assignment.
- Removal of browser experiment persistence and request fields.
- Contract, regression, and live evaluation updates.

Out of scope:

- Model, temperature, token limits, UI, feedback events, D1 schema, rate limits,
  or API response shape changes.
- Retrieval, web search, or a second model call for fact checking.
- Deleting historical v2/v3 analytics rows.

## Verification

Automated contracts must prove:

- A prompt behavior is unchanged.
- B's user prompts equal A's for identical inputs.
- B's system prompts differ from A only at the three documented rule sentences
  and contain no appended experiment guidance block.
- B contains none of the retired hard structural rules.
- The browser has no experiment storage key or `experiment_bucket` payload.
- Each Worker request invokes assignment anew; deterministic injected random
  values cover both halves without probabilistic tests.
- Disabled experiments always select A.

Live evaluation reuses the existing representative ask and explain corpus. It
compares semantic errors, unsupported facts, opening category, paragraph count,
and output length. B should retain an A-like distribution rather than optimize
for a different template. Reports remain under ignored `test-runs/` and contain
no production secrets.

## Release Boundary

Implementation and evaluation happen locally first. After the comparison
results are reviewed and an explicit release instruction is given, production
uses a 50/50 per-generation split. Setting `AB_TEST_ENABLED=false` remains the
immediate rollback path to A-only operation.
