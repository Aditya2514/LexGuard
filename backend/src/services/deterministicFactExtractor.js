/**
 * Deterministic Fact Extractor (Layer 1)
 * 
 * Zero-LLM dependency. Extracts all quantitative and structural facts
 * from contract clause text using regex + normalization + canonicalization.
 * 
 * Produces a FactTable: an array of structured facts, each tagged with
 * its source clause index, semantic category, and canonical value.
 */

// ── Word-to-Number Map ──────────────────────────────────────────────────────
const WORD_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  million: 1000000, billion: 1000000000, lakh: 100000, crore: 10000000,
};

const WORD_NUMBER_PATTERN = new RegExp(
  '\\b(' + Object.keys(WORD_NUMBERS).join('|') + ')(?:[- ](?:' + Object.keys(WORD_NUMBERS).join('|') + '))*\\b',
  'gi'
);

function parseWordNumber(phrase) {
  const words = phrase.toLowerCase().split(/[- ]+/);
  let total = 0;
  let current = 0;

  for (const w of words) {
    const val = WORD_NUMBERS[w];
    if (val === undefined) continue;
    if (val === 100) {
      current = (current === 0 ? 1 : current) * 100;
    } else if (val >= 1000) {
      current = (current === 0 ? 1 : current) * val;
      total += current;
      current = 0;
    } else {
      current += val;
    }
  }
  return total + current;
}

// ── Duration Unit Normalization ─────────────────────────────────────────────
const DURATION_UNITS = {
  day: 'days', days: 'days', 'calendar day': 'days', 'calendar days': 'days',
  'business day': 'business_days', 'business days': 'business_days',
  'working day': 'business_days', 'working days': 'business_days',
  week: 'weeks', weeks: 'weeks',
  month: 'months', months: 'months',
  year: 'years', years: 'years',
  hour: 'hours', hours: 'hours',
};

// Convert all durations to a common unit (days) for comparison
function durationToDays(value, unit) {
  switch (unit) {
    case 'hours': return value / 24;
    case 'days': return value;
    case 'business_days': return value * 1.4; // ~7/5 ratio
    case 'weeks': return value * 7;
    case 'months': return value * 30;
    case 'years': return value * 365;
    default: return value;
  }
}

