// The local model, behind one door. Every call goes to Ollama on localhost, carries the full JSON schema in
// `format`, runs at temperature 0, and is logged to inference_log with model, prompt hash, latency and token counts:
// that log is the proof of real local inference. Nothing here runs until the owner has said so: the door is the
// BARGHEST_OLLAMA=on environment variable (the launcher sets it once the go is given).
import { createHash } from 'node:crypto';
import { Ollama } from 'ollama';

export const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
export const MODELS = {
  chat: process.env.BARGHEST_MODEL ?? 'qwen3:4b-instruct',
  embed: process.env.BARGHEST_EMBED_MODEL ?? 'nomic-embed-text',
};
// Thinking-capable tags (qwen3:4b) need think:false so the reply is the JSON and nothing else; the 2507 instruct
// tag has no thinking to turn off and rejects the flag.
const thinks = (model) => /^qwen3:(?!.*instruct)/.test(model) || /deepseek-r1|qwq/.test(model);

export function ollamaAllowed() {
  return process.env.BARGHEST_OLLAMA === 'on';
}

export class OllamaOff extends Error {
  constructor() {
    super('the local model is off: start Ollama and run the engine with BARGHEST_OLLAMA=on');
    this.status = 503;
  }
}

export function createLlm({ store, host = OLLAMA_HOST, models = MODELS } = {}) {
  const client = new Ollama({ host });
  const guard = () => {
    if (!ollamaAllowed()) throw new OllamaOff();
  };

  return {
    models,
    host,
    allowed: ollamaAllowed,

    async health() {
      if (!ollamaAllowed()) return null;
      try {
        const list = await client.list();
        const names = list.models.map((m) => m.name);
        return { up: true, host, models: names, chat: names.includes(models.chat) || names.includes(`${models.chat}:latest`), embed: names.some((n) => n.startsWith(models.embed)) };
      } catch (e) {
        return { up: false, host, models: [], error: e?.message ?? String(e) };
      }
    },

    /**
     * One structured call. `schema` is a JSON schema object; the reply is parsed JSON (not yet validated: the
     * caller runs zod). Property descriptions in the schema are ignored by Ollama, so the prompt repeats them.
     */
    async chatJson({ system, prompt, schema, purpose, documentId = null, passageId = null, numCtx = 8192, model = models.chat }) {
      guard();
      const messages = [];
      if (system) messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: prompt });
      const promptHash = createHash('sha256').update(JSON.stringify({ model, messages, schema })).digest('hex').slice(0, 16);
      const t0 = Date.now();
      let res;
      let ok = false;
      let data = null;
      let error = null;
      try {
        res = await client.chat({
          model,
          messages,
          format: schema,
          stream: false,
          options: { temperature: 0, num_ctx: numCtx },
          ...(thinks(model) ? { think: false } : {}),
        });
        const raw = String(res.message?.content ?? '').replace(/^<think>[\s\S]*?<\/think>\s*/, '').trim();
        data = JSON.parse(raw);
        ok = true;
      } catch (e) {
        error = e?.message ?? String(e);
      }
      const latencyMs = Date.now() - t0;
      store?.logInference({
        model,
        purpose,
        documentId,
        passageId,
        promptHash,
        latencyMs,
        promptTokens: res?.prompt_eval_count ?? null,
        outputTokens: res?.eval_count ?? null,
        ok,
      });
      return { ok, data, error, latencyMs, promptTokens: res?.prompt_eval_count ?? null, outputTokens: res?.eval_count ?? null, model, promptHash };
    },

    /** Embeddings for a batch of texts, one log row for the batch. */
    async embed(texts, { purpose = 'embed', documentId = null, model = models.embed } = {}) {
      guard();
      const t0 = Date.now();
      let ok = false;
      let vectors = [];
      let res;
      try {
        res = await client.embed({ model, input: texts, options: { num_ctx: 4096 } });
        vectors = res.embeddings;
        ok = true;
      } finally {
        store?.logInference({
          model,
          purpose,
          documentId,
          passageId: null,
          promptHash: createHash('sha256').update(texts.join('\n')).digest('hex').slice(0, 16),
          latencyMs: Date.now() - t0,
          promptTokens: res?.prompt_eval_count ?? null,
          outputTokens: null,
          ok,
        });
      }
      return vectors;
    },
  };
}
