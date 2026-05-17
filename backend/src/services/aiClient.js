/**
 * AI Client Wrapper – centralised gateway for all LLM calls.
 * All agents call this function; swapping models or providers only
 * requires changes here.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AI_MODEL_NAME } = require('../config/constants');

// ── Singleton client ─────────────────────────────────────────────────────────

let _genAI = null;

function getClient() {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        'GEMINI_API_KEY is not defined in .env — AI features are unavailable.'
      );
    }
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

// ── JSON extraction helper ───────────────────────────────────────────────────

/**
 * Extract and parse JSON from an LLM response that may contain:
 * - Pure JSON
 * - Markdown-fenced JSON (```json ... ```)
 * - Prose with embedded JSON object or array
 */
function extractJSON(raw) {
  let text = raw.trim();

  // Strategy 1: Direct parse
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // Strategy 2: Strip markdown fences
  if (text.includes('```')) {
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) {
      try { return JSON.parse(fenced[1].trim()); } catch { /* continue */ }
    }
  }

  // Strategy 3: Find the first top-level JSON object { ... } or array [ ... ]
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');

  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    if (firstBracket !== -1 && firstBracket < firstBrace && lastBracket > lastBrace) {
      start = firstBracket;
      end = lastBracket;
    } else {
      start = firstBrace;
      end = lastBrace;
    }
  } else if (firstBracket !== -1 && lastBracket > firstBracket) {
    start = firstBracket;
    end = lastBracket;
  }

  if (start !== -1 && end > start) {
    const candidate = text.substring(start, end + 1);
    try { return JSON.parse(candidate); } catch { /* continue */ }
  }

  throw new Error(
    `Failed to extract JSON from LLM response. First 200 chars: "${text.substring(0, 200)}"`
  );
}

// ── Grok xAI Client ─────────────────────────────────────────────────────────

/**
 * Direct HTTP caller for the xAI Grok API.
 * Uses native fetch (Node 18+) to ensure zero extra dependencies.
 */
async function callGrok({
  systemPrompt,
  userContent,
  jsonMode,
  temperature,
  maxTokens,
}) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    throw new Error('GROK_API_KEY is not defined in .env — Grok features are unavailable.');
  }

  const model = process.env.GROK_MODEL_NAME || 'grok-beta';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: temperature ?? 0.1,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.xai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Grok API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('Grok returned an empty response.');
  }

  return extractJSON(rawText);
}

// ── Groq Client ─────────────────────────────────────────────────────────────

/**
 * Direct HTTP caller for the Groq API.
 * Uses native fetch (Node 18+) to ensure zero extra dependencies.
 */
async function callGroq({
  systemPrompt,
  userContent,
  jsonMode,
  temperature,
  maxTokens,
  modelName,
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not defined in .env — Groq features are unavailable.');
  }

  const model = modelName || process.env.GROQ_MODEL_NAME || 'llama-3.3-70b-versatile';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: temperature ?? 0.1,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('Groq returned an empty response.');
  }

  return extractJSON(rawText);
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Call the configured LLM and return a parsed object.
 * Supporting multi-provider selection and automatic self-healing failover.
 *
 * @param {Object} opts
 * @param {string} opts.systemPrompt  – System-level instruction.
 * @param {string} opts.userContent   – User-supplied content (stringified JSON).
 * @param {boolean} [opts.jsonMode]   – Request JSON output from the model.
 * @param {number}  [opts.temperature=0.1]
 * @param {number}  [opts.maxTokens=4096]
 * @returns {Promise<Object>} Parsed JSON response from the model.
 */
