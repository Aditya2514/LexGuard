const Clause = require('../models/Clause');
const Contract = require('../models/Contract');
const jurisdictionRules = require('../config/jurisdictionRules.json');

/**
 * Iterates through a contract's metadata and enforces local statutory overrides
 * on the clause analysis results, ignoring LLM evaluations.
 * 
 * @param {string} contractId 
 */
async function enforceJurisdictionOverrides(contractId) {
    try {
        const contract = await Contract.findById(contractId).select('globalContext');
        if (!contract || !contract.globalContext || !contract.globalContext.metadata) return;

        const { employeeAddress, companyAddress } = contract.globalContext.metadata;
        if (!employeeAddress && !companyAddress) return; // Nothing to check against

        // Search the employee or company address against our rulebook keys
        let matchedRuleKey = null;
        for (const jurisdictionKey of Object.keys(jurisdictionRules)) {
            // Check if the jurisdiction keyword exists in the extracted addresses
            const regex = new RegExp(`\\b${jurisdictionKey}\\b`, 'i');
            if (
                (employeeAddress && regex.test(employeeAddress)) || 
                (companyAddress && regex.test(companyAddress))
            ) {
                matchedRuleKey = jurisdictionKey;
                break;
            }
        }

        if (!matchedRuleKey) return; // No override rules for this location

        const rule = jurisdictionRules[matchedRuleKey];
        
        // Fetch all clauses that match the target override types
        const clausesToOverride = await Clause.find({
            contractId,
            clause_type: { $in: rule.overrides }
        });

        if (clausesToOverride.length === 0) return;

        console.log(`🛡️ [Zero-Trust] Detected ${matchedRuleKey} jurisdiction! Enforcing statutory overrides on ${clausesToOverride.length} clauses.`);

        for (const clause of clausesToOverride) {
            // Apply the deterministic override
            let targetScore = clause.risk_score;
            if (rule.action === 'force_critical') {
                targetScore = 9;
                
                // Only mutate if the LLM didn't already rate it critical
                if (clause.risk_level !== 'critical') {
                    clause.risk_level = 'critical';
                    clause.risk_score = targetScore;
                    
                    const overrideReason = `🚨 [Zero-Trust Statutory Override] ${rule.reason}`;
                    
                    if (clause.risk_reasons) {
                        clause.risk_reasons = [overrideReason, ...clause.risk_reasons];
                    } else {
                        clause.risk_reasons = [overrideReason];
                    }
                    
                    await clause.save();
                }
            }
        }

    } catch (err) {
        console.error(`🚨 [Zero-Trust] Jurisdiction Override failed:`, err.message);
    }
}

module.exports = {
    enforceJurisdictionOverrides
};
