# ADR-001: Modular Monolith + Separated AI Service (not full microservices)

## Context

The FastRev system needs loose coupling and fault tolerance. A failure in one part should not take down the whole system. The AI prediction workload has a genuinely different scaling profile (CPU-bound inference) compared to the core CRUD workload (I/O-bound). Full microservices per domain (Auth, Patient, Appointment, Notification, AI) was considered.

## Decision

Build the core application as a **single, well-modularized Node.js backend** (modular monolith) with one database. Separate out **only** the ML/AI workload into its own Python service. The notification worker is separated as a background process that shares the database but runs independently.

## Alternatives considered

- **Full microservices per domain** — rejected for this stage. Adds significant operational complexity (service discovery, distributed transactions, network failure handling) without a real scale requirement.
- **Single monolith including AI/ML in Node** — rejected. Python has the ML ecosystem; forcing ML into Node would mean reimplementing or badly wrapping it.

## Reasoning

Two service boundaries (Node API+DB, Python AI service) deliver the loose coupling and fault tolerance goals in practice:
- If the AI service is down, the core app keeps working. Appointments are still created; they just don't get a risk score until the AI service is back.
- The AI service can be scaled independently.

## Consequences

- Slightly more deployment complexity than a pure monolith (3 deployable units: API, AI service, worker — plus MySQL and Redis).
- In exchange, real fault isolation and a defensible architectural story.
