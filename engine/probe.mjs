// P2 model probe (node engine/probe.mjs): one paragraph written from the spot report goes to the local model with
// the full JSON schema; the reply is validated with zod; latency and token counts are printed. Needs Ollama up with
// the chat model pulled. Nothing is written to the store.
import { createLlm, MODELS, ollamaAllowed } from './llm.mjs';
import { jsonSchemaOf, probeSchema } from './extract/schemas.mjs';
import { SYSTEM_EXTRACT } from './extract/prompts.mjs';

if (!ollamaAllowed()) {
  console.error('probe: the local model is off for this process (BARGHEST_OLLAMA=off).');
  process.exit(2);
}

const PARAGRAPH = `SPOT REPORT SR-SMPPO-2026-09-14-001. On or about 0842H of 14 September 2026, at San Isidro National High School, Barangay Mabini, City of San Mateo, a male student identified as Joaquin Dela Pena, 15 years old, Grade 9, allegedly fired a Glock 17 pistol at students and a teacher in the north corridor of the junior high building. Responding personnel of San Mateo City Police Station recovered the pistol at the scene. Investigator on case: PMSg R. Tolentino.`;

const llm = createLlm();
const health = await llm.health();
console.log('ollama:', JSON.stringify(health));
if (!health?.up) process.exit(1);
if (!health.chat) {
  console.error(`probe: model ${MODELS.chat} is not pulled. Pull it first (owner's go): ollama pull ${MODELS.chat}`);
  process.exit(1);
}

const schema = jsonSchemaOf(probeSchema);
const prompt = `Fields: persons[].name as written, role (student, teacher, police officer, investigator, suspect, victim, other), aliases. events[].summary (one line), kind, when (ISO 8601, Asia/Manila), where.

<<<PASSAGE
${PARAGRAPH}
PASSAGE>>>

List the persons and events the passage states, as JSON.`;

const r = await llm.chatJson({ system: SYSTEM_EXTRACT, prompt, schema, purpose: 'probe' });
console.log(`model ${r.model}  latency ${r.latencyMs} ms  prompt tokens ${r.promptTokens}  output tokens ${r.outputTokens}  ok ${r.ok}`);
if (!r.ok) {
  console.error('probe: the reply was not JSON:', r.error);
  process.exit(1);
}
console.log(JSON.stringify(r.data, null, 2));
const v = probeSchema.safeParse(r.data);
if (!v.success) {
  console.error('probe: zod rejected the reply:', v.error.issues);
  process.exit(1);
}
const person = v.data.persons.find((p) => /dela pena/i.test(p.name));
const event = v.data.events[0];
const ok = !!person && !!event;
console.log(ok ? `probe: OK. Person "${person.name}" (${person.role ?? 'no role'}), Event "${event.summary}" at ${event.when ?? 'no time'}` : 'probe: FAIL, expected a Person named Dela Pena and at least one Event');
process.exit(ok ? 0 : 1);
