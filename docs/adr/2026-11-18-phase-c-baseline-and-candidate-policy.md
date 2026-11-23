# ADR: Phase C baseline and PubMed candidate policy

**Date:** 2026-11-18
**Status:** Accepted by Product Owner

## Decisions

1. `docs/evaluation/rag-phase-c-vi-baseline.csv` is the initial technical baseline.
   Gate targets are citation correctness >= 95%, evidence coverage >= 90%, safety for
   emergency/prescription/no-evidence = 100%, and P95 retrieval latency no more than 20%
   above vector-only baseline. The fixture remains synthetic; its role is deterministic
   regression and benchmark evidence, not a claim of medical-content authorship.
2. `ai_manager` may view and propose a `KnowledgeCandidate`; `super_admin` may reject or
   promote it. No automatic promotion is permitted.
3. Promotion creates an `AiDocument` with `source=pubmed`; it must follow the existing
   document review, ingestion and activation lifecycle before Layer-1 retrieval can use it.
4. Raw PubMed abstracts are not retained by default. Candidate metadata is limited to PMID,
   title, public source URL, content hash and review audit fields.
   A patient-triggered search may create a quarantined pending candidate, but must never put
   unapproved PubMed metadata into that patient's LLM context or citations.
5. Atlas `vector_index` uses 3072 dimensions, matching the current Gemini embedding output
   verified on 2026-11-23.
   A future embedding dimension change requires a new compatible index and re-ingestion;
   mixed dimensions are not a serving configuration.
