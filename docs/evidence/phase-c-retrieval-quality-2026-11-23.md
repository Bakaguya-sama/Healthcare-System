# Phase C — retrieval quality evidence (2026-11-23)

## Scope and authorization

Product Owner explicitly authorized a synthetic corpus solely for the technical benchmark.
The seed command created 11 synthetic documents/chunks in `scope=benchmark`; this scope is
not used by user-serving retrieval. The fixture contains no PHI and is not medical-content
approval. The seed wrote an audit record and an idempotent outbox event for every fixture.

## Atlas and benchmark

| Item | Result |
| --- | --- |
| Atlas full-text probe | PASS |
| Atlas vector probe | PASS |
| `vector_index` dimension | 3072, matching the live Gemini embedding output |
| Baseline | `docs/evaluation/rag-phase-c-vi-baseline.csv`, 20 Vietnamese synthetic cases |
| Measurement | 3 repeats x 20 cases per mode |
| Hybrid citation rate | 100% |
| Hybrid expected-evidence match | 100% |
| Vector-only P95 | 635 ms |
| Hybrid P95 | 541 ms |
| DEC-B2 hybrid latency limit | 762 ms (120% of vector-only P95) |
| Embedding call budget | 1 call/query; observed 60/60 |
| External literature calls in retrieval benchmark | 0 |
| Enforced benchmark | PASS |

Commands used (with environment variables supplied outside source control):

```powershell
$env:RAG_BENCHMARK_SEED_CONFIRMATION='approved'
pnpm --filter api rag:benchmark:seed

$env:RAG_HYBRID_RETRIEVAL_ENABLED='false'
$env:RAG_BENCHMARK_REPEAT='3'
$env:RAG_BENCHMARK_OUTPUT='../../tmp/rag-phase-c-vector-baseline-result.json'
pnpm --filter api rag:benchmark

$env:RAG_HYBRID_RETRIEVAL_ENABLED='true'
$env:RAG_BENCHMARK_REPEAT='3'
$env:RAG_BENCHMARK_ENFORCE='true'
$env:RAG_BENCHMARK_VECTOR_BASELINE_PATH='../../tmp/rag-phase-c-vector-baseline-result.json'
pnpm --filter api rag:benchmark
```

The generated reports remain under ignored `tmp/`; they contain case IDs, hit counts and
latency only, not query text, provider tokens, PHI or source content.

## Verification results

- `pnpm --filter api database:verify`: PASS — version `202611181240`, 45 collections,
  122 managed indexes.
- `pnpm --filter api typecheck`: PASS.
- `pnpm --filter api build`: PASS.
- `pnpm --filter api openapi:generate` then `openapi:check`: PASS.
- `pnpm --filter api realtime:check`: PASS.
- `pnpm --filter api boundary:check`: PASS.
- Unit: Retrieval, external-evidence, candidate and orchestration quarantine suites: 11 tests PASS.
- Candidate HTTP E2E: PASS.
- PubMed provider integration: PASS, including fail-closed handling when the live upstream
  rejects or rate-limits the request.
- `git diff --check`: PASS.

## Residual operating rule

External-provider availability is not an authorization to infer an answer or automatically
promote a candidate. A patient-triggered PubMed search only creates/deduplicates a quarantined
pending candidate with a system audit/outbox event; it never adds unapproved metadata to that
patient's LLM context or citations. Real PubMed material remains metadata-only until a
`super_admin` reviews it and the resulting `AiDocument(source=pubmed)` completes the normal
review/ingestion/activation lifecycle.
