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

  let activeModel = AI_MODEL_NAME;

  // Retries with dynamic backoff for transient errors (up to 3 attempts total)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const isThinkingModel = activeModel.includes('2.5');
      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
      };

      // Thinking models don't support responseMimeType, but non-thinking models do
      if (jsonMode && !isThinkingModel) {
        generationConfig.responseMimeType = 'application/json';
      }

      const modelConfig = {
        model: activeModel,
        systemInstruction: systemPrompt,
        generationConfig,
      };

      // For thinking models, set a small thinking budget so output tokens go to actual content
      if (isThinkingModel) {
        modelConfig.generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const model = client.getGenerativeModel(modelConfig);
      const result = await model.generateContent(userContent);
      const response = result.response;

      // Extract text — try .text() first, then dig into candidates
      let text = '';
      try {
        text = response.text();
      } catch (e) {
        console.warn('DEBUG response.text() threw:', e.message);
      }
      console.log('DEBUG response candidates:', JSON.stringify(response.candidates));

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
      if (attempt < 2 && isTransient(err)) {
        const isQuota = (err.message || '').toLowerCase().includes('quota');
        // Fall back from gemini-2.5-flash to gemini-flash-latest if quota exceeded
        if (isQuota && activeModel === 'gemini-2.5-flash') {
          console.warn(`⚠️  Gemini 2.5 Flash quota exceeded. Automatically falling back to Gemini Flash Latest (Stable 1.5)...`);
          activeModel = 'gemini-flash-latest';
          continue;
        }

        const delayMs = getRetryDelayMs(err);
        console.warn(`⚠️  LLM transient error (attempt ${attempt + 1}/3), retrying in ${delayMs / 1000} s… (${err.message})`);
        await sleep(delayMs);
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
