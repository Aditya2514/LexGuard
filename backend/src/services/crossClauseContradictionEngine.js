/**
 * Cross-Clause Contradiction Engine (Layer 2 + Layer 3)
 * 
 * Layer 2: Deterministic rules for quantitative contradictions (zero LLM)
 * Layer 3: Semantic pattern matching for qualitative contradictions (zero LLM)
 * 
 * Takes a FactTable from deterministicFactExtractor and runs contradiction
 * rules across all clause pairs.
 */

const { durationToDays } = require('./deterministicFactExtractor');

// ── Severity Defaults (per user-approved tiering) ──────────────────────────
const SEVERITY = {
  FEE_SUM_MISMATCH:        'critical',
  PAYMENT_INCONSISTENCY:   'critical',
  LIABILITY_CONTRADICTION:  'critical',
  OWNERSHIP_CONTRADICTION:  'critical',
  JURISDICTION_CONFLICT:    'high',
  DATE_CONFLICT:            'high',
  ACCEPTANCE_WINDOW:        'high',
  NOTICE_CONFLICT:          'medium',
  RETENTION_CONFLICT:       'high',
  RECORDKEEPING_CONFLICT:   'high',
  DURATION_CONFLICT:        'high',
  AUTO_RENEWAL_VS_FIXED:    'high',
  PRECEDENCE_CONFLICT:      'high',
  TERMINATION_PAYMENT:      'critical',
  INTEREST_CONTRADICTION:   'high',
};

/**
 * Run all contradiction rules against the extracted FactTable.
 * 
 * @param {{ facts: Array, categorizedFacts: Object }} factTable
 * @param {{ segmentIndex: number, rawText: string }[]} clauses - Original clauses for context
 * @returns {{ findings: Array }}
 */
