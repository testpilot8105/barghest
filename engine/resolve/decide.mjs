// The local model's say on the pairs the rules could not settle (scores 0.5 to 0.9). One call per pair, the
// full schema in `format`, validated with zod; a failed call leaves the pair at review rather than guessing.
import { decisionPrompt, SYSTEM_DECIDE } from '../extract/prompts.mjs';
import { decisionSchema, jsonSchemaOf } from '../extract/schemas.mjs';

export function createDecide(llm) {
  const format = jsonSchemaOf(decisionSchema);
  return async function decide(pairs) {
    const verdicts = [];
    for (const pair of pairs) {
      const r = await llm.chatJson({ system: SYSTEM_DECIDE, prompt: decisionPrompt(pair), schema: format, purpose: 'decide', passageId: pair.a.passageId ?? null });
      if (!r.ok) {
        verdicts.push(null);
        continue;
      }
      const v = decisionSchema.safeParse(r.data);
      verdicts.push(v.success ? v.data : null);
    }
    return verdicts;
  };
}
