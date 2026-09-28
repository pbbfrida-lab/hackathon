// Google AI Studio (Gemini) — endpoint resmi generativelanguage.googleapis.com.
// Format request/response Gemini berbeda dari OpenAI, jadi konversi dilakukan di file ini:
//   messages(system|user|assistant|tool) <-> contents + systemInstruction + functionResponse
//   tools OpenAI (type/function) <-> functionDeclarations
//   tool_calls <-> parts[].functionCall
const { postJson } = require('../http');
const config = require('../../config');

function toGeminiContents(messages) {
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'tool') {
      // Hasil tool masuk kembali sebagai functionResponse; nama fungsi dibawa lewat name.
      let payload = {};
      try { payload = JSON.parse(msg.content || '{}'); } catch { payload = { raw: msg.content }; }
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: msg.name || 'tool', response: wrapForGemini(payload) } }],
      });
      continue;
    }
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length) {
      const parts = msg.toolCalls.map((c) => ({ functionCall: { name: c.name, args: c.args || {} } }));
      if (msg.content) parts.unshift({ text: msg.content });
      contents.push({ role: 'model', parts });
      continue;
    }
    const role = msg.role === 'assistant' ? 'model' : 'user';
    contents.push({ role, parts: [{ text: String(msg.content == null ? '' : msg.content) }] });
  }
  return contents;
}

// Gemini menolak objek nilai sembarang sebagai "response" functionResponse; bungkus ke dalam {result}.
function wrapForGemini(payload) {
  if (payload === null || payload === undefined) return { result: null };
  if (typeof payload !== 'object') return { result: payload };
  return payload;
}

function toFunctionDeclarations(tools) {
  const declarations = (tools || [])
    .map((t) => {
      const fn = t.function || t;
      if (!fn || !fn.name) return null;
      return {
        name: String(fn.name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
        description: fn.description || '',
        parameters: sanitizeSchema(fn.parameters || { type: 'object', properties: {} }),
      };
    })
    .filter(Boolean);
  return declarations.length ? [{ functionDeclarations: declarations }] : undefined;
}

// Gemini menolak sebagian kata kunci JSON Schema (additionalProperties, $schema, exclusiveMinimum, ...).
function sanitizeSchema(schema) {
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith('$') || key === 'additionalProperties' || key === 'default' || key === 'examples') continue;
    out[key] = sanitizeSchema(value);
  }
  return out;
}

// Model Gemini "flash" terbaru memakai thinking token secara default: token thinking dipotong
// dari maxOutputTokens sehingga maxOutputTokens kecil bisa menghasilkan respons kosong.
// Untuk tugas sederhana (router, klasifikasi, pemilihan tool) thinking dimatikan lewat thinkingConfig.
const thinkingConfig = (enabled) => (enabled ? {} : { thinkingConfig: { thinkingBudget: 0 } });

const provider = {
  id: 'gemini',
  label: 'Google AI Studio (Gemini)',
  kind: 'gemini-native',
  keyHint: 'https://aistudio.google.com/apikey',

  isConfigured() {
    return Boolean(config.ai.gemini.apiKey);
  },

  async chat({ messages, tools, temperature = config.ai.temperature, maxTokens = config.ai.maxTokens, thinking = false }) {
    const { apiKey, baseUrl, model } = config.ai.gemini;
    if (!apiKey) {
      const err = new Error('Provider Gemini belum dikonfigurasi (GEMINI_API_KEY kosong).');
      err.retryable = false;
      throw err;
    }

    const systemParts = messages.filter((m) => m.role === 'system').map((m) => ({ text: m.content }));
    const body = {
      contents: toGeminiContents(messages.filter((m) => m.role !== 'system')),
      generationConfig: { temperature, maxOutputTokens: maxTokens, ...thinkingConfig(thinking) },
    };
    if (systemParts.length) body.systemInstruction = { parts: systemParts };
    const declarations = toFunctionDeclarations(tools);
    if (declarations) body.tools = declarations;

    const data = await postJson(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      provider: 'gemini',
      headers: { 'x-goog-api-key': apiKey },
      body,
    });

    const candidate = (data.candidates || [])[0];
    const parts = (candidate && candidate.content && candidate.content.parts) || [];
    const text = parts.filter((p) => p.text).map((p) => p.text).join('');
    const toolCalls = parts
      .filter((p) => p.functionCall)
      .map((p, i) => ({
        id: `call_${p.functionCall.name}_${i}_${Date.now()}`,
        name: p.functionCall.name,
        args: p.functionCall.args || {},
      }));

    if (!text && !toolCalls.length) {
      const reason = (data.promptFeedback && data.promptFeedback.blockReason) || (candidate && candidate.finishReason);
      const err = new Error(`Respons Gemini kosong${reason ? ` (${reason})` : ''}.`);
      err.retryable = reason !== 'SAFETY';
      throw err;
    }

    return {
      content: text,
      toolCalls,
      provider: 'gemini',
      model,
      usage: data.usageMetadata
        ? { prompt_tokens: data.usageMetadata.promptTokenCount, completion_tokens: data.usageMetadata.candidatesTokenCount }
        : null,
      finishReason: candidate && candidate.finishReason,
    };
  },

  async health() {
    if (!provider.isConfigured()) return { ok: false, detail: 'GEMINI_API_KEY belum diisi di .env' };
    const { apiKey, baseUrl, model } = config.ai.gemini;
    const data = await postJson(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      provider: 'gemini',
      timeoutMs: 20000,
      retries: 0,
      headers: { 'x-goog-api-key': apiKey },
      body: {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 32, ...thinkingConfig(false) },
      },
    });
    const got = (data.candidates || [])[0];
    return { ok: Boolean(got), detail: got ? `terhubung (model ${model})` : 'respons tidak berisi kandidat' };
  },
};

module.exports = provider;
