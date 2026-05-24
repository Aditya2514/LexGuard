# 🏛️ LexGuard Core AI Engine Benchmark Quality Report
Generated At: 2026-05-24T09:08:27.805Z

### Core Evaluation Diagnostics Metrics
* **Total Audited Test Cases:** 5
* **Agent 1 Classification Accuracy:** 60.00% (3/5)
* **Agent 2/2.5 Risk Assessment Accuracy:** 100.00% (5/5)
* **System False Positive Rate:** 0 occurrences
* **System False Negative Rate:** 0 occurrences
* **Agent 3 Average Rewrite Quality Grade:** 5.00/10


## Detailed Per-TestCase Audit Telemetry

| Test ID | Expected Type / Risk | AI Type / Risk | Status | Rewrite Quality (1-10) |
| :--- | :--- | :--- | :--- | :--- |
| TC_021_DATA_PRIVACY_VIOLATION | data_privacy / CRITICAL | privacy_data / CRITICAL | ❌ MISMATCH | 5/10 |
| TC_022_LIQUIDATED_DAMAGES_EXCESSIVE | compensation / CRITICAL | liability_limit / CRITICAL | ❌ MISMATCH | 5/10 |
| TC_023_WAGE_DEDUCTION_SAFE_HARBOR | compensation / LOW | compensation / LOW | ✅ PASS | 10/10 |
| TC_024_NON_COMPETE_GARDEN_LEAVE | termination / LOW | termination / LOW | ✅ PASS | 10/10 |
| TC_025_ARBITRATION_BIASED_SEAT | dispute_resolution / HIGH | dispute_resolution / HIGH | ✅ PASS | 5/10 |

