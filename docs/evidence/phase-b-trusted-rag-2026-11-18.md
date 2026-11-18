# Phase B evidence — Trusted RAG foundation

Date: 2026-11-18 (Asia/Ho_Chi_Minh)

## Database

- `pnpm --filter api database:migrate`: applied forward-only migration `202611181230-trusted-knowledge-documents` after correcting the MongoDB text-index language-override collision. The persisted business field is `knowledgeLanguage`; it is deliberately separate from MongoDB's reserved text-index override field `language`.
- `pnpm --filter api database:verify`: PASS — `version=202611181230, collections=44, managedIndexes=122`.

## Build evidence

- `pnpm --filter api typecheck`: PASS.
- `pnpm --filter api build`: PASS.
- Targeted ESLint for the changed knowledge-document, retrieval, controller and outbox-worker files with `--max-warnings 0`: PASS.

## Operational controls implemented

- Submit by `ai_manager`/`super_admin`; review, archive, deletion and activation by `super_admin` only.
- Upload stays pending review. Approval writes an idempotent outbox event; worker ingestion ends at `ready_for_activation`; explicit activation is still required.
- Retrieval filters the chunk and document lifecycle, expiry, scope and `knowledgeLanguage` and returns citation-safe provenance only.
- When retrieval provides no valid evidence, the chat path returns a deterministic escalation message without calling general model knowledge.

## Test evidence

- Unit (`5` suites / `10` tests): retrieval threshold/dedup/no-evidence, server citation redaction, `ai_manager` vs full Admin policy, pending replacement version, late archive event, retry failure and emergency/prescription red-team decisions.
- Integration (`1` suite / `1` test): real MongoDB unique `(documentId, documentVersion, chunkIndex)` enforcement and archived version retrieval ineligibility.
- E2E (`1` suite / `2` tests): knowledge governance endpoint takes the authenticated Admin subject and rejects unauthenticated approval.

The Vietnamese baseline uses the tested `vi` scope/language cases as a safety baseline only; no quality score threshold has been promoted. DEC-B2 remains intentionally unset until a curated evaluation corpus is approved by clinical owners. Legacy full-repository lint warnings are non-blocking per roadmap policy; changed-file lint is clean.