function detectContradictions(factTable, clauses) {
  const findings = [];
  const { facts, categorizedFacts } = factTable;

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 2: DETERMINISTIC QUANTITATIVE RULES
  // ════════════════════════════════════════════════════════════════════════════

  // ── Rule 1: FEE_SUM_MISMATCH ─────────────────────────────────────────────
  // If we find a "total fee" currency value and multiple "milestone" currency
  // values, check that milestones sum to the total.
  const totalFeeFacts = facts.filter(f =>
    f.type === 'currency' && f.categories?.some(c => c === 'total_fee')
  );
  const milestoneFacts = facts.filter(f =>
    f.type === 'currency' && f.categories?.some(c => c === 'milestone_fee')
  );

  if (totalFeeFacts.length > 0 && milestoneFacts.length >= 1) {
    const totalFee = totalFeeFacts[0].value;
    // Exclude the total fee itself from the milestone list (it may share the clause).
    // Guard: require ALL THREE conditions to match to avoid excluding legitimate
    // milestone amounts that coincidentally equal the total value but are in different
    // clauses or have different raw text (e.g. two separate INR 50,00,000 references).
    const actualMilestones = milestoneFacts.filter(f =>
      !(f.clauseIndex === totalFeeFacts[0].clauseIndex &&
        f.value === totalFee &&
        f.raw === totalFeeFacts[0].raw)
    );

    if (actualMilestones.length >= 1) {
      let milestoneSum = actualMilestones.reduce((sum, f) => sum + f.value, 0);

      if (Math.abs(milestoneSum - totalFee) > 0.01) {
        // Additional check: see if the milestones are periodic installments.
        // If so, multiply by the appropriate period (12 for monthly, 4 for quarterly).
        let adjustedSum = 0;
        for (const f of actualMilestones) {
          const clause = clauses.find(c => c.segmentIndex === f.clauseIndex);
          let multiplier = 1;
          if (clause) {
            const text = clause.rawText.toLowerCase();
            if (/monthly/i.test(text)) {
              multiplier = 12;
            } else if (/quarterly/i.test(text)) {
              multiplier = 4;
            } else if (/bi-weekly/i.test(text)) {
              multiplier = 26;
            }
          }
          adjustedSum += f.value * multiplier;
        }
        if (Math.abs(adjustedSum - totalFee) > 0.01) {
          const currUnit = totalFeeFacts[0].unit || 'USD';
          findings.push({
            rule: 'FEE_SUM_MISMATCH',
            severity: SEVERITY.FEE_SUM_MISMATCH,
            title: 'Contract Value vs Milestone Payment Mismatch',
            reason: `The stated total contract value is ${formatCurrency(totalFee, currUnit)} (Clause ${totalFeeFacts[0].clauseIndex + 1}), but the milestone payments sum to ${formatCurrency(adjustedSum, currUnit)} (${actualMilestones.map(f => formatCurrency(f.value, currUnit)).join(' + ')}). This is a ${formatCurrency(Math.abs(adjustedSum - totalFee), currUnit)} discrepancy.`,
            clauseRefs: [...new Set([totalFeeFacts[0].clauseIndex, ...actualMilestones.map(f => f.clauseIndex)])],
          });
        }
      }
    }
  }

  // ── Rule 1b: Fee Sum Mismatch (Broad) ────────────────────────────────────
  // Even without explicit category tagging, look for fee patterns in the text.
  // Also covers the gap where Rule 1 found categorized facts but actualMilestones
  // was empty after the exclusion filter (e.g. only 1 milestone that matched total).
  // Guard: only run if total and milestone are in DIFFERENT clauses.
  const rule1Fired = findings.some(f => f.rule === 'FEE_SUM_MISMATCH');
  if (!rule1Fired && (totalFeeFacts.length === 0 || milestoneFacts.length === 0)) {
    const allCurrencies = categorizedFacts.currency || [];
    const potentialTotals = [];
    const potentialMilestones = [];
    
    for (const curr of allCurrencies) {
      const clause = clauses.find(c => c.segmentIndex === curr.clauseIndex);
      if (!clause) continue;
      const text = clause.rawText.toLowerCase();
      if (/(?:total|aggregate|contract)\s+(?:value|fee|price|consideration|amount)/i.test(text)) {
        potentialTotals.push(curr);
      }
      if (/(?:milestone|phase|tranche|installment|stage)/i.test(text)) {
        potentialMilestones.push(curr);
      }
    }

    // Guard: require milestones from different clauses than the total
    const totalClause = potentialTotals.length > 0 ? potentialTotals[0].clauseIndex : -1;
    const crossClauseMilestones = potentialMilestones.filter(m => m.clauseIndex !== totalClause);

    if (potentialTotals.length > 0 && crossClauseMilestones.length >= 2) {
      const totalFee = potentialTotals[0].value;
      const milestoneSum = crossClauseMilestones.reduce((sum, f) => sum + f.value, 0);
      if (Math.abs(milestoneSum - totalFee) > 0.01) {
        const currUnit = potentialTotals[0].unit || 'USD';
        findings.push({
          rule: 'FEE_SUM_MISMATCH',
          severity: SEVERITY.FEE_SUM_MISMATCH,
          title: 'Contract Value vs Milestone Payment Mismatch',
          reason: `The stated total contract value is ${formatCurrency(totalFee, currUnit)} (Clause ${potentialTotals[0].clauseIndex + 1}), but the milestone payments sum to ${formatCurrency(milestoneSum, currUnit)}. This is a ${formatCurrency(Math.abs(milestoneSum - totalFee), currUnit)} discrepancy that must be reconciled.`,
          clauseRefs: [potentialTotals[0].clauseIndex, ...new Set(crossClauseMilestones.map(f => f.clauseIndex))],
        });
      }
    }
  }

  // ── Rule 2: ACCEPTANCE_WINDOW ─────────────────────────────────────────────
  // If review/testing period > deemed acceptance period, it's a logical impossibility.
  const acceptanceFacts = facts.filter(f =>
    f.type === 'duration' && f.categories?.some(c => c === 'acceptance_period')
  );
  const deemedFacts = facts.filter(f =>
    f.type === 'duration' && f.categories?.some(c => c === 'deemed_acceptance')
  );

  if (acceptanceFacts.length > 0 && deemedFacts.length > 0) {
    for (const acc of acceptanceFacts) {
      for (const deemed of deemedFacts) {
        if (acc.days > deemed.days) {
          findings.push({
            rule: 'ACCEPTANCE_WINDOW',
            severity: SEVERITY.ACCEPTANCE_WINDOW,
            title: 'Review Period vs Deemed Acceptance Conflict',
            reason: `The testing/review period is ${acc.value} ${acc.unit} (Clause ${acc.clauseIndex + 1}), but deliverables are deemed accepted after only ${deemed.value} ${deemed.unit} (Clause ${deemed.clauseIndex + 1}). The Client cannot complete testing before acceptance is forced.`,
            clauseRefs: [...new Set([acc.clauseIndex, deemed.clauseIndex])],
          });
        }
      }
    }
  }

  // ── Rule 3: NOTIFICATION_CONFLICT ─────────────────────────────────────────
  // Different notification deadlines for the same type of event
  const noticeFacts = facts.filter(f =>
    f.type === 'duration' && f.categories?.some(c => c === 'security_notice' || c === 'notice_period')
  );
  
  if (noticeFacts.length >= 2) {
    const securityNotices = noticeFacts.filter(f => f.categories?.includes('security_notice'));
    if (securityNotices.length >= 2) {
      const vals = securityNotices.map(f => f.days);
      if (Math.max(...vals) / Math.min(...vals) > 1.5) {
        findings.push({
          rule: 'NOTICE_CONFLICT',
          severity: SEVERITY.NOTICE_CONFLICT,
          title: 'Conflicting Security Notification Deadlines',
          reason: `Multiple security notification deadlines found: ${securityNotices.map(f => `${f.value} ${f.unit} (Clause ${f.clauseIndex + 1})`).join(' vs ')}. These conflicting requirements create compliance ambiguity.`,
          clauseRefs: securityNotices.map(f => f.clauseIndex),
        });
      }
    }
  }

  // ── Rule 4: RETENTION_CONFLICT ────────────────────────────────────────────
  const retentionFacts = facts.filter(f =>
    f.type === 'duration' && f.categories?.some(c => c === 'retention_period')
  );

  if (retentionFacts.length >= 2) {
    // Helper to extract specific retention subjects
    const getRetentionSubject = (text) => {
      const lower = text.toLowerCase();
      const isConfidential = /confidential/i.test(lower);
      const isFinancial = /(?:financial|tax|audit|accounting|invoice|billing|payment)/i.test(lower);
      const isEmail = /(?:email|correspondence|communication|message|logs?|chat)/i.test(lower);
      
      if (isConfidential) return 'confidentiality';
      if (isFinancial) return 'financial';
      if (isEmail) return 'email';
      return 'general';
    };

    let conflictPair = null;
    for (let i = 0; i < retentionFacts.length; i++) {
      for (let j = i + 1; j < retentionFacts.length; j++) {
        const f1 = retentionFacts[i];
        const f2 = retentionFacts[j];
        
        const ratio = Math.max(f1.days, f2.days) / Math.min(f1.days, f2.days);
        if (ratio > 1.5) {
          const t1 = clauses[f1.clauseIndex]?.rawText || '';
          const t2 = clauses[f2.clauseIndex]?.rawText || '';
          const sub1 = getRetentionSubject(t1);
          const sub2 = getRetentionSubject(t2);
          
          if (sub1 === sub2 || sub1 === 'general' || sub2 === 'general') {
            conflictPair = [f1, f2];
            break;
          }
        }
      }
      if (conflictPair) break;
    }

    if (conflictPair) {
      findings.push({
        rule: 'RETENTION_CONFLICT',
        severity: SEVERITY.RETENTION_CONFLICT,
        title: 'Conflicting Record Retention Periods',
        reason: `Multiple record retention periods found: ${conflictPair.map(f => `${f.value} ${f.unit} (Clause ${f.clauseIndex + 1})`).join(' vs ')}. These conflicting requirements create compliance uncertainty.`,
        clauseRefs: conflictPair.map(f => f.clauseIndex),
      });
    }
  }

  // ── Rule 5: JURISDICTION_CONFLICT ─────────────────────────────────────────
  const jurisdictionFacts = categorizedFacts.jurisdiction || [];
  if (jurisdictionFacts.length >= 2) {
    const uniqueJurisdictions = [...new Set(jurisdictionFacts.map(f => f.value))];
    if (uniqueJurisdictions.length >= 2) {
      const clauseIndices = [...new Set(jurisdictionFacts.map(f => f.clauseIndex))];
      findings.push({
        rule: 'JURISDICTION_CONFLICT',
        severity: SEVERITY.JURISDICTION_CONFLICT,
        title: 'Multiple Exclusive Jurisdictions Claimed',
        reason: `The contract references multiple jurisdictions: ${uniqueJurisdictions.join(', ')} across Clauses ${clauseIndices.map(i => i + 1).join(', ')}. If both claim exclusivity, this is an irreconcilable drafting defect.`,
        clauseRefs: clauseIndices,
      });
    }
  }

  // ── Rule 6: LIABILITY_CAP_CONFLICT ────────────────────────────────────────
  const liabilityFacts = facts.filter(f =>
    (f.type === 'currency' || f.type === 'percentage') &&
    f.categories?.some(c => c === 'liability_cap')
  );

  if (liabilityFacts.length >= 2) {
    const clauseIndices = [...new Set(liabilityFacts.map(f => f.clauseIndex))];
    const uniqueValues = [...new Set(liabilityFacts.map(f => f.value))];
    if (uniqueValues.length >= 2) {
      findings.push({
        rule: 'LIABILITY_CONTRADICTION',
        severity: SEVERITY.LIABILITY_CONTRADICTION,
        title: 'Conflicting Liability Cap Provisions',
        reason: `Multiple liability caps found: ${liabilityFacts.map(f => f.type === 'currency' ? formatCurrency(f.value) : f.value + '%').join(', ')} across Clauses ${clauseIndices.map(i => i + 1).join(', ')}. Conflicting caps create material risk allocation ambiguity.`,
        clauseRefs: clauseIndices,
      });
    }
  }

  // ── Rule 7: DATE_CONFLICT ────────────────────────────────────────────────
  const completionDates = facts.filter(f =>
    f.type === 'date' && f.categories?.some(c => c === 'completion_date')
  );
  const deliveryDates = facts.filter(f =>
    f.type === 'date' && f.categories?.some(c => c === 'delivery_date')
  );

  if (completionDates.length > 0 && deliveryDates.length > 0) {
    if (completionDates[0].raw !== deliveryDates[0].raw) {
      findings.push({
        rule: 'DATE_CONFLICT',
        severity: SEVERITY.DATE_CONFLICT,
        title: 'Project Completion Date vs Final Delivery Date Inconsistency',
        reason: `The project completion date (${completionDates[0].raw}, Clause ${completionDates[0].clauseIndex + 1}) differs from the final delivery date (${deliveryDates[0].raw}, Clause ${deliveryDates[0].clauseIndex + 1}). This creates timeline ambiguity.`,
        clauseRefs: [completionDates[0].clauseIndex, deliveryDates[0].clauseIndex],
      });
    }
  }

  // ── Rule 8: AUTO_RENEWAL_VS_FIXED ─────────────────────────────────────────
  const autoRenewalFacts = facts.filter(f => f.type === 'auto_renewal');
  const fixedEndFacts = facts.filter(f => f.type === 'fixed_end_date');

  if (autoRenewalFacts.length > 0 && fixedEndFacts.length > 0) {
    findings.push({
      rule: 'AUTO_RENEWAL_VS_FIXED',
      severity: SEVERITY.AUTO_RENEWAL_VS_FIXED,
      title: 'Auto-Renewal Provision Conflicts with Fixed End Date',
      reason: `The contract contains an auto-renewal provision (Clause ${autoRenewalFacts[0].clauseIndex + 1}) but also specifies a fixed termination/expiry date (Clause ${fixedEndFacts[0].clauseIndex + 1}). These provisions are logically inconsistent.`,
      clauseRefs: [autoRenewalFacts[0].clauseIndex, fixedEndFacts[0].clauseIndex],
    });
  }

  // ── Rule 9: DURATION_CONFLICT (Same Category) ────────────────────────────
  // Look for conflicting durations within the EXACT same semantic category.
  // Guard: only compare durations whose PRIMARY category matches, to avoid
  // cross-matching acceptance periods with notice periods.
  const durationCategories = ['contract_term', 'notice_period'];
  for (const cat of durationCategories) {
    const catDurations = facts.filter(f => {
      if (f.type !== 'duration') return false;
      // The fact must have this category but NOT also belong to a more specific
      // category (acceptance_period, deemed_acceptance, security_notice, retention_period)
      // that would cause cross-matching.
      const cats = f.categories || [];
      const isSpecific = cats.some(c => ['acceptance_period', 'deemed_acceptance', 'security_notice', 'retention_period'].includes(c));
      return cats.includes(cat) && !isSpecific;
    });
    if (catDurations.length >= 2) {
      const clauseIndices = [...new Set(catDurations.map(f => f.clauseIndex))];
      if (clauseIndices.length >= 2) {
        const uniqueDays = [...new Set(catDurations.map(f => f.days))];
        if (uniqueDays.length >= 2 && Math.max(...uniqueDays) / Math.min(...uniqueDays) > 1.5) {
          findings.push({
            rule: 'DURATION_CONFLICT',
            severity: SEVERITY.DURATION_CONFLICT,
            title: `Conflicting ${cat.replace(/_/g, ' ')} Durations`,
            reason: `Multiple ${cat.replace(/_/g, ' ')} durations found: ${catDurations.map(f => `${f.value} ${f.unit} (Clause ${f.clauseIndex + 1})`).join(' vs ')}. This creates ambiguity about the actual contract term.`,
            clauseRefs: clauseIndices,
          });
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LAYER 3: SEMANTIC CONTRADICTION PATTERNS
  // ════════════════════════════════════════════════════════════════════════════

  // ── Rule 10: OWNERSHIP_CONTRADICTION ──────────────────────────────────────
  // Guard: Only flag when BOTH parties claim the SAME asset class.
  // "Client owns Deliverables" + "Vendor retains tools/frameworks" is COMPATIBLE.
  // "Client owns Deliverables" + "Vendor retains Deliverables" is a CONTRADICTION.
  const ownershipFacts = facts.filter(f => f.type === 'ownership');
  const ownershipBySubject = {};
  for (const f of ownershipFacts) {
    if (!ownershipBySubject[f.subject]) ownershipBySubject[f.subject] = [];
    ownershipBySubject[f.subject].push(f);
  }

  for (const [subject, owners] of Object.entries(ownershipBySubject)) {
    // Skip the generic bucket — it catches too many false positives
    if (subject === 'general') continue;
    
    const parties = [...new Set(owners.map(f => f.party))];
    if (parties.length >= 2) {
      const clauseIndices = [...new Set(owners.map(f => f.clauseIndex))];
      
      // Additional guard: check if clauses discuss different asset scopes.
      // "pre-existing", "underlying", "tools", "frameworks" indicate a scoped
      // retention that is compatible with the client owning deliverables.
      // BUT: only suppress if the scoped clause does NOT also claim the
      // contested subject. E.g., "Vendor retains Deliverables, tools, and
      // methodologies" DOES claim deliverables, so it IS a real contradiction.
      const scopedExclusionKeywords = /pre-existing|underlying|background\s+ip|prior\s+work/i;
      const subjectKeyword = subject === 'deliverables' ? /deliverable/i
        : subject === 'ip' ? /intellectual\s+property/i : null;
      
      const hasScoped = owners.some(o => {
        const clause = clauses.find(c => c.segmentIndex === o.clauseIndex);
        if (!clause) return false;
        const text = clause.rawText;
        const isScopedLanguage = scopedExclusionKeywords.test(text);
        // If the clause uses scoped language AND does NOT also claim the
        // contested subject, it's a compatible scoped retention.
        const alsoClaimsSubject = subjectKeyword ? subjectKeyword.test(text) : false;
        // Only treat as scoped (compatible) if it uses scoped language
        // without also claiming the same contested asset class.
        // "tools and frameworks" without "deliverables" = scoped
        // "Deliverables, tools, and methodologies" = NOT scoped (claims deliverables)
        return isScopedLanguage && !alsoClaimsSubject;
      });
      
      if (!hasScoped) {
        const firstClause = clauseIndices[0] + 1;
        const secondClause = clauseIndices[1] !== undefined ? `Clause ${clauseIndices[1] + 1}` : `the same clause`;
        findings.push({
          rule: 'OWNERSHIP_CONTRADICTION',
          severity: SEVERITY.OWNERSHIP_CONTRADICTION,
          title: `Conflicting Ownership of ${capitalize(subject)}`,
          reason: `Clause ${firstClause} assigns ${subject} ownership to ${parties[0]}, but ${secondClause} assigns it to ${parties[1]}. Both parties cannot own the same ${subject}.`,
          clauseRefs: clauseIndices,
        });
      }
    }
  }

  // ── Rule 11: PRECEDENCE_CONFLICT ──────────────────────────────────────────
  // Guard: Do NOT flag when precedence claims are explicitly scoped.
  // "Schedule A prevails for pricing" + "Agreement prevails for all other"
  // is compatible because they govern different subject matters.
  const precedenceFacts = facts.filter(f => f.type === 'precedence');
  if (precedenceFacts.length >= 2) {
    const documents = [...new Set(precedenceFacts.map(f => f.document))];
    if (documents.length >= 2) {
      const clauseIndices = [...new Set(precedenceFacts.map(f => f.clauseIndex))];
      if (clauseIndices.length >= 2) {
        // Check if the precedence claims are scoped to different topics
        const scopeKeywords = /(?:with\s+respect\s+to|regarding|for\s+(?:purposes?\s+of|all\s+(?:other\s+)?matters?|pricing|payment|delivery|scope))/i;
        const allScoped = precedenceFacts.every(f => {
          const clause = clauses.find(c => c.segmentIndex === f.clauseIndex);
          return clause && scopeKeywords.test(clause.rawText);
        });
        
        if (!allScoped) {
          findings.push({
            rule: 'PRECEDENCE_CONFLICT',
            severity: SEVERITY.PRECEDENCE_CONFLICT,
            title: 'Conflicting Document Precedence',
            reason: `Clause ${clauseIndices[0] + 1} states that "${documents[0]}" shall prevail, but Clause ${clauseIndices[1] + 1} states that "${documents[1]}" shall prevail. These are mutually exclusive precedence claims.`,
            clauseRefs: clauseIndices,
          });
        }
      }
    }
  }

  // ── Rule 12: TERMINATION_PAYMENT Contradiction ────────────────────────────
  // Guard: "refund fees for services NOT YET performed" is COMPATIBLE with
  // "pay for services performed" — they describe the same economic principle
  // from different angles. Only flag when it's an unqualified "refund ALL fees".
  const termPaymentFacts = facts.filter(f => f.type === 'termination_payment');
  if (termPaymentFacts.length >= 2) {
    const actions = [...new Set(termPaymentFacts.map(f => f.action))];
    if (actions.includes('refund_all') && actions.includes('pay_for_services')) {
      // Check if the refund clause is qualified ("not yet performed", "unused")
      const refundFact = termPaymentFacts.find(f => f.action === 'refund_all');
      const refundClause = clauses.find(c => c.segmentIndex === refundFact?.clauseIndex);
      const isQualifiedRefund = refundClause &&
        /(?:not\s+yet\s+performed|unused|unearned|pro[- ]?rat(?:a|ed)|remaining)/i.test(refundClause.rawText);
      
      if (!isQualifiedRefund) {
        const clauseIndices = [...new Set(termPaymentFacts.map(f => f.clauseIndex))];
        const firstClause = clauseIndices[0] + 1;
        const secondClause = clauseIndices[1] !== undefined ? `Clause ${clauseIndices[1] + 1}` : `the same clause`;
        findings.push({
          rule: 'TERMINATION_PAYMENT',
          severity: SEVERITY.TERMINATION_PAYMENT,
          title: 'Contradictory Termination Payment Provisions',
          reason: `Clause ${firstClause} requires a full refund of all fees upon termination, but ${secondClause} requires payment for services already performed. These provisions directly contradict each other.`,
          clauseRefs: clauseIndices,
        });
      }
    }
  }

  // ── Rule 13: INTEREST_CONTRADICTION ───────────────────────────────────────
  // Conflicting interest rates for default or late payments
  const interestFacts = facts.filter(f =>
    f.type === 'percentage' && f.categories?.includes('interest_rate')
  );
  if (interestFacts.length >= 2) {
    const uniqueRates = [...new Set(interestFacts.map(f => f.value))];
    if (uniqueRates.length >= 2) {
      const clauseIndices = [...new Set(interestFacts.map(f => f.clauseIndex))];
      findings.push({
        rule: 'INTEREST_CONTRADICTION',
        severity: SEVERITY.INTEREST_CONTRADICTION,
        title: 'Conflicting Interest Rates for Late Payments',
        reason: `Multiple conflicting interest rates found: ${interestFacts.map(f => `${f.value}% (Clause ${f.clauseIndex + 1})`).join(' vs ')}. These conflicting rates create commercial and compliance ambiguity.`,
        clauseRefs: clauseIndices,
      });
    }
  }

  // ── Deduplicate findings ──────────────────────────────────────────────────
  const seen = new Set();
  const dedupedFindings = findings.filter(f => {
    const key = f.rule + ':' + f.clauseRefs.sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[Contradiction Engine] Detected ${dedupedFindings.length} contradictions across ${clauses.length} clauses.`);
  return { findings: dedupedFindings };
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatCurrency(value, unit) {
  if (unit === 'INR') {
    return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { detectContradictions, SEVERITY };
