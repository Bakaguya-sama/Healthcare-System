# Architecture

HealthAI is a modular NestJS monolith with MongoDB/Mongoose, Redis and workers. Module boundaries, historical RF evidence and platform cut-lines are retained in [refactor history](../plan/archive/refactor-history.md).

For current feature implementation, the architecture rules are:

- `chronic-care` owns Program, Rule, Enrollment and future Care domain persistence.
- Cross-context dependencies use public application ports; no direct Mongoose model injection across Users, Health Tracking, Notifications or Consultations.
- Versioned writes use migrations, schema manifest and database verification.
- State-changing commands use audit, conditional transitions and idempotency.

The authoritative behavioral detail is [chronic-care-spec.md](chronic-care-spec.md); this file is an orientation layer, not a competing contract.
