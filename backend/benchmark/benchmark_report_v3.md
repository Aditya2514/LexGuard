# 🏛️ LexGuard Core AI Engine Benchmark Quality Report
Generated At: 2026-05-24T09:22:30.005Z

### Core Evaluation Diagnostics Metrics
* **Total Audited Test Cases:** 5
* **Agent 1 Classification Accuracy:** 60.00% (3/5)
* **Agent 2/2.5 Risk Assessment Accuracy:** 80.00% (4/5)
* **System False Positive Rate:** 1 occurrences
* **System False Negative Rate:** 0 occurrences
* **Agent 3 Average Rewrite Quality Grade:** 5.00/10


## Detailed Per-TestCase Audit Telemetry

| Test ID | Expected Type / Risk | AI Type / Risk | Status | Rewrite Quality (1-10) |
| :--- | :--- | :--- | :--- | :--- |
| TC_026_IP_MORAL_RIGHTS_WAIVER | intellectual_property / CRITICAL | intellectual_property / CRITICAL | ✅ PASS | 5/10 |
| TC_027_MUTUAL_NON_DISPARAGEMENT | confidentiality / LOW | confidentiality / LOW | ✅ PASS | 10/10 |
| TC_028_AUTO_RENEWAL_EVERGREEN | auto_renewal / CRITICAL | auto_renewal / CRITICAL | ✅ PASS | 5/10 |
| TC_029_NON_SOLICIT_EMPLOYEES_ONLY | non_solicitation / LOW | non_compete / CRITICAL | ❌ MISMATCH | 10/10 |
| TC_030_RETROACTIVE_POLICY_BINDING | amendment / CRITICAL | compensation / CRITICAL | ❌ MISMATCH | 5/10 |

