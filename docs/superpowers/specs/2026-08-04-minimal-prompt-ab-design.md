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

- Ask uses `SYSTEM_PROMPT` and `buildUserPrompt` exactly as A does.
- Explain uses `PLAIN_SYSTEM_PROMPT` and `buildPlainPrompt` exactly as A does.
- B's user prompt is byte-for-byte equal to A's for the same input.
- B's system prompt starts with the complete A system prompt and appends one
  short direction-specific guidance block.
- Tone, level, examples, preferred `我听闻` opening frequency, paragraph
  structure, and length behavior remain controlled by A.

The B delta must not prescribe a fixed opening, exact sentence count, verbatim
source repetition, a reversible first sentence, or a separate response shape.
It must not introduce input-specific task contracts.

### Ask Delta

The ask guidance softly prioritizes:

1. Preserve the original speaker, audience, object, tense, conditions,
   uncertainty, question or request, and sentiment before polishing the joke.
2. Prefer interpretations supported directly by the source and avoid adding
   motives, relationships, experiences, or real-world facts.
3. Keep A's established storytelling and Zhouli rhythm instead of restating the
   input as a mandatory first sentence.
4. Treat historical flavor as a factual-restraint problem rather than a request
   for more allusions: use only high-confidence common knowledge, never invent
   exact quotations, titles, events, or attribution, and fall back to A's
   generic old-time scene when uncertain.

### Explain Delta

The explain guidance softly prioritizes preserving person, target, speech act,
negation, conditions, and uncertainty. It discourages unsupported motives and
moral judgments while retaining A's existing mode, length, and conversational
style. It adds no required first sentence or output template.

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
- B's system prompts begin with A and add only a compact delta.
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

Implementation and evaluation happen locally first. Production remains A-only
until the comparison results are reviewed. Enabling the production 50/50 flag,
deploying Cloudflare, and publishing Git changes require a separate explicit
release instruction.
