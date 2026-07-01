/**
 * Citation Verification Layer
 * 
 * Post-processes agent outputs to verify that all statute citations
 * (e.g., "Section 27 of the Indian Contract Act, 1872") actually exist
 * in LexGuard's ingested statutes database.
 * 
 * This eliminates hallucinated citations — the #1 trust-killer in legal AI.
 */

const StatuteNode = require('../models/StatuteNode');
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');

const { AutoModelForSequenceClassification, AutoTokenizer } = require('@xenova/transformers');

class SemanticCitationVerifier {
  constructor() {
    this.modelName = 'Xenova/bge-reranker-base';
    this.tokenizer = null;
    this.model = null;
  }

  async init() {
    if (!this.model) {
      console.log(`[Verifier] Loading Cross-Encoder: ${this.modelName}...`);
      this.tokenizer = await AutoTokenizer.from_pretrained(this.modelName);
      this.model = await AutoModelForSequenceClassification.from_pretrained(this.modelName);
    }
  }

  async verifySemanticEquivalence(archaicStatute, modernSummary) {
    await this.init();

    // Cross-Encoders take the query (modern summary) and document (archaic statute)
    const inputs = await this.tokenizer(modernSummary, { text_pair: archaicStatute, padding: true, truncation: true });
    const { logits } = await this.model(inputs);
    
    // Extract raw logit score
    const logitScore = logits.data[0];

    // Normalize logit into a rough 0-1 score for thresholding. 
    // bge-reranker logits usually range from -10 to +3.
    // We apply a shifted sigmoid to make the math work for a 0.65 threshold.
    const normalizedScore = 1 / (1 + Math.exp(-(logitScore + 7.5))); 

    console.log(`[Verifier] Semantic Cross-Encoder Score: ${normalizedScore.toFixed(3)} (Raw Logit: ${logitScore.toFixed(3)})`);

    const SEMANTIC_THRESHOLD = 0.65; 

    return normalizedScore >= SEMANTIC_THRESHOLD;
  }
}

const semanticVerifier = new SemanticCitationVerifier();

// ── Citation Format Normalizer ───────────────────────────────────────────────

/**
 * Standardize citation format to "Section X of ActName, Year".
 * Handles variations: "Sec. 27", "S.27", "Section 27(1)", "Art. 14"
 */
function normalizeCitationFormat(sectionHint, actName) {
    if (!sectionHint) return sectionHint;
    
    // Normalize common abbreviations to full form
    let normalized = sectionHint
        .replace(/\bSec\.?\s*/gi, 'Section ')
        .replace(/\bS\.\s*/gi, 'Section ')
        .replace(/\bArt\.?\s*/gi, 'Article ')
        .replace(/\bReg\.?\s*/gi, 'Regulation ')
        .replace(/\bCl\.?\s*/gi, 'Clause ');
    
    // Remove "Chunk X/Y" artifacts from ingestion pipeline
    normalized = normalized.replace(/\s*\(Chunk\s+\d+(?:\/\d+)?\)/gi, '');
    
    // Remove leading/trailing dashes and whitespace
    normalized = normalized.replace(/^\s*[-–—]\s*/, '').replace(/\s*[-–—]\s*$/, '').trim();
    
    // If we have an act name and the hint doesn't already include it, append it
    if (actName && !normalized.toLowerCase().includes(actName.toLowerCase().split(',')[0].trim())) {
        // Only append if the hint is just a section reference
        if (/^(Section|Article|Rule|Regulation|Schedule|Clause|Order)\s+\d/i.test(normalized)) {
            normalized = `${normalized} of ${actName}`;
        }
    }
    
    return normalized;
}

/**
 * Grade citation confidence based on verification results.
 * Returns: 'strong' | 'weak' | 'hallucinated' | 'unverifiable'
 */
function gradeCitationConfidence(verificationStatus, similarityScore) {
    switch (verificationStatus) {
        case 'verified':
            return 'strong';
        case 'misquoted':
            return 'hallucinated';
        case 'not_found':
            return 'unverifiable';
        case 'not_applicable':
            return 'weak'; // Case law — can't verify against statute DB
        default:
            return 'unverifiable';
    }
}

/**
 * Extract a brief factual summary from the statute content (first 200 chars).
 * This helps users see what the statute actually says vs what the LLM claims.
 */
