# ADR-003: Vitest + Supertest instead of Jest

**Context:** A testing framework needed to be chosen for the backend. Jest was the initial placeholder in BUILD_SPEC.md, written before any tests existed.

**Decision:** Use Vitest + Supertest instead of Jest.

**Alternatives considered:** Jest — mature, huge ecosystem, still widely used industry-wide. Rejected in favor of Vitest because Vitest is significantly faster (native ESM/TS support, no Babel transform overhead), shares config conventions with Vite (already used on the frontend), and has become the more current standard for new TypeScript projects — better aligned with 2026 market expectations without sacrificing maturity.

**Consequences:** Minor differences in mocking API syntax vs Jest. Negligible migration cost since no tests were written yet under Jest.
