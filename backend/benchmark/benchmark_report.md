# 🏛️ LexGuard Core AI Engine Benchmark Quality Report
Generated At: 2026-05-21T15:48:23.106Z

### Core Evaluation Diagnostics Metrics
* **Total Audited Test Cases:** 5
* **Agent 1 Classification Accuracy:** 60.00% (3/5)
* **Agent 2/2.5 Risk Assessment Accuracy:** 60.00% (3/5)
* **System False Positive Rate:** 0 occurrences
* **System False Negative Rate:** 0 occurrences
* **Agent 3 Average Rewrite Quality Grade:** 5.00/10


## Detailed Per-TestCase Audit Telemetry

| Test ID | Expected Type / Risk | AI Type / Risk | Status | Rewrite Quality (1-10) |
| :--- | :--- | :--- | :--- | :--- |
| TC_001_NON_COMPETE_PREDATORY | non_compete / CRITICAL | non_compete / CRITICAL | ✅ PASS | 5/10 |
| TC_002_NON_COMPETE_SAFE_HARBOR | non_compete / LOW | non_compete / LOW | ✅ PASS | 10/10 |
| TC_003_ARBITRATION_UNILATERAL | dispute_resolution / HIGH | dispute_resolution / HIGH | ✅ PASS | 5/10 |
| TC_004_WAGE_DEDUCTION_PUNITIVE | compensation / CRITICAL | other / HIGH | ❌ MISMATCH | 5/10 |
| TC_005_COPYRIGHT_WAIVER_TRAP | intellectual_property / HIGH | other / CRITICAL | ❌ MISMATCH | 5/10 |