function extractStatuteSummary(content, maxLength = 250) {
    if (!content) return null;
    
    // Clean up formatting artifacts
    const cleaned = content
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    if (cleaned.length <= maxLength) return cleaned;
    
    // Cut at last sentence boundary within the limit
    const truncated = cleaned.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.5) {
        return truncated.substring(0, lastPeriod + 1);
    }
    return truncated + '...';
}

// ── Citation Extraction ──────────────────────────────────────────────────────

/**
 * Extract structured citation objects from an agent's law references.
 * Parses section_hint AND reason strings for section numbers like "Section 27",
 * "Section 19(4)", etc. The LLM sometimes puts the section number in the reason
 * field instead of the hint field.
 */
function extractCitationsFromRefs(lawRefs) {
    if (!Array.isArray(lawRefs)) return [];

    const CITATION_REGEX = /(?:Section|Article|Rule|Regulation|Schedule|Clause|Order)\s+(\d+[A-Z]?(?:\(\d+\))?(?:\([a-z]\))?)/gi;

    return lawRefs.map(ref => {
        const fieldsToSearch = [
            ref.section_hint || '',
            ref.reason || '',
            ref.act_name || '',
        ].map(val => val
            .replace(/\bSec\.?\s*/gi, 'Section ')
            .replace(/\bS\.\s*/gi, 'Section ')
            .replace(/\bArt\.?\s*/gi, 'Article ')
            .replace(/\bReg\.?\s*/gi, 'Regulation ')
            .replace(/\bCl\.?\s*/gi, 'Clause ')
        );

        let parsedSection = null;
        let parsedSectionNumber = null;

        for (const field of fieldsToSearch) {
            const match = field.match(CITATION_REGEX);
            if (match && match.length > 0) {
                // Take the first section reference found
                const sectionMatch = match[0].match(/(Section|Article|Rule|Regulation|Schedule|Clause|Order)\s+(\d+[A-Z]?(?:\(\d+\))?(?:\([a-z]\))?)/i);
                if (sectionMatch) {
                    const type = sectionMatch[1].charAt(0).toUpperCase() + sectionMatch[1].slice(1).toLowerCase();
                    parsedSection = `${type} ${sectionMatch[2]}`;
                    parsedSectionNumber = sectionMatch[2];
                    break;
                }
            }
        }

        return {
            act_key: ref.act_key,
            act_name: ref.act_name || '',
            section_hint: ref.section_hint || '',
            reason: ref.reason || '',
            reference_url: ref.reference_url || '',
            parsedSection,
            parsedSectionNumber,
            // Store keywords from hint/reason for fallback text search
            searchKeywords: (ref.section_hint + ' ' + ref.reason)
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3),
        };
    });
}

// ── Database Verification ────────────────────────────────────────────────────

