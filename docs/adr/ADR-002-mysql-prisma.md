# ADR-002: MySQL + Prisma (not MongoDB)

## Context

Core entities (Patients, Doctors, Appointments, Predictions, Notifications) have strict relational integrity requirements: an appointment must reference exactly one valid patient and one valid doctor; a doctor must not be double-booked; dashboard reporting requires joins and aggregations.

## Decision

Use **MySQL** as the primary datastore, accessed through **Prisma ORM** (TypeScript-native, migration-managed, type-safe queries).

## Alternatives considered

- **MongoDB** — rejected. Document databases don't enforce relational integrity or unique-constraint-across-fields as cleanly as a relational DB. This would push validation logic into the application layer where it's easier to get wrong.

## Consequences

- Requires proper schema migrations (Prisma handles this) instead of MongoDB's schema flexibility.
- Acceptable trade-off given the relational nature of the domain.
