// Integrasi Meta AI (Llama API, format OpenAI-compatible).
// Sesuaikan META_API_BASE_URL dan META_MODEL dengan dokumentasi resmi hackathon/Meta.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const PLACEHOLDER = 'masukkan_meta_ai_api_key_anda_di_sini';

function isConfigured() {
  const key = process.env.META_API_KEY;
  return Boolean(key && key !== PLACEHOLDER);
}

async function chatCompletion({ messages, tools, temperature = 0.3 }) {
  if (!isConfigured()) throw new Error('META_API_KEY belum diatur');
  const base = (process.env.META_API_BASE_URL || 'https://api.llama.com/compat/v1').replace(/\/$/, '');
  const body = {
    model: process.env.META_MODEL || 'Llama-4-Maverick-17B-128E-Instruct-FP8',
    messages,
    temperature,
  };
  if (tools && tools.length) { body.tools = tools; body.tool_choice = 'auto'; }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.META_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Meta AI API error ${res.status}: ${text.slice(0, 300)}`);
    err.statusCode = 502;
    throw err;
  }
  const data = await res.json();
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  if (!msg) throw new Error('Respons Meta AI tidak valid');
  return msg;
}

module.exports = { isConfigured, chatCompletion };
