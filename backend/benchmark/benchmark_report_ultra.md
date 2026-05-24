# 🏛️ LexGuard Core AI Engine Benchmark Quality Report
Generated At: 2026-05-24T14:29:23.548Z

### Core Evaluation Diagnostics Metrics
* **Total Audited Test Cases:** 5
* **Agent 1 Classification Accuracy:** 60.00% (3/5)
* **Agent 2/2.5 Risk Assessment Accuracy:** 60.00% (3/5)
* **System False Positive Rate:** 0 occurrences
* **System False Negative Rate:** 1 occurrences
* **Agent 3 Average Rewrite Quality Grade:** 6.00/10


## Detailed Per-TestCase Audit Telemetry

| Test ID | Expected Type / Risk | AI Type / Risk | Status | Rewrite Quality (1-10) |
| :--- | :--- | :--- | :--- | :--- |
| TC_U01_GHOST_EQUITY_CLAWBACK | termination / CRITICAL | compensation / CRITICAL | ❌ MISMATCH | 5/10 |
| TC_U02_NON_COMPETE_MASQUERADING_AS_TRADE_SECRET | non_compete / CRITICAL | non_compete / HIGH | ❌ MISMATCH | 5/10 |
| TC_U03_BIOMETRIC_SURVEILLANCE_DPDP_WAIVER | privacy_data / CRITICAL | privacy_data / CRITICAL | ✅ PASS | 5/10 |
| TC_U04_PREDATORY_JURISDICTION_TIER_3 | dispute_resolution / HIGH | dispute_resolution / LOW | ❌ MISMATCH | 10/10 |
| TC_U05_GAG_ORDER_EQUITY_FORFEITURE | compensation / CRITICAL | confidentiality / CRITICAL | ❌ MISMATCH | 5/10 |

