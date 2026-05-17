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
 * - Prose with embedded JSON object
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

  // Strategy 3: Find the first top-level JSON object { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.substring(firstBrace, lastBrace + 1);
    try { return JSON.parse(candidate); } catch { /* continue */ }
  }

  throw new Error(
    `Failed to extract JSON from LLM response. First 200 chars: "${text.substring(0, 200)}"`
  );
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Call the configured LLM and return a parsed object.
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
  const client = getClient();

  // Detect if using a thinking model (2.5-flash, etc.)
  const isThinkingModel = AI_MODEL_NAME.includes('2.5');

  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens,
  };

  // Thinking models don't support responseMimeType, but non-thinking models do
  if (jsonMode && !isThinkingModel) {
    generationConfig.responseMimeType = 'application/json';
  }

  const modelConfig = {
    model: AI_MODEL_NAME,
    systemInstruction: systemPrompt,
    generationConfig,
  };

  // For thinking models, set a small thinking budget so output tokens go to actual content
  if (isThinkingModel) {
    modelConfig.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const model = client.getGenerativeModel(modelConfig);

  // One retry with 2 s backoff for transient errors
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent(userContent);
      const response = result.response;

      // Extract text — try .text() first, then dig into candidates
      let text = '';
      try {
        text = response.text();
      } catch {
        // Thinking models may not support .text() directly
      }

      if (!text && response.candidates && response.candidates[0]) {
        const parts = response.candidates[0].content?.parts || [];
        // For thinking models, take the last text part (thinking output comes first)
        for (const part of parts) {
          if (part.text) text = part.text;
        }
      }

      if (!text) {
        throw new Error('LLM returned an empty response — no text content found.');
      }

      return extractJSON(text);
    } catch (err) {
      if (attempt === 0 && isTransient(err)) {
        console.warn(`⚠️  LLM transient error, retrying in 2 s… (${err.message})`);
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTransient(err) {
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('overloaded') ||
    msg.includes('deadline') ||
    msg.includes('timeout')
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { callLLM };
