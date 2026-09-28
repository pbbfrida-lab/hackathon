// Adapter untuk setiap provider yang berbicara "OpenAI-compatible" (Groq, Freebuff/Codebuff proxy,
// OpenRouter, llama.com, dan sejenisnya). Satu-satunya perbedaan antar provider adalah
// baseUrl, apiKey, dan nama model.
const { postJson } = require('../http');
const config = require('../../config');

/**
 * @param {object} opts
 * @param {string} opts.id             nama provider untuk log & status
 * @param {string} opts.label          nama yang tampil di /api/health
 * @param {string} opts.baseUrl
 * @param {() => string} opts.getKey
 * @param {() => string} opts.getModel
 * @param {boolean} [opts.requiresKey] true bila tanpa API key tidak mungkin dipakai
 * @param {string} [opts.keyHint]     -petunjuk cara mendapatkan key
 */
function createOpenAiCompatProvider({ id, label, baseUrl, getKey, getModel, requiresKey = true, keyHint = '' }) {
  const normalizeTools = (tools) => (tools && tools.length ? { tools, tool_choice: 'auto' } : {});

  return {
    id,
    label,
    keyHint,
    kind: 'openai-compatible',

    isConfigured() {
      return Boolean(getKey()) || !requiresKey;
    },

    async chat({ messages, tools, temperature = config.ai.temperature, maxTokens = config.ai.maxTokens }) {
      const apiKey = getKey();
      if (requiresKey && !apiKey) {
        const err = new Error(`Provider ${label} belum dikonfigurasi (API key kosong).`);
        err.provider = id;
        err.retryable = false;
        throw err;
      }
      const model = getModel();
      const data = await postJson(`${baseUrl}/chat/completions`, {
        provider: id,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        body: {
          model,
          messages: toOpenAiMessages(messages),
          temperature,
          max_tokens: maxTokens,
          ...normalizeTools(tools),
        },
      });

      const choice = (data.choices || [])[0];
      const msg = choice && choice.message;
      if (!msg) {
        const err = new Error(`Respons ${label} tidak memuat pilihan chat yang valid.`);
        err.retryable = true;
        throw err;
      }
      if (msg.refusal) return { content: String(msg.refusal), toolCalls: [], provider: id, model, usage: data.usage || null };

      return {
        content: msg.content == null ? '' : String(msg.content),
        toolCalls: (msg.tool_calls || []).map((c) => ({
          id: c.id || `call_${c.function && c.function.name}_${Date.now()}`,
          name: c.function && c.function.name,
          args: safeParse(c.function && c.function.arguments),
        })),
        provider: id,
        model,
        usage: data.usage || null,
        finishReason: choice.finish_reason || null,
      };
    },

    async health() {
      if (!this.isConfigured()) return { ok: false, detail: 'API key belum diisi di .env' };
      const apiKey = getKey();
      const data = await postJson(`${baseUrl}/chat/completions`, {
        provider: id,
        timeoutMs: 20000,
        retries: 0,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        body: { model: getModel(), messages: [{ role: 'user', content: 'ping' }], max_tokens: 5, temperature: 0.1 },
      });
      const model = data.model || getModel();
      return { ok: true, detail: `terhubung (model ${model})` };
    },
  };
}

function safeParse(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: String(raw).slice(0, 200) };
  }
}

// Bentuk pesan internal (lihat agent.js) -> bentuk OpenAI wire.
function toOpenAiMessages(messages) {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content == null ? '{}' : m.content };
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args || {}) },
        })),
      };
    }
    return { role: m.role, content: m.content == null ? '' : String(m.content) };
  });
}

module.exports = { createOpenAiCompatProvider, safeParse, toOpenAiMessages };