// ── Act Key → Database Act Name Mapping ──────────────────────────────────────
// Maps the rigid act_keys used by agents to fuzzy search terms for the DB
const ACT_KEY_SEARCH_TERMS = {
    // Core Contract & Civil
    'INDIAN_CONTRACT_ACT': ['indian contract act', 'contract act 1872'],
    'SPECIFIC_RELIEF_ACT': ['specific relief act'],
    'TRANSFER_OF_PROPERTY_ACT': ['transfer of property act'],
    'SALE_OF_GOODS_ACT': ['sale of goods act'],
    'NEGOTIABLE_INSTRUMENTS_ACT': ['negotiable instruments act'],
    'PARTNERSHIP_ACT': ['indian partnership act'],
    'HINDU_SUCCESSION_ACT': ['hindu succession act'],
    // Criminal & Evidence
    'IPC': ['indian penal code', 'ipc '],
    'CrPC': ['code of criminal procedure', 'crpc'],
    'EVIDENCE_ACT': ['indian evidence act'],
    // Corporate & Finance
    'COMPANIES_ACT': ['companies act'],
    'INSOLVENCY_CODE': ['insolvency and bankruptcy code', 'ibc '],
    'SARFAESI_ACT': ['sarfaesi act', 'securitisation and reconstruction'],
    'COMPETITION_ACT': ['competition act'],
    'FEMA_ACT': ['foreign exchange management act', 'fema'],
    'SEBI_INSIDER_TRADING': ['prohibition of insider trading', 'sebi'],
    'INCOME_TAX_ACT': ['income tax act'],
    'GST_ACT': ['central goods and services tax', 'cgst'],
    'FINANCE_ACT_CRYPTO': ['finance act', 'crypto'],
    'MONEY_LAUNDERING_ACT': ['prevention of money-laundering', 'pmla'],
    // Labour & Employment
    'INDUSTRIAL_DISPUTES_ACT': ['industrial disputes', 'industrial dispute'],
    'INDUSTRIAL_RELATIONS_CODE': ['industrial relations code'],
    'CODE_ON_WAGES': ['code on wages'],
    'PAYMENT_OF_WAGES_ACT': ['payment of wages act'],
    'EPF_ACT': ['employees provident funds', 'epf ', 'epfscheme'],
    'MATERNITY_BENEFIT_ACT': ['maternity benefit act'],
    'POSH_ACT': ['sexual harassment of women', 'posh act'],
    'KARNATAKA_STANDING_ORDERS': ['karnataka industrial employment'],
    // Tech & Privacy
    'DPDP_ACT': ['digital personal data protection', 'dpdp'],
    'IT_ACT': ['information technology act', 'it act 2000'],
    'IT_INTERMEDIARY_RULES': ['intermediary guidelines', 'digital media ethics'],
    'IT_DEEPFAKE_AMENDMENT': ['deepfake amendment'],
    'CERT_IN_RULES': ['cert-in', 'computer emergency response team'],
    'AI_ADVISORY': ['ai advisory'],
    'TELECOM_ACT': ['telecommunications act'],
    // IP
    'PATENTS_ACT': ['patents act', 'patent act 1970'],
    'COPYRIGHT_ACT': ['copyright act'],
    'TRADE_MARKS_ACT': ['trade marks act'],
    // Real Estate
    'RERA_ACT': ['real estate (regulation', 'rera '],
    'MAHARERA_RULES': ['maharera'],
    // Consumer & Transport
    'CONSUMER_PROTECTION_ACT': ['consumer protection act'],
    'MOTOR_VEHICLES_ACT': ['motor vehicles act'],
    // Dispute
    'ARBITRATION_ACT': ['arbitration', 'conciliation act'],
    // MSME & Misc
    'MSMED_ACT': ['micro, small and medium', 'msmed'],
    'DRONE_RULES': ['drone rules'],
    'SPACE_POLICY': ['indian space policy'],
    'RTI_ACT': ['right to information', 'rti act'],
    'TOBACCO_ACT': ['cigarettes and other tobacco', 'cotpa'],
    'RBI_DIGITAL_LENDING': ['guidelines on digital lending', 'rbi guidelines'],
    'INFLUENCER_GUIDELINES': ['influencer advertising', 'asci guidelines'],
    // Criminal Codes
    'BNS': ['bharatiya nyaya sanhita', 'bns'],
    'BNSS': ['bharatiya nagarik suraksha sanhita', 'bnss'],
    'BSA': ['bharatiya sakshya adhiniyam', 'bsa'],
};

/**
 * Look up a citation in the statutes collection.
 * Returns the matching statute document if found, or null.
 * 
 * Uses fuzzy matching on actName since the DB might store
 * "Indian Contract Act 1872" vs the LLM saying "Indian Contract Act, 1872".
 */