// ── Semantic Category Detection ─────────────────────────────────────────────
const CATEGORY_PATTERNS = [
  { category: 'total_fee',        patterns: [/total\s+(?:contract\s+)?(?:value|fee|price|amount|consideration)/i, /(?:aggregate|fixed)\s+(?:fee|price|value|consideration)/i, /contract\s+(?:value|price)/i, /(?:annual|yearly|total)\s+(?:subscription\s+)?fee/i] },
  { category: 'milestone_fee',    patterns: [/milestone/i, /(?:phase|stage|tranche)\s+\d/i, /payment\s+schedule/i, /installment/i, /(?:monthly|quarterly|bi-weekly|weekly)\s+(?:installment|payment)/i] },
  { category: 'acceptance_period', patterns: [/acceptance\s+(?:period|window|deadline)/i, /(?:review|testing|inspection)\s+period/i, /(?:review|test|inspect)\s+(?:the\s+)?deliverable/i, /(?:review|test)\s+(?:and\s+(?:review|test)\s+)?(?:all\s+)?deliverable/i, /(?:review|test|inspect|validate)\s+.*?deliverable/i] },

  { category: 'deemed_acceptance', patterns: [/deemed\s+(?:accepted|acceptance)/i, /automatically\s+(?:accepted|deemed)/i, /(?:shall\s+be\s+)?deemed\s+to\s+(?:have\s+been\s+)?accept/i] },
  { category: 'notice_period',    patterns: [/(?:notice|notification)\s+(?:period|deadline|window)/i, /(?:within|no\s+later\s+than)\s+.*?(?:notify|report|inform)/i, /(?:notify|report|inform)\s+.*?(?:within|no\s+later)/i] },
  { category: 'security_notice',  patterns: [/(?:security|breach|incident)\s+(?:notification|notice|report)/i, /(?:notify|report)\s+.*?(?:security|breach|incident)/i, /security\s+(?:breach|incident)/i, /(?:security|breach).*?(?:within|no\s+later)/i] },
  { category: 'retention_period', patterns: [/(?:record|data)\s+retention/i, /(?:retain|maintain|preserve)\s+.*?(?:records|data|documents|confidentiality|confidential\s+information)/i, /retention\s+period/i, /records?\s+for\s+(?:a\s+)?(?:minimum\s+)?(?:period|duration)/i, /(?:confidential|confidentiality)\s+.*?(?:period|years?|months?)/i, /(?:records?|data|documents?|logs?)\s+(?:shall\s+be\s+|must\s+be\s+|are\s+)?(?:retained|maintained|preserved|kept)/i, /(?:retained|maintained|preserved|kept)\s+for\s+(?:a\s+)?(?:minimum\s+)?(?:period|duration)?\s*(?:of\s+)?\d/i] },
  { category: 'liability_cap',    patterns: [/(?:aggregate|total|cumulative)\s+liability/i, /liability\s+(?:shall\s+)?(?:not\s+)?exceed/i, /(?:cap|limit|ceiling)\s+(?:on\s+)?(?:liability|damages)/i] },
  { category: 'termination',      patterns: [/(?:upon|after|following)\s+termination/i, /terminat(?:e|ion)\s+(?:for\s+)?(?:convenience|cause)/i] },
  { category: 'refund',           patterns: [/refund\s+(?:all|entire|full)/i, /(?:return|repay)\s+(?:all\s+)?(?:fees|payments|amounts)/i] },
  { category: 'payment_on_term',  patterns: [/(?:pay|compensate)\s+.*?(?:services?\s+(?:performed|rendered|completed))/i, /(?:payment|compensation)\s+for\s+(?:work|services)/i] },
  { category: 'contract_term',    patterns: [/(?:initial|contract)\s+term/i, /term\s+of\s+(?:this\s+)?agreement/i, /(?:duration|period)\s+of\s+(?:this\s+)?(?:agreement|contract)/i] },
  { category: 'auto_renewal',     patterns: [/auto(?:matically)?[- ]?renew/i, /(?:successive|additional)\s+(?:period|term)/i, /(?:renew|extend)\s+(?:automatically|for\s+(?:successive|additional))/i] },
  { category: 'jurisdiction',     patterns: [/(?:exclusive\s+)?jurisdiction/i, /(?:governed?\s+by\s+(?:the\s+)?laws?\s+of)/i, /courts?\s+(?:of|located\s+in|sitting\s+in)/i] },
  { category: 'interest_rate',    patterns: [/interest\s+(?:rate|charge|payment|accru)/i, /(?:late\s+payments?|default|penalty)\s+interest/i, /interest\s+at\s+(?:the\s+)?(?:rate\s+(?:of\s+)?)?\d/i, /accru\w*\s+interest/i, /(?:interest|penalty)\s+rate\b/i, /\b(?:rate\s+of\s+)\d+(?:\.\d+)?\s*%/i, /\binterest\b.*?\baccru\w*\b.*?\bat\b.*?\d+(?:\.\d+)?\s*%/i, /\binterest\b.*?\bat\b.*?\d+(?:\.\d+)?\s*%\s*(?:per\s+annum|p\.?a\.?)?/i] },
  { category: 'completion_date',  patterns: [/(?:project|work)\s+completion\s+(?:date|deadline)/i, /complet(?:e|ion)\s+(?:by|on|before|no\s+later)/i] },
  { category: 'delivery_date',    patterns: [/(?:final\s+)?deliver(?:y|able)\s+(?:date|deadline)/i, /deliver(?:y|ables?)\s+(?:by|on|before|no\s+later)/i] },
  { category: 'precedence',       patterns: [/(?:shall\s+)?(?:prevail|take\s+precedence|supersede|control)/i, /(?:in\s+(?:the\s+)?event\s+of\s+(?:a\s+)?)?conflict/i] },
];

function detectCategory(text, clauseIndex) {
  const lower = text.toLowerCase();
  const matched = [];
  for (const cp of CATEGORY_PATTERNS) {
    for (const pat of cp.patterns) {
      if (pat.test(lower)) {
        matched.push(cp.category);
        break;
      }
    }
  }
  return matched.length > 0 ? matched : ['uncategorized'];
}

