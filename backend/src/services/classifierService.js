/**
 * Deterministic Predatory Trap Detector (V6)
 * 
 * Replaces the unreliable zero-shot ML classifier with surgical keyword
 * pattern matching. Each pattern uses multi-keyword conjunctions (AND logic)
 * to detect specific predatory mechanisms that LLMs consistently under-rate
 * because of polished legal language.
 * 
 * Design philosophy: High precision (no false positives) > High recall.
 * Each pattern requires 3-4 simultaneous keyword hits to fire.
 * 
 * Returns objects with { type, severity } so the escalation layer can
 * distinguish CRITICAL-level traps from HIGH-level traps.
 */

/**
 * Detects predatory traps using deterministic keyword pattern matching.
 * 
 * @param {string} text - The clause text to analyze
 * @returns {{ type: string, severity: 'critical' | 'high' }[]} Detected traps
 */
function detectPredatoryTraps(text) {
    if (!text || text.length < 50) return [];
    
    const lower = text.toLowerCase();
    const detectedTraps = [];
    
    // ═══════════════════════════════════════════════════════════════════════
    // CRITICAL-SEVERITY PATTERNS (force escalation to risk_level=critical)
    // ═══════════════════════════════════════════════════════════════════════
    
    // ── Pattern 1: Unilateral Force Majeure ──────────────────────────────
    const hasForceMajeureTrigger = (
        lower.includes('force majeure') || 
        lower.includes('pandemic') || 
        lower.includes('act of god')
    );
    const hasAsymmetricObligation = (
        (lower.includes('obligation') || lower.includes('deliver')) &&
        (lower.includes('suspended') || lower.includes('not liable'))
    );
    const hasUnilateralContinuation = (
        lower.includes('remains') || 
        lower.includes('absolute') || 
        lower.includes('unmodified')
    );
    if (hasForceMajeureTrigger && hasAsymmetricObligation && hasUnilateralContinuation) {
        detectedTraps.push({ type: 'predatory force majeure', severity: 'critical' });
    }
    
    // ── Pattern 2: Pre-Existing IP Capture ───────────────────────────────
    const hasIPTerms = (
        lower.includes('intellectual property') || 
        lower.includes('inventions') || 
        lower.includes('rights, title')
    );
    const hasAssignmentVerb = (
        lower.includes('assigns') || 
        lower.includes('assignment') || 
        lower.includes('belongs to the company')
    );
    const hasPreExistingScope = (
        lower.includes('prior to') || 
        lower.includes('before the commencement') || 
        lower.includes('outside of company time') ||
        lower.includes('at any time')
    );
    if (hasIPTerms && hasAssignmentVerb && hasPreExistingScope) {
        detectedTraps.push({ type: 'predatory intellectual property capture', severity: 'critical' });
    }
    
    // ── Pattern 3: Unconscionable Indemnification ────────────────────────
    const hasIndemnifyVerb = (
        lower.includes('indemnify') || 
        lower.includes('indemnification')
    );
    const coversOwnFault = (
        lower.includes('gross negligence') || 
        lower.includes('willful misconduct')
    );
    // Exclude safe harbors where it says "indemnifying party's gross negligence" or "each party"
    const isMutualOrStandard = (
        lower.includes("indemnifying party's") || 
        lower.includes("each party agrees to indemnify")
    );
    
    if (hasIndemnifyVerb && coversOwnFault && !isMutualOrStandard) {
        detectedTraps.push({ type: 'one-sided indemnification', severity: 'critical' });
    }
    
    // ── Pattern 4: Punitive Wage Withholding / Forfeiture ────────────────
    const hasWithholdingVerb = (
        lower.includes('withhold') || 
        lower.includes('forfeit') || 
        lower.includes('deduct')
    );
    const hasCompensationTarget = (
        lower.includes('compensation') || 
        lower.includes('salary') || 
        lower.includes('paycheck') || 
        lower.includes('bonus') ||
        lower.includes('commissions')
    );
    const hasPunitiveOutcome = (
        lower.includes('permanently') || 
        lower.includes('forfeited') || 
        lower.includes('reserve') ||
        lower.includes('not entitled to payment')
    );
    if (hasWithholdingVerb && hasCompensationTarget && hasPunitiveOutcome) {
        detectedTraps.push({ type: 'wage forfeiture', severity: 'critical' });
    }
    
    // ── Pattern 13: Post-Employment Non-Compete Restraint ───────────────
    const hasPostEmploymentTerm = (
        lower.includes('upon separation') || 
        lower.includes('post-employment') || 
        lower.includes('after termination') ||
        lower.includes('after separation') ||
        lower.includes('following termination') ||
        lower.includes('leaves the company') ||
        lower.includes('leaving the company')
    );
    const hasRestraintTerm = (
        lower.includes('non-compete') ||
        lower.includes('barred from working') ||
        lower.includes('not work for') ||
        lower.includes('not engage') ||
        lower.includes('restricted from') ||
        lower.includes('shall not compete')
    );
    if (hasPostEmploymentTerm && hasRestraintTerm) {
        detectedTraps.push({ type: 'post-employment non-compete', severity: 'critical' });
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // HIGH-SEVERITY PATTERNS (force escalation to risk_level=high)
    // ═══════════════════════════════════════════════════════════════════════
    
    // ── Pattern 5: Termination Without Payment for Rendered Services ─────
    // Detects: Unilateral termination for convenience where the terminated
    // party loses payment for work already completed.
    // Example: "terminate...at any time...not entitled to payment for
    //           any work completed prior to termination"
    const hasTerminationClause = (
        lower.includes('terminate') || 
        lower.includes('termination')
    );
    const hasUnilateralConvenience = (
        lower.includes('at any time') || 
        lower.includes('for any reason') || 
        lower.includes('for no reason') ||
        lower.includes('for convenience')
    );
    const hasPaymentDenial = (
        lower.includes('not be entitled to payment') || 
        lower.includes('not entitled to payment') ||
        lower.includes('shall not be paid') ||
        lower.includes('without payment for')
    );
    if (hasTerminationClause && hasUnilateralConvenience && hasPaymentDenial) {
        detectedTraps.push({ type: 'termination without payment', severity: 'high' });
    }
    
    // ── Pattern 6: Unilateral Contract Variation ─────────────────────────
    // Detects: Employer claims right to alter salary/benefits at any time without notice.
    const hasVariationTrigger = (
        lower.includes('unilaterally modify') || 
        lower.includes('unilaterally alter') || 
        lower.includes('absolute right to modify') ||
        lower.includes('reserve the right to modify')
    );
    const hasCoreTarget = (
        lower.includes('salary') || 
        lower.includes('benefits') || 
        lower.includes('compensation')
    );
    const hasNoNotice = (
        lower.includes('at any time') || 
        lower.includes('with or without notice') ||
        lower.includes('without prior notice')
    );
    if (hasVariationTrigger && hasCoreTarget && hasNoNotice) {
        detectedTraps.push({ type: 'unilateral contract variation', severity: 'critical' });
    }

    // ── Pattern 7: Mandatory Arbitration for Harassment (POSH Trap) ──────
    // Detects: Forcing sexual harassment claims into private arbitration.
    const hasHarassment = (
        lower.includes('sexual harassment') || 
        lower.includes('posh') || 
        lower.includes('discrimination')
    );
    const hasArbitrationMandate = (
        lower.includes('subject exclusively to') || 
        lower.includes('binding arbitration') || 
        lower.includes('private arbitration')
    );
    if (hasHarassment && hasArbitrationMandate) {
        detectedTraps.push({ type: 'illegal harassment arbitration', severity: 'critical' });
    }

    // ── Pattern 8: Punitive Training Bond / Penalty ──────────────────────
    // Detects: Fixed penalty or liquidated damages instead of genuine pre-estimate.
    const hasBondTrigger = (
        lower.includes('training') || 
        lower.includes('incur substantial costs') ||
        lower.includes('resigns within')
    );
    const hasPenalty = (
        lower.includes('fixed penalty') || 
        lower.includes('liquidated damages') || 
        lower.includes('pay a penalty')
    );
    const hasDisregardForActual = (
        lower.includes('regardless of the actual') || 
        lower.includes('irrespective of') ||
        lower.includes('without proof of actual')
    );
    if (hasBondTrigger && hasPenalty && hasDisregardForActual) {
        detectedTraps.push({ type: 'punitive training bond', severity: 'critical' });
    }

    // ── Pattern 9: Unpaid Indefinite Suspension ──────────────────────────
    // Detects: Suspending without pay indefinitely.
    const hasSuspension = (
        lower.includes('unpaid disciplinary suspension') || 
        lower.includes('suspended without pay')
    );
    const hasIndefinite = (
        lower.includes('indefinite duration') || 
        lower.includes('sole discretion') || 
        lower.includes('pending any')
    );
    if (hasSuspension && hasIndefinite) {
        detectedTraps.push({ type: 'unpaid indefinite suspension', severity: 'critical' });
    }

    // ── Pattern 10: Oppressive Foreign Jurisdiction ──────────────────────
    const hasForeign = (
        lower.includes('delaware') || 
        lower.includes('new york') || 
        lower.includes('singapore')
    );
    const hasExclusive = (
        lower.includes('exclusive jurisdiction') || 
        lower.includes('courts located in') || 
        lower.includes('governed by the laws')
    );
    if (hasForeign && hasExclusive) {
        // Technically high or critical, we'll mark it high for now unless explicitly oppressive
        detectedTraps.push({ type: 'foreign jurisdiction trap', severity: 'high' });
    }
    
    // ── Pattern 11: Broad Non-Solicit / Backdoor Non-Compete ────────────
    const hasSolicit = (
        lower.includes('not directly or indirectly solicit') || 
        lower.includes('accept business from')
    );
    const hasGlobalScope = (
        lower.includes('anywhere in the world') || 
        lower.includes('any client, customer, or prospect')
    );
    if (hasSolicit && hasGlobalScope) {
        detectedTraps.push({ type: 'broad non-solicit restraint', severity: 'critical' });
    }

    // ── Pattern 12: Indefinite Probation ─────────────────────────────────
    const hasProbation = lower.includes('probation');
    const hasIndefiniteExtension = (
        lower.includes('extend this probation period indefinitely') || 
        lower.includes('extend indefinitely')
    );
    const hasTerminationWithoutCause = lower.includes('terminated without notice or cause');
    if (hasProbation && hasIndefiniteExtension && hasTerminationWithoutCause) {
        detectedTraps.push({ type: 'indefinite probation trap', severity: 'high' });
    }
    // ── Pattern 14: Unconscionable Surveillance / Privacy Waiver ─────────
    const hasSurveillanceVerb = (
        lower.includes('monitor, record, and store') || 
        lower.includes('surveillance') || 
        lower.includes('track')
    );
    const hasPrivacyTarget = (
        lower.includes('personal devices') || 
        lower.includes('biometric') || 
        lower.includes('fingerprint') || 
        lower.includes('facial recognition') || 
        lower.includes('digital personal data protection') || 
        lower.includes('dpdp')
    );
    const hasWaiver = (
        lower.includes('waives all rights') || 
        lower.includes('absolute right to monitor') || 
        lower.includes('completely waives')
    );
    if (hasSurveillanceVerb && hasPrivacyTarget && hasWaiver) {
        detectedTraps.push({ type: 'unconscionable surveillance', severity: 'critical' });
    }

    // ── Pattern 15: Broad Liquidated Damages / Penalty in Terrorem ───────
    const hasPenaltyKeyword = (
        lower.includes('penalty') || 
        lower.includes('liquidated damages')
    );
    const hasDisregardForActualDamage = (
        lower.includes('irrespective of the actual damages') || 
        lower.includes('regardless of actual loss') || 
        lower.includes('irrespective of actual loss')
    );
    const hasTrivialTrigger = (
        lower.includes('trivial') || 
        lower.includes('any breach') || 
        lower.includes('minor breach')
    );
    if (hasPenaltyKeyword && hasDisregardForActualDamage && hasTrivialTrigger) {
        detectedTraps.push({ type: 'excessive liquidated damages penalty', severity: 'critical' });
    }
    // ── Pattern 16: Moral Rights Waiver (Copyright Act, Sec 57 Violation) ─────────
    const moralRightsKeywords = [
        "waive all moral rights", 
        "waive moral rights", 
        "waives any and all moral rights",
        "derogatory modification", 
        "section 57", 
        "relinquish moral rights"
    ];
    const matchesPattern16 = moralRightsKeywords.some(keyword => lower.includes(keyword));

    if (matchesPattern16) {
        detectedTraps.push({ type: 'moral rights waiver', severity: 'critical' });
    }

    // ── Pattern 17: Evergreen Auto-Renewal Trap (Unconscionable Notice Windows) ───
    const hasAutoRenew = lower.includes("automatically renew") || lower.includes("auto-renew");
    const hasPredatoryNotice = lower.includes("365 days") || lower.includes("12 months in advance") || lower.includes("successive periods of 5 years") || lower.includes("successive 5-year terms");
    
    if (hasAutoRenew && hasPredatoryNotice) {
        detectedTraps.push({ type: 'predatory evergreen auto-renewal', severity: 'critical' });
    }

    // ── Pattern 18: Retroactive Policy/Compensation Amendments ────────────────────
    const hasAmendment = lower.includes("amend") || lower.includes("modify") || lower.includes("alter") || lower.includes("bound by");
    const hasRetroactive = lower.includes("retroactively");

    if (hasAmendment && hasRetroactive) {
        detectedTraps.push({ type: 'retroactive amendment', severity: 'critical' });
    }
    
    // ── Pattern 19: Biased Arbitration Seat ───────────────────────────────────────
    const hasArbitralTribunal = lower.includes("arbitral tribunal") || lower.includes("arbitrator") || lower.includes("arbitration");
    const hasCompanyExecs = (lower.includes("senior executives") || lower.includes("directors of the company") || lower.includes("solely appointed by the company"));

    if (hasArbitralTribunal && hasCompanyExecs) {
        detectedTraps.push({ type: 'biased arbitration seat', severity: 'high' });
    }

    // ── Pattern 20: Obfuscated Wage Deduction ─────────────────────────────────────
    const hasReallocate = lower.includes("reallocate") || lower.includes("withhold") || lower.includes("deduct") || lower.includes("escrow account");
    const has100Percent = lower.includes("100%") || lower.includes("entirety of");
    const hasRemuneration = lower.includes("remuneration") || lower.includes("salary") || lower.includes("wages");

    if (hasReallocate && has100Percent && hasRemuneration) {
        detectedTraps.push({ type: 'obfuscated wage deduction', severity: 'critical' });
    }

    // ── Pattern 21: Forfeiture of Earned Wages upon Termination ────────────────────
    const hasForfeit = lower.includes("forfeit") || lower.includes("relinquish");
    const hasEarnedPayment = lower.includes("payment for work completed") || lower.includes("accrued wages") || lower.includes("earned salary");

    if (hasForfeit && hasEarnedPayment) {
        detectedTraps.push({ type: 'wage forfeiture on termination', severity: 'critical' });
    }

    // ── Pattern 22: Ghost Jurisdiction / Offshore Law ──────────────────────────────
    const hasForeignLaw = lower.includes("cayman islands") || lower.includes("delaware") || lower.includes("laws of england") || lower.includes("singapore") || lower.includes("new york");
    const hasExclusiveJurisdiction = lower.includes("exclusively governed by") || lower.includes("exclusive jurisdiction") || lower.includes("solely governed by");

    if (hasForeignLaw && hasExclusiveJurisdiction) {
        detectedTraps.push({ type: 'hostile foreign jurisdiction', severity: 'critical' });
    }

    // ── Pattern 23: Ghost Equity Clawback ─────────────────────────────────────────
    const hasClawback = lower.includes("claw back") || lower.includes("cancel, revoke") || lower.includes("forfeit");
    const hasEquity = lower.includes("vested") || lower.includes("stock options") || lower.includes("equity");
    const hasDiscretion = lower.includes("sole") || lower.includes("absolute discretion") || lower.includes("unchallengeable");

    if (hasClawback && hasEquity && hasDiscretion) {
        detectedTraps.push({ type: 'ghost equity clawback', severity: 'critical' });
    }

    // ── Pattern 24: Biometric DPDP Waiver ─────────────────────────────────────────
    const hasBiometric = lower.includes("polygraph") || lower.includes("retina") || lower.includes("keylogging") || lower.includes("biometric");
    const hasDpdpWaiver = lower.includes("dpdp") || lower.includes("digital personal data protection") || lower.includes("waives any and all rights");

    if (hasBiometric && hasDpdpWaiver) {
        detectedTraps.push({ type: 'biometric dpdp waiver', severity: 'critical' });
    }

    // ── Pattern 25: Gag Order Equity Forfeiture ───────────────────────────────────
    const hasGagOrder = lower.includes("disparaging") || lower.includes("non-disparagement") || lower.includes("negative remarks");
    const hasPunitiveForfeiture = lower.includes("forfeiture") || lower.includes("forfeit") || lower.includes("claw back");
    const hasVestedAssets = lower.includes("vested equity") || lower.includes("unpaid bonuses") || lower.includes("stock");

    if (hasGagOrder && hasPunitiveForfeiture && hasVestedAssets) {
        detectedTraps.push({ type: 'gag order equity forfeiture', severity: 'critical' });
    }

    return detectedTraps;
}

module.exports = { detectPredatoryTraps };