async function lookupStatute(parsedSection, actName, llmClaim) {
    if (!parsedSection) return null;

    // Build regex to match the parsed section number with or without chunk suffix: e.g. "Section 27 (Chunk 12)"
    const escapedSection = parsedSection.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^${escapedSection}(\\s*\\(Chunk\\s+\\d+\\))?$`, 'i');

    // Retrieve all nodes with the matching section number
    const results = await StatuteNode.find({
        sectionNumber: { $regex: regex },
    }).select('actName sectionNumber content').lean();

    if (results.length === 0) return null;

    // If we have an act name, look for a matching act in our results
    let filteredResults = results;
    if (actName) {
        const actNameLower = actName.toLowerCase().replace(/[,.\s]+/g, ' ').trim();
        filteredResults = results.filter(r => {
            const dbActName = r.actName.toLowerCase().replace(/[,.\s]+/g, ' ').trim();
            return dbActName.includes(actNameLower) || actNameLower.includes(dbActName);
        });
    }

    if (filteredResults.length === 0) return null;

    // If we have multiple chunks for the same section, select the one that matches the LLM claim best
    if (filteredResults.length > 1 && llmClaim) {
        let bestMatch = filteredResults[0];
        let bestScore = -1;
        for (const r of filteredResults) {
            const score = computeTextSimilarity(llmClaim, r.content);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = r;
            }
        }
        return bestMatch;
    }

    return filteredResults[0];
}

/**
 * Fallback: Search for a statute by act_key + keyword matching.
 * Used when the LLM doesn't include a specific section number.
 * Searches for the act in the database and returns the best matching section.
 */
async function lookupStatuteByKeywords(actKey, keywords) {
    const searchTerms = ACT_KEY_SEARCH_TERMS[actKey];
    if (!searchTerms || searchTerms.length === 0) return null;

    // Find any statute from this act
    const actNameRegex = searchTerms.map(t => new RegExp(t, 'i'));

    for (const regex of actNameRegex) {
        const results = await StatuteNode.find({
            actName: regex
        }).select('actName sectionNumber content').limit(20).lean();

        if (results.length > 0) {
            // We found the act exists in our DB. Score each section by keyword overlap.
            if (keywords.length === 0) return results[0];

            let bestMatch = results[0];
            let bestScore = 0;

            for (const result of results) {
                const contentLower = result.content.toLowerCase();
                let score = 0;
                for (const kw of keywords) {
                    if (contentLower.includes(kw)) score++;
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = result;
                }
            }

            return bestMatch;
        }
    }

    return null;
}

/**
 * Compute a basic text similarity score between what the LLM claims
 * a section says vs what it actually says in the database.
 * Uses Jaccard similarity on word sets (simple but effective).
 */
function computeTextSimilarity(llmClaim, actualText) {
    if (!llmClaim || !actualText) return 0;

    const tokenize = (text) => {
        return new Set(
            text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 2) // Ignore tiny words
        );
    };

    const setA = tokenize(llmClaim);
    const setB = tokenize(actualText.substring(0, 2000)); // Cap at 2000 chars

    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const word of setA) {
        if (setB.has(word)) intersection++;
    }

    // Instead of Jaccard (intersection / union), which structurally fails when comparing 
    // a short 5-word summary against a 500-word statute, we use Overlap Percentage 
    // (intersection / summary size). If all summary words appear in the statute, it's 100%.
    return Math.round((intersection / setA.size) * 100);
}

// ── Main Verification Pipeline ───────────────────────────────────────────────

/**
 * Verify all citations in a clause's possible_law_references.
 * Returns an enriched array with verification metadata.
 */
async function verifyCitations(lawRefs) {
    const citations = extractCitationsFromRefs(lawRefs);
    const verifiedRefs = [];
    let verifiedCount = 0;
    let unverifiedCount = 0;
    let notFoundCount = 0;

    for (const citation of citations) {
        // Skip non-statute references (case law, generic "OTHER")
        if (citation.act_key === 'CASE_LAW' || citation.act_key === 'OTHER') {
            verifiedRefs.push({
                ...citation,
                verification_status: 'not_applicable',
                verification_note: 'Case law and general references are not verified against the statute database.',
            });
            continue;
        }

        // If we couldn't parse a section number, try keyword-based fallback
        if (!citation.parsedSection) {
            const fallbackStatute = await lookupStatuteByKeywords(citation.act_key, citation.searchKeywords);

            if (fallbackStatute) {
                const isVerifiedFallback = await semanticVerifier.verifySemanticEquivalence(fallbackStatute.content, citation.reason);
                const scoreDisplay = isVerifiedFallback ? 100 : 0; // Or fetch real score if exported
                
                if (isVerifiedFallback) {
                    verifiedCount++;
                    verifiedRefs.push({
                        ...citation,
                        verification_status: 'verified',
                        verification_note: `✅ Act verified in database (${fallbackStatute.actName}). Best matching section: ${fallbackStatute.sectionNumber}. Semantic Equivalence Confirmed.`,
                        verified_act_name: fallbackStatute.actName,
                        verified_section: fallbackStatute.sectionNumber,
                        similarity_score: scoreDisplay,
                    });
                } else {
                    unverifiedCount++;
                    verifiedRefs.push({
                        ...citation,
                        verification_status: 'misquoted',
                        verification_note: `⚠️ The Act exists, but Semantic Verification Failed (Hallucination detected).`,
                        verified_act_name: fallbackStatute.actName,
                        verified_section: fallbackStatute.sectionNumber,
                        similarity_score: scoreDisplay,
                    });
                }
            } else {
                notFoundCount++;
                verifiedRefs.push({
                    ...citation,
                    verification_status: 'not_found',
                    verification_note: `⚠️ ${citation.act_name} was not found in LexGuard's statute database. This act may not have been ingested yet.`,
                });
            }
            continue;
        }

        // Look it up in the database
        const statute = await lookupStatute(citation.parsedSection, citation.act_name, citation.reason);

        if (!statute) {
            notFoundCount++;
            verifiedRefs.push({
                ...citation,
                verification_status: 'not_found',
                verification_note: `⚠️ ${citation.parsedSection} was not found in LexGuard's statute database. This citation may be hallucinated or refer to a statute not yet ingested.`,
            });
            continue;
        }

        // Section exists!
        // Run Dense Semantic Verification (Cross-Encoder)
        const isVerified = await semanticVerifier.verifySemanticEquivalence(statute.content, citation.reason);
        const scoreDisplay = isVerified ? 100 : 0;

        if (isVerified) {
            verifiedCount++;
            verifiedRefs.push({
                ...citation,
                verification_status: 'verified',
                verification_note: `✅ Verified against ${statute.actName}, ${statute.sectionNumber}. Semantic Match Confirmed.`,
                verified_act_name: statute.actName,
                verified_section: statute.sectionNumber,
                similarity_score: scoreDisplay,
                statute_summary: extractStatuteSummary(statute.content),
            });
        } else {
            unverifiedCount++;
            verifiedRefs.push({
                ...citation,
                verification_status: 'misquoted',
                verification_note: `⚠️ Semantic Verification Failed. LLM reasoning hallucinates the statute's actual material effect.`,
                verified_act_name: statute.actName,
                verified_section: statute.sectionNumber,
                similarity_score: scoreDisplay,
            });
        }
    }

    // Compute overall citation accuracy for this clause using a weighted scoring model:
    // - strong: 1.0 (verified authority)
    // - weak: 0.75 (case law / other references)
    // - unverifiable: 0.15 (section not found in the DB)
    // - hallucinated: -0.5 (hallucinated / misquoted claim)
    let weightedSum = 0;
    for (const ref of verifiedRefs) {
        const confidence = gradeCitationConfidence(ref.verification_status, ref.similarity_score);
        if (confidence === 'strong') weightedSum += 1.0;
        else if (confidence === 'weak') weightedSum += 0.75;
        else if (confidence === 'unverifiable') weightedSum += 0.15;
        else if (confidence === 'hallucinated') weightedSum += -0.5;
    }
    const citationAccuracy = citations.length > 0
        ? Math.max(0, Math.min(100, Math.round((weightedSum / citations.length) * 100)))
        : 100; // No checkable citations = 100% (nothing to fail)

    return {
        verifiedRefs,
        citationAccuracy,
        stats: {
            verified: verifiedCount,
            misquoted: unverifiedCount,
            not_found: notFoundCount,
            total: citations.length,
        },
    };
}