// ── Currency Extraction ─────────────────────────────────────────────────────
const CURRENCY_PATTERNS = [
  // $500,000 or USD 500,000 or US$ 500,000
  /(?:\$|USD\s*|US\$\s*)([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/gi,
  // INR 5,00,000 or ₹5,00,000 or ₹1,00,00,000 (Indian notation, supports up to crore level)
  /(?:INR\s*|₹\s*)([0-9]{1,3}(?:,?[0-9]{2,3})*(?:,?[0-9]{3})(?:\.[0-9]{1,2})?)/gi,
  // 500k, 1.5M, 2.5B (shorthand)
  /(?:\$|USD\s*|INR\s*|₹\s*)?([0-9]+(?:\.[0-9]+)?)\s*([kKmMbB])\b/gi,
  // Spelled-out: "Five Hundred Thousand Dollars"
  // Handled separately via word number parser
];

function extractCurrencyFacts(text, clauseIndex, clauseContext) {
  const facts = [];
  const matchedPositions = new Set(); // Track positions to avoid double-counting

  // Pattern 1: $500,000 / USD 500,000
  let match;
  const pat1 = /(?:\$|USD\s*|US\$\s*)([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{1,2})?)/gi;
  while ((match = pat1.exec(text)) !== null) {
    const raw = match[0];
    const value = Number(match[1].replace(/,/g, ''));
    if (!isNaN(value) && value > 0) {
      matchedPositions.add(match.index);
      facts.push({ type: 'currency', value, unit: 'USD', raw, clauseIndex });
    }
  }

  // Pattern 2: INR / ₹ (Indian) — with explicit prefix
  // Supports lakh (10,00,000), crore (1,00,00,000), and higher values.
  // {1,3} initial digits handles 1-crore = "1,00,00,000" (1 digit initial)
  const pat2 = /(?:INR\s*|₹\s*)([0-9]{1,3}(?:,?[0-9]{2,3})*(?:,?[0-9]{3})(?:\.[0-9]{1,2})?)/gi;
  while ((match = pat2.exec(text)) !== null) {
    const raw = match[0];
    const value = Number(match[1].replace(/,/g, ''));
    if (!isNaN(value) && value > 0) {
      matchedPositions.add(match.index);
      facts.push({ type: 'currency', value, unit: 'INR', raw, clauseIndex });
    }
  }

  // Pattern 3: Shorthand (500k, 1.5M)
  const pat3 = /(?:\$|USD\s*|INR\s*|₹\s*)?([0-9]+(?:\.[0-9]+)?)\s*([kKmMbB])\b/gi;
  while ((match = pat3.exec(text)) !== null) {
    const raw = match[0];
    let value = Number(match[1].replace(/,/g, ''));
    const suffix = match[2].toLowerCase();
    if (suffix === 'k') value *= 1000;
    else if (suffix === 'm') value *= 1000000;
    else if (suffix === 'b') value *= 1000000000;
    if (!isNaN(value) && value > 0) {
      matchedPositions.add(match.index);
      const unit = raw.includes('INR') || raw.includes('₹') ? 'INR' : 'USD';
      facts.push({ type: 'currency', value, unit, raw, clauseIndex });
    }
  }

  // Pattern 4: Bare Indian-format numbers WITHOUT INR/₹ prefix
  // Matches the distinctive XX,XX,XXX comma grouping (e.g. "10,00,000", "1,50,000", "1,00,00,000")
  // The Indian notation uses groups of 2 after the thousands place, which is
  // structurally unique and won't false-positive on Western "1,000,000".
  // Guard: only activate if the broader CLAUSE context mentions INR/₹/Rupees/Lakh/Crore
  // Use clauseContext (full clause text) rather than just the sentence text
  const hasIndianContext = /(?:INR|₹|rupee|lakh|crore)/i.test(clauseContext || text);
  if (hasIndianContext) {
    // Allow up to crore-level (1,00,00,000): {1,3} initial digits, repeating 2-3 digit groups
    const pat4 = /\b([0-9]{1,3},(?:[0-9]{2,3},)*[0-9]{3})(?:\.[0-9]{1,2})?\b/g;
    while ((match = pat4.exec(text)) !== null) {
      // Skip if this position was already captured by Pattern 2 (INR prefix)
      // Check if any earlier pattern matched at a position that contains this match
      let alreadyCaptured = false;
      for (const pos of matchedPositions) {
        if (pos <= match.index && match.index < pos + 30) {
          alreadyCaptured = true;
          break;
        }
      }
      if (alreadyCaptured) continue;

      const raw = match[0];
      const value = Number(match[1].replace(/,/g, ''));
      // Guard: must be at least 1,000 (i.e. "1,000" minimum) to avoid matching dates/codes
      if (!isNaN(value) && value >= 1000) {
        facts.push({ type: 'currency', value, unit: 'INR', raw, clauseIndex });
      }
    }
  }

  return facts;
}

// ── Duration Extraction ─────────────────────────────────────────────────────
function extractDurationFacts(text, clauseIndex) {
  const facts = [];

  // Numeric durations: "15 days", "72 hours", "3 years", "24 months"
  const numDurPattern = /(\d+)\s*(calendar\s+days?|business\s+days?|working\s+days?|days?|hours?|weeks?|months?|years?)\b/gi;
  let match;
  while ((match = numDurPattern.exec(text)) !== null) {
    const value = parseInt(match[1], 10);
    const rawUnit = match[2].toLowerCase().replace(/\s+/g, ' ');
    const unit = DURATION_UNITS[rawUnit] || DURATION_UNITS[rawUnit.replace(/s$/, '')] || 'days';
    const days = durationToDays(value, unit);
    facts.push({
      type: 'duration', value, unit, days, raw: match[0], clauseIndex,
    });
  }

  // Word-number durations: "fifteen days", "seventy-two hours"
  const wordDurPattern = new RegExp(
    '(' + Object.keys(WORD_NUMBERS).join('|') + ')(?:[- ](?:' + Object.keys(WORD_NUMBERS).join('|') + '))*' +
    '\\s+(calendar\\s+days?|business\\s+days?|working\\s+days?|days?|hours?|weeks?|months?|years?)',
    'gi'
  );
  while ((match = wordDurPattern.exec(text)) !== null) {
    const unitPart = match[0].match(/(calendar\s+days?|business\s+days?|working\s+days?|days?|hours?|weeks?|months?|years?)$/i);
    if (!unitPart) continue;
    const numberPart = match[0].slice(0, match[0].length - unitPart[0].length).trim();
    const value = parseWordNumber(numberPart);
    const rawUnit = unitPart[1].toLowerCase().replace(/\s+/g, ' ');
    const unit = DURATION_UNITS[rawUnit] || DURATION_UNITS[rawUnit.replace(/s$/, '')] || 'days';
    const days = durationToDays(value, unit);
    if (value > 0) {
      facts.push({
        type: 'duration', value, unit, days, raw: match[0], clauseIndex,
      });
    }
  }

  return facts;
}

// ── Percentage Extraction ───────────────────────────────────────────────────
function extractPercentageFacts(text, clauseIndex) {
  const facts = [];
  const pctPattern = /(\d+(?:\.\d+)?)\s*%/g;
  let match;
  while ((match = pctPattern.exec(text)) !== null) {
    const value = parseFloat(match[1]);
    facts.push({ type: 'percentage', value, raw: match[0], clauseIndex });
  }
  return facts;
}

// ── Date Extraction ─────────────────────────────────────────────────────────
function extractDateFacts(text, clauseIndex) {
  const facts = [];
  // "March 31, 2025" / "31 March 2025" / "2025-03-31" / "03/31/2025"
  const datePatterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})\b/gi,
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  ];

  for (const pat of datePatterns) {
    let match;
    while ((match = pat.exec(text)) !== null) {
      facts.push({ type: 'date', raw: match[0], clauseIndex });
    }
  }
  return facts;
}

