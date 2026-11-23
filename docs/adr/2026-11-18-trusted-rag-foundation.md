# ADR: Trusted RAG foundation

## Decision

Knowledge documents follow `pending_review → approved/pending_ingestion → processing → ready_for_activation → active`. An `ai_manager` may submit and maintain metadata; only `super_admin` may approve, reject, archive, delete, or select an active version. Ingestion is delivered through the transactional outbox and does not activate a document.

Retrieval accepts only active, approved, unexpired chunks and their matching active document version for the requested language and scope. A response without valid evidence returns a deterministic safe no-evidence message; it does not invoke general model medical knowledge. Citations are built from retrieved server-side identifiers and expose only safe title/source/version/location fields.

## Rollback

Disable document activation (or archive the active version) to remove it from retrieval immediately. Pending outbox events are idempotent and cannot make a document active. Local chat remains available but responds with the no-evidence policy while no approved active document exists.

## Consequences

The first approved version must be explicitly activated by a full administrator. This intentionally adds an operational review step before any medical content can be served.