// ── Contract-Level Orchestrator ──────────────────────────────────────────────

/**
 * Run citation verification for all clauses of a contract.
 * Updates each clause with verification metadata.
 */
async function verifyCitationsForContract(contractId) {
    const clauses = await Clause.find({
        contractId,
        'possible_law_references.0': { $exists: true }, // Only clauses with citations
    }).select('_id possible_law_references risk_level risk_score compliance_risk_level human_review_strongly_recommended risk_reasons reasons explanatory_note');

    if (clauses.length === 0) {
        console.log(`[Citation Verifier] No citations to verify for contract ${contractId}.`);
        return { totalClauses: 0, avgAccuracy: 100 };
    }

    let totalAccuracy = 0;
    let totalNotFound = 0;
    let totalVerified = 0;
    let countStrong = 0;
    let countWeak = 0;
    let countHallucinated = 0;
    let countUnverifiable = 0;
    const bulkOps = [];

    for (const clause of clauses) {
        const { verifiedRefs, citationAccuracy, stats } = await verifyCitations(clause.possible_law_references);

        totalAccuracy += citationAccuracy;
        totalNotFound += stats.not_found;
        totalVerified += stats.verified;

        let hasInvalidCitation = false;
        let invalidReasons = [];

        // Strip the parsed helper fields before saving, and normalize format
        const cleanedRefs = verifiedRefs.map(ref => {
            const confidence = gradeCitationConfidence(ref.verification_status, ref.similarity_score);
            if (confidence === 'strong') countStrong++;
            else if (confidence === 'weak') countWeak++;
            else if (confidence === 'hallucinated') countHallucinated++;
            else if (confidence === 'unverifiable') countUnverifiable++;

            if (ref.verification_status === 'not_found') {
                hasInvalidCitation = true;
                const secHintCleaned = normalizeCitationFormat(ref.section_hint, ref.verified_act_name || ref.act_name);
                invalidReasons.push(`Contains reference to nonexistent or uningested statute/section: "${secHintCleaned}".`);
            } else if (confidence === 'hallucinated') {
                hasInvalidCitation = true;
                const secHintCleaned = normalizeCitationFormat(ref.section_hint, ref.verified_act_name || ref.act_name);
                invalidReasons.push(`Statute interpretation warning: The clause cites "${secHintCleaned}" but semantic verification shows its actual legal scope is misquoted or does not support this claim.`);
            }

            return {
                act_key: ref.act_key,
                act_name: ref.verified_act_name || ref.act_name,
                section_hint: normalizeCitationFormat(ref.section_hint, ref.verified_act_name || ref.act_name),
                reason: ref.reason,
                reference_url: ref.reference_url,
                verification_status: ref.verification_status,
                verification_note: ref.verification_note,
                citation_confidence: confidence,
                ...(ref.statute_summary && { statute_summary: ref.statute_summary }),
            };
        });

        const updates = {
            possible_law_references: cleanedRefs,
            citation_accuracy: citationAccuracy,
        };

        if (hasInvalidCitation) {
            const RISK_PRIORITY = { critical: 4, high: 3, medium: 2, low: 1, null: 0 };
            const currentRisk = clause.risk_level || 'low';
            if (RISK_PRIORITY[currentRisk] < RISK_PRIORITY['high']) {
                updates.risk_level = 'high';
                updates.risk_score = 8;
            }
            updates.compliance_risk_level = 'high';
            updates.human_review_strongly_recommended = true;

            // Merge risk reasons
            let newRiskReasons = [...(clause.risk_reasons || [])];
            for (const reason of invalidReasons) {
                if (!newRiskReasons.includes(reason)) {
                    newRiskReasons.push(reason);
                }
            }
            updates.risk_reasons = newRiskReasons;

            let newReasons = [...(clause.reasons || [])];
            for (const reason of invalidReasons) {
                if (!newReasons.includes(reason)) {
                    newReasons.push(reason);
                }
            }
            updates.reasons = newReasons;

            // Update explanatory note
            const originalNote = clause.explanatory_note && clause.explanatory_note !== 'Compliant.' && clause.explanatory_note !== 'No significant compliance issues flagged.'
                ? clause.explanatory_note
                : '';
            updates.explanatory_note = (originalNote ? originalNote + ' ' : '') + 
                `[Compliance Alert] ${invalidReasons.join(' ')}`;
        }

        bulkOps.push({
            updateOne: {
                filter: { _id: clause._id },
                update: {
                    $set: updates,
                },
            },
        });
    }

    if (bulkOps.length > 0) {
        await Clause.bulkWrite(bulkOps);
    }

    const avgAccuracy = Math.round(totalAccuracy / clauses.length);

    // Persist contract-level citation stats
    try {
        const totalCitationsCount = clauses.reduce((sum, c) => sum + (c.possible_law_references?.length || 0), 0);
        const hallucinationRate = totalCitationsCount > 0 ? Math.round((countHallucinated / totalCitationsCount) * 100) : 0;

        await Contract.findByIdAndUpdate(contractId, {
            $set: {
                'citationStats.totalCitations': totalCitationsCount,
                'citationStats.verified': totalVerified,
                'citationStats.notFound': totalNotFound,
                'citationStats.avgAccuracy': avgAccuracy,
                'citationStats.strong': countStrong,
                'citationStats.weak': countWeak,
                'citationStats.hallucinated': countHallucinated,
                'citationStats.unverifiable': countUnverifiable,
                'citationStats.hallucinationRate': hallucinationRate,
            }
        });
    } catch (statsErr) {
        console.warn(`⚠️ [Citation Verifier] Failed to persist citation stats: ${statsErr.message}`);
    }

    console.log(
        `✅ [Citation Verifier] Contract ${contractId}: ` +
        `${clauses.length} clauses checked, ${totalVerified} citations verified, ` +
        `${totalNotFound} not found, avg accuracy: ${avgAccuracy}%`
    );

    return { totalClauses: clauses.length, avgAccuracy, totalVerified, totalNotFound };
}

module.exports = { verifyCitations, verifyCitationsForContract, gradeCitationConfidence };