// ── Cross-Reference Extraction ──────────────────────────────────────────────
function extractCrossRefFacts(text, clauseIndex) {
  const facts = [];
  // "Section 4.2", "Clause 11", "Article III", "Schedule A", "Exhibit B"
  const refPattern = /\b(Section|Clause|Article|Schedule|Exhibit|Appendix|Annex)\s+([A-Z0-9][A-Z0-9.()]*)\b/gi;
  let match;
  while ((match = refPattern.exec(text)) !== null) {
    facts.push({
      type: 'cross_ref',
      refType: match[1].toLowerCase(),
      refTarget: match[2],
      raw: match[0],
      clauseIndex,
    });
  }
  return facts;
}

// ── Jurisdiction Extraction ─────────────────────────────────────────────────
const JURISDICTION_KEYWORDS = [
  'new york', 'california', 'delaware', 'texas', 'illinois', 'florida',
  'massachusetts', 'washington', 'singapore', 'london', 'england',
  'mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'kolkata', 'hyderabad',
  'port blair', 'india', 'united states', 'united kingdom',
];

function extractJurisdictionFacts(text, clauseIndex) {
  const lower = text.toLowerCase();
  const facts = [];

  // Only extract if the clause discusses jurisdiction/governing law
  if (!/(?:jurisdiction|governed?\s+by|courts?\s+(?:of|located|sitting)|exclusive)/i.test(text)) {
    return facts;
  }

  for (const jur of JURISDICTION_KEYWORDS) {
    if (lower.includes(jur)) {
      facts.push({
        type: 'jurisdiction',
        value: jur,
        raw: jur,
        clauseIndex,
      });
    }
  }
  return facts;
}

