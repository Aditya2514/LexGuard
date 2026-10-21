# Dev scripts

Ad-hoc debug and smoke-test scripts written while building LexGuard, plus the sample files they upload (`dummy*.pdf`, `*.docx`).
They load `backend/.env` and talk to live services (MongoDB, Redis, LLM providers), so they are not part of CI.
The offline unit suite is `npm test` (`backend/test/`), and the LLM evaluation suites live in `backend/benchmark/`.
Run them from `backend/`, e.g. `node scripts/dev/test_pipeline.js`.
