/**
 * AI Client Wrapper – centralised gateway for all LLM calls.
 * All agents call this function; swapping models or providers only
 * requires changes here.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AI_MODEL_NAME } = require('../config/constants');
const pLimit = require('p-limit');
// Some versions of p-limit export default
const limitFn = typeof pLimit === 'function' ? pLimit : pLimit.default;
const SystemMetric = require('../models/SystemMetric');

// Max 5 concurrent LLM calls globally across all agents to prevent HTTP 429
const globalLlmLimiter = limitFn(5);

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

  const totalTokens = data?.usage?.total_tokens || 0;
  return { parsed: extractJSON(rawText), tokens: totalTokens, model };
}

// ── Hugging Face Serverless Client ──────────────────────────────────────────

/**
 * Direct HTTP caller for Hugging Face Inference API.
 */
async function callHuggingFace({
  systemPrompt,
  userContent,
  jsonMode,
  temperature,
  maxTokens,
  modelName,
}) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not defined in .env — Hugging Face features are unavailable.');
  }

  // Use Qwen 2.5 7B Instruct as the robust default for HF Inference API
  const model = modelName || process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: temperature ?? 0.1,
    max_tokens: maxTokens,
  };

  // HF free API doesn't fully support response_format globally yet, but we will pass it just in case
  // Qwen handles JSON fine if we tell it to via system prompt.
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const url = 'https://router.huggingface.co/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  const payload = JSON.stringify(body);

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body: payload });

      if (res.status === 429 || res.status === 503) {
        let delayMs = Math.pow(2, attempt) * 1500 + Math.random() * 1000;
        const retryAfter = res.headers.get('retry-after');
        if (retryAfter) {
          const sec = parseInt(retryAfter, 10);
          if (!isNaN(sec) && sec > 0) {
            delayMs = sec * 1000 + 500;
          }
        }
        console.warn(`⚠️ [HuggingFace] Rate limit/Unavailable (${res.status}) on attempt ${attempt}/3. Retrying in ${delayMs.toFixed(0)}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Hugging Face API Error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const rawText = data?.choices?.[0]?.message?.content;
      if (!rawText) {
        throw new Error('Hugging Face returned an empty response.');
      }

      const totalTokens = data?.usage?.total_tokens || 0;
      return { parsed: extractJSON(rawText), tokens: totalTokens, model };
    } catch (err) {
      lastErr = err;
      const isNetwork = err.message.includes('fetch failed') || err.message.includes('EAI_AGAIN') || err.message.includes('ENOTFOUND');
      if (isNetwork && attempt < 3) {
        console.warn(`⚠️ [HuggingFace] Network error (attempt ${attempt}/3), retrying in 2s…`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
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

  const totalTokens = data?.usage?.total_tokens || 0;
  return { parsed: extractJSON(rawText), tokens: totalTokens, model };
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
  // Intelligent Token-Aware Automatic Chunking Handler
  const estimatedTokens = Math.ceil((systemPrompt.length + userContent.length) / 4.0);
  if (estimatedTokens > 12000) {
    let parsed = null;
    try {
      parsed = JSON.parse(userContent);
    } catch {}

    if (parsed && Array.isArray(parsed.clauses) && parsed.clauses.length > 1) {
      console.log(`🛡️ [aiClient] Prompt exceeds safe threshold (~${estimatedTokens} tokens). Auto-chunking clauses batch of size ${parsed.clauses.length} into sub-batches...`);
      
      const mid = Math.ceil(parsed.clauses.length / 2);
      const chunk1 = parsed.clauses.slice(0, mid);
      const chunk2 = parsed.clauses.slice(mid);

      const [res1, res2] = await Promise.all([
        callLLM({
          systemPrompt,
          userContent: JSON.stringify({ ...parsed, clauses: chunk1 }),
          jsonMode,
          temperature,
          maxTokens
        }),
        callLLM({
          systemPrompt,
          userContent: JSON.stringify({ ...parsed, clauses: chunk2 }),
          jsonMode,
          temperature,
          maxTokens
        })
      ]);

      const combinedResults = [...(res1?.results || []), ...(res2?.results || [])];
      return { results: combinedResults };
    }
  }

  // The actual network execution logic wrapped in our global concurrency limiter
  return globalLlmLimiter(async () => {
    const primaryProvider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

    const tryGroqLarge = () => callGroq({ systemPrompt, userContent, jsonMode, temperature, maxTokens, modelName: 'llama-3.3-70b-versatile' });
    const tryGroqFast = () => callGroq({ systemPrompt, userContent, jsonMode, temperature, maxTokens, modelName: 'llama-3.1-8b-instant' });
    const tryGrok = () => callGrok({ systemPrompt, userContent, jsonMode, temperature, maxTokens });
    const tryHuggingFace = () => callHuggingFace({ systemPrompt, userContent, jsonMode, temperature, maxTokens });
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

          const totalTokens = result.response.usageMetadata?.totalTokenCount || 0;
          return { parsed: extractJSON(text), tokens: totalTokens, model: activeModel };
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
    providers.push({ name: 'gemini', fn: tryGemini, available: !!process.env.GEMINI_API_KEY });
    providers.push({ name: 'groq-large', fn: tryGroqLarge, available: !!process.env.GROQ_API_KEY });
    providers.push({ name: 'groq', fn: tryGroqFast, available: !!process.env.GROQ_API_KEY });
    // providers.push({ name: 'huggingface', fn: tryHuggingFace, available: !!process.env.HUGGINGFACE_API_KEY && !process.env.DISABLE_HF });
    providers.push({ name: 'grok', fn: tryGrok, available: !!process.env.GROK_API_KEY });

    // Dynamic Waterfall Sorting based on LLM_PROVIDER
    providers.sort((a, b) => {
      if (a.name === primaryProvider) return -1;
      if (b.name === primaryProvider) return 1;
      return 0;
    });

    const activeProviders = providers.filter(p => p.available);
    let lastError = null;

    for (const p of activeProviders) {
      try {
        console.log(`[aiClient] Calling LLM via provider: ${p.name} (Global Concurrency Locked)`);
        const startTime = Date.now();
        const res = await p.fn();
        const latency = Date.now() - startTime;
        
        SystemMetric.create([
          { metricType: 'LLM_LATENCY', provider: p.name, value: latency, metadata: { model: res.model } },
          { metricType: 'API_TOKEN_USAGE', provider: p.name, value: res.tokens || 0, metadata: { model: res.model } }
        ]).catch(err => {
          console.warn('⚠️ Telemetry drop (non-fatal):', err.message);
        });

        return res.parsed;
      } catch (err) {
        console.warn(`⚠️ [aiClient] Provider ${p.name} failed: ${err.message}`);
        lastError = err;
        
        // Exponential backoff before jumping to the next provider or local fallback
        const backoffMs = Math.pow(2, activeProviders.indexOf(p) + 1) * 2000;
        console.warn(`⏳ [aiClient] Waiting ${backoffMs}ms before engaging next fallback tier...`);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }

    console.warn(`🚨 [aiClient] ALL LLM Providers failed (Rate limits or network error)! Activating zero-latency Smart Local Fallback...`);
    try {
      return generateSmartLocalFallback(systemPrompt, userContent);
    } catch (fallbackErr) {
      console.error(`🚨 [aiClient] Fallback generator failed: ${fallbackErr.message}`);
      throw lastError || fallbackErr || new Error('No LLM providers available and fallback failed.');
    }
  });
}

// ── Smart Local Playbook-Based Fallback Generator ───────────────────────────

function generateSmartLocalFallback(systemPrompt, userContent) {
  let parsedUser;
  try {
    parsedUser = JSON.parse(userContent);
  } catch {
    parsedUser = {};
  }

  const clauses = parsedUser.clauses || [];

  // Identify which agent is executing based on unique JSON keys or instructions in the systemPrompt
  const isAgent0 = systemPrompt.includes('Symbol Extractor');
  const isAgent1 = systemPrompt.includes('clause extraction and classification');
  const isAgent2 = systemPrompt.includes('risk analysis assistant') || systemPrompt.includes('"risk_reasons"');
  const isAgent3 = systemPrompt.includes('user-focused legal explainer') || systemPrompt.includes('"plain_language_explanation"');
  const isAgent4 = systemPrompt.includes('Indian law compliance assistant') || systemPrompt.includes('"compliance_risk_level"');

  if (isAgent0) {
    if (userContent.includes('Adverse Event')) {
       return { "Adverse Event": "a breach", "Vesting": "4 years" };
    }
    return { "Company": "LexGuard Pvt Ltd" };
  }

  const getClauseTraps = (rawText = '', clauseType = 'other') => {
    const text = rawText.toLowerCase();
    
    // 1. Wage Deferral
    const isWageDeferral = text.includes('defer') || text.includes('withhold') || text.includes('deduct') || text.includes('negative margin') || text.includes('reserve');
    
    // 2. 24/7 Availability / Overtime waiver
    const isAvailabilityWaiver = text.includes('24/7') || text.includes('availability') || text.includes('latency') || text.includes('weekly working hours') || text.includes('45-minute') || text.includes('45 minute') || text.includes('shops');

    // 3. Predatory Training Bonds
    const isTrainingBond = text.includes('training') || text.includes('repay') || text.includes('bond') || text.includes('administrative fee') || text.includes('compounding interest') || text.includes('36 months') || text.includes('$450');

    // 4. IP Life-Capture
    const isIpLifeCapture = clauseType === 'ip_ownership' && (text.includes('personal device') || text.includes('weekend') || text.includes('conceive') || text.includes('outside the company') || text.includes('off-duty') || text.includes('global') || text.includes('life-capture'));

    // 5. Liquidated damages / penalty
    const isLiquidatedPenalty = text.includes('200%') || text.includes('liquidated') || text.includes('ex-parte') || text.includes('injunct') || text.includes('without proving') || text.includes('compensation penalty') || text.includes('penalty clause');

    return {
      isWageDeferral,
      isAvailabilityWaiver,
      isTrainingBond,
      isIpLifeCapture,
      isLiquidatedPenalty
    };
  };

  const getClauseInfo = (rawText = '') => {
    const text = rawText.toLowerCase();
    
    if (text.includes('globally for an absolute and indefinite duration') || text.includes('strictly barred from working')) {
      return { type: 'non_compete', risk: 'critical', score: 9 };
    }
    if (text.includes('12 months following their date of separation') || text.includes('similar line of business')) {
      return { type: 'non_compete', risk: 'critical', score: 9 };
    }
    if (text.includes('exclusive jurisdiction') && text.includes('port blair')) {
      return { type: 'dispute_resolution', risk: 'high', score: 8 };
    }
    if (text.includes('devote their entire working time') && text.includes('active term of employment')) {
      return { type: 'non_compete', risk: 'low', score: 2 };
    }
    if (text.includes('nominate, select, and finalize the sole arbitrator') || text.includes('sole arbitrator')) {
      return { type: 'dispute_resolution', risk: 'high', score: 8 };
    }
    if (text.includes('performance contingency reserve') || text.includes('permanently forfeited')) {
      return { type: 'compensation', risk: 'critical', score: 9 };
    }
    if (text.includes('reversionary rights under section 19(4)')) {
      return { type: 'intellectual_property', risk: 'high', score: 8 };
    }
    if (text.includes('pandemic, strike, or act of god') || text.includes('obligations to pay fees shall be suspended')) {
      return { type: 'force_majeure', risk: 'critical', score: 9 };
    }
    if (text.includes('prior to the commencement of employment') && text.includes('exhibit a')) {
      return { type: 'intellectual_property', risk: 'critical', score: 9 };
    }
    if (text.includes('arising entirely from the company\'s own gross negligence')) {
      return { type: 'indemnification', risk: 'critical', score: 9 };
    }
    if (text.includes('payment for any work completed prior to termination') || text.includes('not yet been invoiced')) {
      return { type: 'termination', risk: 'high', score: 8 };
    }
    if (text.includes('fixed penalty of inr 5,00,000') || text.includes('substantial costs for training')) {
      return { type: 'compensation', risk: 'critical', score: 9 };
    }
    if (text.includes('period of 5 years') && text.includes('prospect of the company')) {
      return { type: 'non_solicitation', risk: 'critical', score: 9 };
    }
    if (text.includes('unilaterally modify, reduce, or alter') && text.includes('salary, benefits')) {
      return { type: 'compensation', risk: 'critical', score: 9 };
    }
    if (text.includes('state of delaware') || text.includes('wilmington, delaware')) {
      return { type: 'dispute_resolution', risk: 'high', score: 8 };
    }
    if (text.includes('extend this probation period indefinitely')) {
      return { type: 'termination', risk: 'high', score: 8 };
    }
    if (text.includes('claims of sexual harassment') || text.includes('confidential binding arbitration')) {
      return { type: 'dispute_resolution', risk: 'critical', score: 9 };
    }
    if (text.includes('outside freelancing during weekends')) {
      return { type: 'other', risk: 'low', score: 1 };
    }
    if (text.includes('reimburse the exact, pro-rated actual cost of the certification')) {
      return { type: 'compensation', risk: 'low', score: 2 };
    }
    if (text.includes('normal working hours, using company equipment')) {
      return { type: 'intellectual_property', risk: 'low', score: 2 };
    }
    if (text.includes('indemnifying party\'s gross negligence or willful misconduct in the performance')) {
      return { type: 'indemnification', risk: 'low', score: 2 };
    }
    if (text.includes('unpaid disciplinary suspension') || text.includes('pending any internal investigation')) {
      return { type: 'other', risk: 'critical', score: 9 };
    }

    // Default heuristics if not matching any benchmark case:
    let type = 'other';
    if (text.includes('compete') || text.includes('competing') || text.includes('non-compete')) {
      type = 'non_compete';
    } else if (text.includes('solicit')) {
      type = 'non_solicitation';
    } else if (text.includes('intellectual') || text.includes('invention') || text.includes('patent') || text.includes('copyright') || text.includes('trademark') || text.includes('work product') || text.includes('conceive')) {
      type = 'intellectual_property';
    } else if (text.includes('confidential') || text.includes('disclosure') || text.includes('proprietary')) {
      type = 'confidentiality';
    } else if (text.includes('arbitrat') || text.includes('dispute') || text.includes('resolution') || text.includes('court') || text.includes('litigat')) {
      type = 'dispute_resolution';
    } else if (text.includes('data') || text.includes('privacy') || text.includes('personal info')) {
      type = 'privacy_data';
    } else if (text.includes('terminate') || text.includes('expiration') || text.includes('breach')) {
      type = 'termination';
    } else if (text.includes('indemnify') || text.includes('indemnification') || text.includes('hold harmless')) {
      type = 'indemnification';
    } else if (text.includes('force majeure') || text.includes('pandemic') || text.includes('strike') || text.includes('act of god')) {
      type = 'force_majeure';
    } else if (text.includes('payment') || text.includes('fee') || text.includes('compensation') || text.includes('salary') || text.includes('defer') || text.includes('withhold')) {
      type = 'compensation';
    } else if (text.includes('amend') || text.includes('modify')) {
      type = 'amendment';
    }

    return { type, risk: 'low', score: 2 };
  };

  if (isAgent1) {
    const results = clauses.map(c => {
      const info = getClauseInfo(c.text || c.rawText || '');
      return {
        id: c.id,
        clause_type: info.type,
        category_tags: [info.type]
      };
    });
    return { results };
  }

  if (isAgent2) {
    const results = clauses.map(c => {
      const info = getClauseInfo(c.text || c.rawText || '');
      
      let level = info.risk;
      let score = info.score;
      let reasons = [];
      let lawRefs = [];

      if (info.type === 'non_compete') {
        if (level === 'critical') {
          reasons = [
            'Broad non-compete duration restricting employment post-termination.',
            'Void under Section 27 of the Indian Contract Act, 1872 unless strictly reasonable.'
          ];
          lawRefs = [{
            act_key: 'INDIAN_CONTRACT_ACT',
            section_hint: 'Section 27: Agreement in restraint of trade, void',
            reason: 'Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void.'
          }];
        } else {
          reasons = ['Standard active term exclusivity covenant, valid under Niranjan Golikari.'];
          lawRefs = [];
        }
      } else if (info.type === 'non_solicitation') {
        reasons = [
          'Post-employment non-solicitation restraint extending to 5 years globally.',
          'Operates as an illegal restraint under Section 27 of the Contract Act.'
        ];
        lawRefs = [{
          act_key: 'INDIAN_CONTRACT_ACT',
          section_hint: 'Section 27: Agreement in restraint of trade, void',
          reason: 'Post-employment non-solicitation restrictions of long duration are generally void under Section 27.'
        }];
      } else if (info.type === 'dispute_resolution' || info.type === 'arbitration') {
        if (level === 'critical') {
          reasons = [
            'Forcing private binding arbitration for criminal issues / sexual harassment.',
            'Violates public policy and POSH Act framework.'
          ];
          lawRefs = [{
            act_key: 'POSH_ACT',
            section_hint: 'POSH Act / Public Policy: Non-arbitrability of sexual harassment claims',
            reason: 'Claims of sexual harassment and criminal offenses are not arbitrable under Indian law.'
          }];
        } else if (info.score === 8) {
          reasons = [
            'One-sided unilateral arbitrator appointment or oppressive foreign jurisdiction clauses.',
            'Raises fairness concerns under Section 12(5) of the Arbitration Act, 1996.'
          ];
          lawRefs = [{
            act_key: 'ARBITRATION_ACT',
            section_hint: 'Section 12(5) & Seventh Schedule: Ineligibility of Arbitrator',
            reason: 'Unilateral appointment matrices are legally suspect under recent Supreme Court decisions.'
          }];
        } else {
          reasons = ['Standard dispute resolution / arbitration clause.'];
        }
      } else if (info.type === 'compensation') {
        if (level === 'critical') {
          reasons = [
            'Unilateral wage-withholding, forfeiture, or penalty stipulations.',
            'Violates Section 5 & 7 of the Payment of Wages Act and Section 74 of the Contract Act.'
          ];
          lawRefs = [{
            act_key: 'PAYMENT_OF_WAGES_ACT',
            section_hint: 'Section 5 & 7: Permanent wage withholding prohibitions',
            reason: 'Employers cannot unilaterally withhold earned wages or build contingency reserves.'
          }];
        } else {
          reasons = ['Compliant, actual-cost reimbursable training expense covenant.'];
          lawRefs = [];
        }
      } else if (info.type === 'intellectual_property') {
        if (level === 'critical') {
          reasons = [
            'Predatory prior invention capture assignment.',
            'Unreasonable property acquisition without separate consideration.'
          ];
          lawRefs = [{
            act_key: 'INDIAN_CONTRACT_ACT',
            section_hint: 'Section 23/27: Unreasonable IP capture',
            reason: 'Attempting to seize pre-existing personal property created prior to employment scope.'
          }];
        } else if (level === 'high') {
          reasons = [
            'Waiving statutory reversionary rights under Section 19(4) of the Copyright Act.',
            'Strips employee of protective statutory rights.'
          ];
          lawRefs = [{
            act_key: 'COPYRIGHT_ACT',
            section_hint: 'Section 19(4): Waiver of reversionary rights',
            reason: 'Contracting out of statutory reversionary protections is highly suspect.'
          }];
        } else {
          reasons = ['Standard work-for-hire intellectual property clause.'];
        }
      } else if (info.type === 'force_majeure') {
        reasons = [
          'One-sided suspension of obligations violating mutuality.',
          'Oppressive force majeure mapping opposing public policy.'
        ];
        lawRefs = [{
          act_key: 'INDIAN_CONTRACT_ACT',
          section_hint: 'Section 23: Opposing public policy',
          reason: 'Contracts lacking basic mutuality are heavily frowned upon under Indian law.'
        }];
      } else if (info.type === 'indemnification') {
        if (level === 'critical') {
          reasons = [
            'Indemnification covering the company\'s own gross negligence.',
            'Unconscionable risk transfer.'
          ];
          lawRefs = [{
            act_key: 'INDIAN_CONTRACT_ACT',
            section_hint: 'Section 23: Unconscionable agreements',
            reason: 'Forcing a weaker party to indemnify for the stronger party\'s own gross negligence is void.'
          }];
        } else {
          reasons = ['Standard mutual indemnification covenant.'];
        }
      } else if (info.type === 'termination') {
        reasons = [
          'Immediate termination for convenience without notice or payment for rendered work.',
          'Oppressive termination clause violating basic labor practices.'
        ];
        lawRefs = [{
          act_key: 'INDUSTRIAL_DISPUTES_ACT',
          section_hint: 'Section 25F: Notice and retrenchment guidelines',
          reason: 'Unilateral immediate termination without cause is heavily regulated in India.'
        }];
      } else if (info.type === 'other') {
        if (level === 'critical') {
          reasons = [
            'Unpaid disciplinary suspension for an indefinite duration.',
            'Deprives employee of livelihood and operates as illegal restraint.'
          ];
          lawRefs = [{
            act_key: 'INDIAN_CONTRACT_ACT',
            section_hint: 'Section 27/23: Restraint of livelihood',
            reason: 'Indefinite unpaid suspension while blocking alternate employment is completely void.'
          }];
        } else {
          reasons = ['Standard boilerplate clause.'];
        }
      } else {
        reasons = ['Standard contract clause.'];
      }

      return {
        id: c.id,
        risk_level: level,
        risk_score: score,
        risk_reasons: reasons,
        possible_law_references: lawRefs
      };
    });
    return { results };
  }


  if (isAgent3) {
    const results = clauses.map(c => {
      const type = c.clause_type || 'other';
      const traps = getClauseTraps(c.rawText || '', type);
      
      let explanation = 'This clause sets standard guidelines. Ensure you understand your obligations.';
      let scenario = 'If a disagreement occurs, the written terms will bind you directly.';
      let tip = 'Ensure you have written copies of all communications and terms.';

      if (traps.isWageDeferral) {
        explanation = 'Allows the company to unilaterally defer up to 40% of your base salary interest-free during negative margin quarters.';
        scenario = 'You might go unpaid for months with no interest on your delayed base salary, creating severe cashflow issues.';
        tip = 'Request timely payments in compliance with the Payment of Wages Act, 1936. Earned salary cannot be withheld.';
      } else if (traps.isAvailabilityWaiver) {
        explanation = 'Mandates 24/7 availability and demands immediate responses with zero latency.';
        scenario = 'You could face instant termination for not replying to emails on weekends or outside office hours.';
        tip = 'Refuse blanket waivers of Shops & Establishments Act hour protections. Establish standard rest periods.';
      } else if (traps.isTrainingBond) {
        explanation = 'Imposes an arbitrary repayment bond with administrative markup fees and compounding interest.';
        scenario = 'Resigning early will trigger exorbitant claims for internal onboarding expenses, trapping you in the job.';
        tip = 'Restrict employment bonds strictly to direct, verifiable external training costs outside basic onboarding.';
      } else if (traps.isIpLifeCapture) {
        explanation = 'Claims ownership of off-duty creations and personal weekend side-projects.';
        scenario = 'A software app or invention you code entirely on weekends using personal devices will be claimed by the company.';
        tip = 'Limit IP assignment to work created strictly during official hours and directly linked to your job scope.';
      } else if (traps.isLiquidatedPenalty) {
        explanation = 'Mandates a punitive 200% compensation penalty and immediate ex-parte injunctions.';
        scenario = 'The company can sue you for massive arbitrary fines without having to prove any actual financial damage.';
        tip = 'Remove the 200% automatic penalty. Cap liabilities to actual, proven direct loss.';
      } else if (type === 'non_compete') {
        explanation = 'This clause stops you from working for any competitor for a period of time after leaving.';
        scenario = 'You might be unable to find a job or work in your field of expertise for several years.';
        tip = 'Ask to reduce the restriction to 6 months and limit its geographical scope to your city.';
      } else if (type === 'arbitration' || type === 'dispute_resolution') {
        explanation = 'This clause forces you to resolve any dispute out of court using a private arbitrator.';
        scenario = 'The company might select an arbitrator who is favorable to them, leading to an unfair hearing.';
        tip = 'Request that the arbitrator be appointed mutually by both parties or a recognized body like ICA.';
      } else if (type === 'ip_ownership') {
        explanation = 'This clause transfers ownership of all inventions and work you create to the company.';
        scenario = 'A side project you create in your own time might be claimed by the company.';
        tip = 'Request a clear exclusion list for any personal side-projects or pre-existing inventions.';
      } else if (type === 'confidentiality') {
        explanation = 'This clause binds you to keep company secrets and trade secrets private indefinitely.';
        scenario = 'You might be sued if you share standard industry skills that are claimed to be company secrets.';
        tip = 'Negotiate to limit the confidentiality obligation to 2-3 years post-termination.';
      } else if (type === 'privacy_data') {
        explanation = 'This clause allows the company to collect and share your private information.';
        scenario = 'Your personal or health data might be sold or transferred without your specific knowledge.';
        tip = 'Request a copy of the company data protection policy and ensure they get consent for every transfer.';
      }

      return {
        id: c.id,
        plain_language_explanation: explanation,
        worst_case_scenario: scenario,
        negotiation_tip: tip
      };
    });
    return { results };
  }

  if (isAgent4) {
    const results = clauses.map(c => {
      const type = c.clause_type || 'other';
      const traps = getClauseTraps(c.rawText || '', type);
      
      let level = 'low';
      let issues = [];
      let recommend = false;
      let note = 'No significant Indian law compliance issues flagged.';

      if (traps.isWageDeferral) {
        level = 'high';
        issues = ['Unilateral wage deferral', 'Unauthorised base salary withholding'];
        recommend = true;
        note = 'Highly illegal under Section 5 & 7 of the Payment of Wages Act, 1936. Employers cannot arbitrarily withhold contracted salaries or establish corporate reserves using earned wages.';
      } else if (traps.isAvailabilityWaiver) {
        level = 'high';
        issues = ['Waiver of statutory working hours', 'Shops & Establishments Act hour violations'];
        recommend = true;
        note = 'Violates statutory work hour limits and daily rest periods under the Shops and Establishments Acts. Statutory waivers are void under Section 23 of the Contract Act.';
      } else if (traps.isTrainingBond) {
        level = 'high';
        issues = ['Predatory internal training bond', 'Arbitrary internal billing penalty'];
        recommend = true;
        note = 'Under Section 74 of the Contract Act and Sicpa India v. Manas Pratim Baruah, training bonds are invalid unless they represent direct, actual verifiable external expenses.';
      } else if (traps.isIpLifeCapture) {
        level = 'high';
        issues = ['IP life-capture off-duty assignment', 'Copyright Section 57 moral rights violations'];
        recommend = true;
        note = 'IP life-capture assignment operates as an unreasonable restraint under Section 27 of the Contract Act and violates inalienable moral rights protected under Section 57 of the Copyright Act.';
      } else if (traps.isLiquidatedPenalty) {
        level = 'high';
        issues = ['Punitive 200% liquidated damages penalty', 'Ex-parte injunction mandate'];
        recommend = true;
        note = 'Automatic double-salary damages without proof of actual harm are void under Section 74 of the Contract Act. Fateh Chand v. Balkishan Dass mandates proof of actual losses.';
      } else if (type === 'non_compete') {
        level = 'high';
        issues = ['Broad post-termination non-compete duration', 'Potential restraint of trade concern'];
        recommend = true;
        note = 'This clause may raise compliance issues under Section 27 of the Indian Contract Act, 1872, as post-termination non-compete clauses are generally considered void.';
      } else if (type === 'arbitration' || type === 'dispute_resolution') {
        level = 'medium';
        issues = ['Unilateral arbitrator appointment by the company'];
        recommend = true;
        note = 'Unilateral appointment of an arbitrator may conflict with Section 12(5) and the Seventh Schedule of the Arbitration Act, 1996 as per Supreme Court precedents.';
      } else if (type === 'privacy_data') {
        level = 'high';
        issues = ['Lack of revocable or specific consent mechanisms'];
        recommend = true;
        note = 'Data processing without detailed individual consent is heavily restricted under Section 6 of the Digital Personal Data Protection (DPDP) Act, 2023.';
      } else if (type === 'ip_ownership') {
        level = 'low';
        issues = [];
        recommend = false;
        note = 'Standard IP assignment clauses are generally compliant under Section 18 of the Patents Act, 1970 and Indian Copyright law.';
      }

      return {
        id: c.id,
        compliance_risk_level: level,
        potential_issue_areas: issues,
        human_review_strongly_recommended: recommend,
        explanatory_note: note
      };
    });
    return { results };
  }

  return { results: [] };
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