async function callLLM({
  systemPrompt,
  userContent,
  jsonMode = true,
  temperature = 0.1,
  maxTokens = 8192,
} = {}) {
  const primaryProvider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  const tryGroqLarge = () => callGroq({ systemPrompt, userContent, jsonMode, temperature, maxTokens, modelName: 'llama-3.3-70b-versatile' });
  const tryGroqFast = () => callGroq({ systemPrompt, userContent, jsonMode, temperature, maxTokens, modelName: 'llama-3.1-8b-instant' });
  const tryGrok = () => callGrok({ systemPrompt, userContent, jsonMode, temperature, maxTokens });
  const tryGemini = async () => {
    const client = getClient();
    let activeModel = AI_MODEL_NAME;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const isThinkingModel = activeModel.includes('2.5');
        const generationConfig = {
          temperature,
          maxOutputTokens: maxTokens,
        };

        if (jsonMode && !isThinkingModel) {
          generationConfig.responseMimeType = 'application/json';
        }

        const modelConfig = {
          model: activeModel,
          systemInstruction: systemPrompt,
          generationConfig,
        };

        if (isThinkingModel) {
          modelConfig.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const model = client.getGenerativeModel(modelConfig);
        const result = await model.generateContent(userContent);
        const response = result.response;

        let text = '';
        try {
          text = response.text();
        } catch {}

        if (!text && response.candidates && response.candidates[0]) {
          const parts = response.candidates[0].content?.parts || [];
          for (const part of parts) {
            if (part.text) text = part.text;
          }
        }

        if (!text) {
          throw new Error('LLM returned an empty response — no text content found.');
        }

        return extractJSON(text);
      } catch (err) {
        const isQuota = (err.message || '').toLowerCase().includes('quota');
        if (attempt < 2 && isTransient(err)) {
          if (isQuota && activeModel === 'gemini-2.5-flash') {
            console.warn(`⚠️  Gemini 2.5 Flash quota exceeded. Automatically falling back to Gemini Flash Latest (Stable 1.5)...`);
            activeModel = 'gemini-flash-latest';
            continue;
          }

          const delayMs = getRetryDelayMs(err);
          console.warn(`⚠️  Gemini transient error (attempt ${attempt + 1}/3), retrying in ${delayMs / 1000} s… (${err.message})`);
          await sleep(delayMs);
          continue;
        }
        throw err;
      }
    }
  };

  const providers = [];
  if (primaryProvider === 'groq') {
    providers.push({ name: 'groq-large', fn: tryGroqLarge, available: !!process.env.GROQ_API_KEY });
    providers.push({ name: 'groq-fast', fn: tryGroqFast, available: !!process.env.GROQ_API_KEY });
    providers.push({ name: 'gemini', fn: tryGemini, available: !!process.env.GEMINI_API_KEY });
    providers.push({ name: 'grok', fn: tryGrok, available: !!process.env.GROK_API_KEY });
  } else if (primaryProvider === 'grok') {
    providers.push({ name: 'grok', fn: tryGrok, available: !!process.env.GROK_API_KEY });
    providers.push({ name: 'groq-large', fn: tryGroqLarge, available: !!process.env.GROQ_API_KEY });
    providers.push({ name: 'groq-fast', fn: tryGroqFast, available: !!process.env.GROQ_API_KEY });
    providers.push({ name: 'gemini', fn: tryGemini, available: !!process.env.GEMINI_API_KEY });
  } else {
    providers.push({ name: 'gemini', fn: tryGemini, available: !!process.env.GEMINI_API_KEY });
    providers.push({ name: 'groq-large', fn: tryGroqLarge, available: !!process.env.GROQ_API_KEY });
    providers.push({ name: 'groq-fast', fn: tryGroqFast, available: !!process.env.GROQ_API_KEY });
    providers.push({ name: 'grok', fn: tryGrok, available: !!process.env.GROK_API_KEY });
  }

  const activeProviders = providers.filter(p => p.available);
  let lastError = null;

  for (const p of activeProviders) {
    try {
      console.log(`[aiClient] Calling LLM via provider: ${p.name}`);
      const res = await p.fn();
      return res;
    } catch (err) {
      console.warn(`⚠️ [aiClient] Provider ${p.name} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('No LLM providers available or all failed.');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTransient(err) {
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('overloaded') ||
    msg.includes('deadline') ||
    msg.includes('timeout')
  );
}

function getRetryDelayMs(err) {
  const msg = err.message || '';
  const match = msg.match(/Please retry in ([\d.]+)s/i);
  if (match) {
    const sec = parseFloat(match[1]);
    if (!isNaN(sec) && sec > 0) {
      // Add a small buffer of 500ms to be safe
      return Math.min(30000, Math.ceil(sec * 1000) + 500);
    }
  }
  return 2000; // default 2s
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { callLLM };