// ── Semantic Fact Extraction (for ownership, precedence, termination) ───────
function extractSemanticFacts(text, clauseIndex) {
  const lower = text.toLowerCase();
  const facts = [];

  // Ownership claims: "Client owns", "Vendor retains ownership", "assigns all rights"
  // Party lists include: Client/Customer/Buyer/Company/Employer/Licensor/Licensee
  const clientPartyPattern = /(?:client|customer|buyer|company|employer|licensee)/i;
  const vendorPartyPattern = /(?:vendor|provider|supplier|contractor|employee|licensor)/i;
  
  const ownershipPatterns = [
    { pattern: new RegExp(clientPartyPattern.source + '\\s+(?:shall\\s+)?(?:own|retain|have)\\s+(?:all\\s+)?(?:right|title|ownership|interest)', 'i'), party: 'client', action: 'owns' },
    { pattern: new RegExp(vendorPartyPattern.source + '\\s+(?:shall\\s+)?(?:own|retain|have)\\s+(?:all\\s+)?(?:right|title|ownership|interest)', 'i'), party: 'vendor', action: 'owns' },
    { pattern: new RegExp('(?:assign|transfer|convey)\\s+(?:all\\s+)?(?:right|title|ownership|interest)\\s+(?:to|in)\\s+(?:the\\s+)?' + clientPartyPattern.source, 'i'), party: 'client', action: 'assigned_to' },
    { pattern: new RegExp('(?:assign|transfer|convey)\\s+(?:all\\s+)?(?:right|title|ownership|interest)\\s+(?:to|in)\\s+(?:the\\s+)?' + vendorPartyPattern.source, 'i'), party: 'vendor', action: 'assigned_to' },
    // Broader: "assigned to and owned exclusively by the Client"
    { pattern: new RegExp('(?:assigned|belong|vest)\\s+.*?(?:owned|exclusively)\\s+.*?' + clientPartyPattern.source, 'i'), party: 'client', action: 'assigned_to' },
    { pattern: new RegExp('(?:assigned|belong|vest)\\s+.*?(?:owned|exclusively)\\s+.*?' + vendorPartyPattern.source, 'i'), party: 'vendor', action: 'assigned_to' },
    // "Vendor retains..."
    { pattern: new RegExp(vendorPartyPattern.source + '\\s+retain', 'i'), party: 'vendor', action: 'owns' },
    { pattern: new RegExp(clientPartyPattern.source + '\\s+retain', 'i'), party: 'client', action: 'owns' },
    // "property of the Company/Client"
    { pattern: new RegExp('(?:property|owned)\\s+(?:of|by)\\s+(?:the\\s+)?' + clientPartyPattern.source, 'i'), party: 'client', action: 'owns' },
    { pattern: new RegExp('(?:property|owned)\\s+(?:of|by)\\s+(?:the\\s+)?' + vendorPartyPattern.source, 'i'), party: 'vendor', action: 'owns' },
  ];

  for (const op of ownershipPatterns) {
    if (op.pattern.test(text)) {
      // Determine the subject — but guard against negated mentions.
      // "that are not Deliverables" should NOT classify subject as deliverables.
      const hasDeliverable = /deliverable/i.test(lower);
      const isNegatedDeliverable = /(?:not|excluding|other\s+than)\s+deliverables?/i.test(lower);
      const isScopedToPreExisting = /pre-existing|underlying|background\s+ip|prior\s+work|personal\s+time|personal\s+resources|outside\s+(?:of\s+)?(?:working|business)\s+hours/i.test(lower);
      
      let subject = 'general';
      if (hasDeliverable && !isNegatedDeliverable && !isScopedToPreExisting) {
        subject = 'deliverables';
      } else if (/intellectual\s+property/i.test(lower) && !isScopedToPreExisting) {
        subject = 'ip';
      } else if (/(?:invention|work\s+product|customization|derivative\s+work)/i.test(lower) && !isScopedToPreExisting) {
        subject = 'deliverables'; // inventions/work product treated same as deliverables
      }
      
      facts.push({
        type: 'ownership',
        party: op.party,
        action: op.action,
        subject,
        raw: text.substring(0, 120),
        clauseIndex,
      });
    }
  }

  // Precedence claims: "Schedule A prevails", "Agreement shall prevail", "SOW prevails", "MSA prevails"
  const precedencePattern = /\b(schedule\s+[a-z]|(?:this\s+)?(?:agreement|contract)|agreement|contract|exhibit\s+[a-z]|appendix\s+[a-z]|(?:this\s+)?sow|(?:this\s+)?(?:statement\s+of\s+work)|(?:the\s+)?(?:master\s+service\s+agreement)|(?:the\s+)?msa)\s+(?:shall\s+)?(?:prevail|take\s+precedence|supersede|control|override)\b/gi;
  let match;
  while ((match = precedencePattern.exec(text)) !== null) {
    facts.push({
      type: 'precedence',
      document: match[1].trim().toLowerCase(),
      raw: match[0],
      clauseIndex,
    });
  }

  // Termination payment semantics
  if (/refund\s+(?:all|entire|full|100%)/i.test(text) && /(?:fee|payment|amount)/i.test(text)) {
    facts.push({ type: 'termination_payment', action: 'refund_all', raw: text.substring(0, 120), clauseIndex });
  }
  if (/(?:pay|compensate|reimburse)\s+.*?(?:services?\s+(?:performed|rendered|completed)|work\s+(?:performed|completed|done))/i.test(text)) {
    facts.push({ type: 'termination_payment', action: 'pay_for_services', raw: text.substring(0, 120), clauseIndex });
  }

  // Auto-renewal detection
  if (/auto(?:matically)?[- ]?renew/i.test(text)) {
    facts.push({ type: 'auto_renewal', value: true, raw: text.substring(0, 120), clauseIndex });
  }

  // Fixed end date detection
  if (/(?:shall\s+)?(?:expire|terminate|end)\s+(?:on|in|after|during|at|within)\s+/i.test(text) || /(?:fixed|definite)\s+(?:end|expiry|termination)\s+date/i.test(text)) {
    facts.push({ type: 'fixed_end_date', value: true, raw: text.substring(0, 120), clauseIndex });
  }

  return facts;
}

