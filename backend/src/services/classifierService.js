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
    if (hasIndemnifyVerb && coversOwnFault) {
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
    
    return detectedTraps;
}

module.exports = { detectPredatoryTraps };

