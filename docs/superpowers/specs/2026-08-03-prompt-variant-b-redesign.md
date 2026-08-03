# Prompt Variant B Redesign

## Goal

Replace the retired `zhouli-v2` implementation with an independently designed
`zhouli-v3` prompt pair for both directions. Variant A (`zhouli-v1`) remains
unchanged, the production experiment remains disabled, and no deployment occurs
before manual review of the test results.

## Findings

The old B prompt inherited A's long instruction set and then added conflicting
hard constraints. In particular, questions were forced into exactly two
sentences with a verbatim source ending, while short memes were required to be
copied literally. This reduced natural rewriting, weakened the Zhouli style,
and still did not prevent invented facts or motives.

The production experiment ran briefly and produced 177 B generations. That is
not enough feedback coverage to establish quality. Existing consented cases and
regression corpora show the recurring risks are semantic drift, literal
explanation of nonsense memes, answering a request instead of rewriting it,
invented context, and unnatural plain-language output.

## Design

### Variant Identity

- Delete the old `zhouli-v2` prompt implementation from the codebase.
- Keep historical D1 rows labeled `zhouli-v2` for audit integrity.
- Identify the replacement B prompt as `zhouli-v3`.
- Keep `AB_TEST_ENABLED=false` throughout implementation and review.

### Ask Direction

Variant B uses a standalone compact system prompt instead of extending A.
Its priority order is:

1. Preserve meaning and speech act.
2. Produce recognizable, readable Zhouli-style humor.
3. Apply the selected tone.
4. Observe the selected length.

The prompt preserves speaker, audience, objects, proper nouns, numbers, time,
conditions, uncertainty, and sentiment. Questions remain questions, requests
for wording remain requests for wording, and quotations retain their target
relationship. A short meme keeps its semantic anchor but is not treated as a
claim requiring literal world-building. The output uses one principal analogy
or role-based argument and one payoff rather than several repetitive stories.
It must not invent sources, motives, relationships, experiences, or facts.

Dynamic instructions may identify a quoted rewrite target, question, first
person, or short meme. They may preserve semantic anchors, but they must not
force exact sentence counts or verbatim copying of the whole source.

### Explain Direction

Variant B uses a separate standalone compact system prompt. It starts directly
with natural modern meaning and preserves speaker, object relationships, speech
act, sentiment, and uncertainty. It distinguishes asking for a reply from
already replying. Nonsense memes are explained by their conversational function
rather than by inventing a literal interpretation. Subtext and roast modes may
infer only what the source supports and must signal uncertainty when needed.
Single characters and short fixed phrases receive concise answers.

### Prompt Assembly

`getPromptSet` continues to expose the same return shape. Variant A continues to
use `SYSTEM_PROMPT`, `PLAIN_SYSTEM_PROMPT`, `buildUserPrompt`, and
`buildPlainPrompt`. Variant B receives standalone system and user builders for
each direction while reusing the existing tone and level definitions. Explicit
quoted-target extraction remains available only as semantic preprocessing.

No model, temperature, token limit, endpoint, UI, analytics event, or API wire
shape changes as part of this redesign.

## Test Strategy

1. Add prompt-contract tests before changing production prompt code. The tests
   require independent B prompts, removal of the old hard-copy/two-sentence
   rules, direction-specific rules, and the `zhouli-v3` version.
2. Run the complete repository test, typecheck, and build suites.
3. Run live A/B generation against the same DeepSeek model and parameters:
   - 36 ask cases across short text, memes, questions, wording requests, first
     person, complex relationships, long practical text, safety, and injection.
   - 24 fixed explain cases across all four explain modes.
   - 24 B ask-to-explain round trips.
   - 12 high-risk cases repeated to detect instability.
4. Score deterministic invariants, perform blinded rubric comparison, and
   manually inspect high-risk cases. No pass rate may be improved by duplicating
   easy samples or weakening the corpus.
5. Save full generated reports under ignored `test-runs/`. Present representative
   side-by-side outputs and aggregate results before any commit of implementation,
   experiment activation, or deployment.

## Acceptance Criteria

- A is byte-for-byte unchanged in prompt behavior.
- B no longer contains the old exact-copy or exactly-two-sentence rules.
- Ask outputs preserve the original speech act, people, objects, polarity, and
  named anchors without adding unsupported facts.
- Explain outputs are direct and conversational without losing the original
  speaker or turning requests into answers.
- B wins or ties A on semantic fidelity and naturalness in the blinded review,
  while retaining recognizable Zhouli style.
- Security regression tests continue to pass.
- Production remains on A until the user reviews the generated examples.

## Non-Goals

- Deleting historical analytics rows.
- Changing the model or generation parameters.
- Deploying the redesigned prompt.
- Changing website or Toy UI.
- Building a two-call semantic extraction pipeline.