// ── Main Extraction Orchestrator ────────────────────────────────────────────

/**
 * Extract all quantitative and structural facts from an array of clauses.
 * 
 * @param {{ segmentIndex: number, rawText: string }[]} clauses
 * @returns {{ facts: Array, categorizedFacts: Object }}
 */
function extractFactTable(clauses) {
  const allFacts = [];

  for (const clause of clauses) {
    const idx = clause.segmentIndex;
    const text = clause.rawText || '';
    const clauseCategories = detectCategory(text, idx);

    // Split clause text into sentences to localize fact categorization using lookbehind to protect decimals
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentenceText of sentences) {
      const sentenceCategories = detectCategory(sentenceText, idx);
      const categoriesToUse = (sentenceCategories.length === 1 && sentenceCategories[0] === 'uncategorized')
        ? clauseCategories
        : sentenceCategories;

      const sentenceFacts = [
        ...extractCurrencyFacts(sentenceText, idx, text),
        ...extractDurationFacts(sentenceText, idx),
        ...extractPercentageFacts(sentenceText, idx),
        ...extractDateFacts(sentenceText, idx),
        ...extractCrossRefFacts(sentenceText, idx),
        ...extractJurisdictionFacts(sentenceText, idx),
        ...extractSemanticFacts(sentenceText, idx),
      ];

      // Tag each fact with its localized categories
      for (const fact of sentenceFacts) {
        fact.categories = categoriesToUse;
      }

      allFacts.push(...sentenceFacts);
    }
  }

  // Group by type for easier rule evaluation
  const categorizedFacts = {};
  for (const fact of allFacts) {
    if (!categorizedFacts[fact.type]) categorizedFacts[fact.type] = [];
    categorizedFacts[fact.type].push(fact);
  }

  return { facts: allFacts, categorizedFacts };
}

module.exports = { extractFactTable, durationToDays, parseWordNumber };
