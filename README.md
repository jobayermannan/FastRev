# FastRev

**A clinic/patient management platform with an AI-powered no-show prediction engine.**

> Predicts which patients are likely to miss their appointment, so clinics can send a targeted reminder or fill the slot with another patient — before the revenue is lost.

## The Problem

Healthcare no-show rates average ~27% industry-wide, costing independent practices an estimated $150K–$1M/year in lost revenue. AI-driven prediction and reminder systems have been shown to cut no-shows by 40%+ in real deployments. FastRev is a from-scratch build of that idea: a working system, not a slide deck.

## Status: 🚧 In Active Development

This is being built incrementally and documented as it goes — see [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) for the full architecture, database schema, and build order, and [`docs/adr/`](docs/adr) for the reasoning behind major technical decisions.

| Component | Status |
|---|---|
| Backend foundation (auth, error handling, logging, config) | ✅ Done |
| Docker Compose (MySQL, Redis, backend, worker, AI service, frontend) | ✅ Done |
| Patients / Doctors modules | 🚧 In progress |
| Appointments module (double-booking prevention) | ⏳ Planned |
| No-show prediction service (Python/FastAPI) | ⏳ Planned |
| Notification worker (reminder scheduling) | ⏳ Planned |
| Frontend (React dashboard) | ⏳ Planned |
| Tests, CI/CD | ⏳ Planned |

## Architecture (short version)

```
React Frontend → Node.js API (Express, modular) → MySQL (Prisma)
                       ↓                              ↓
              Python AI Service (FastAPI)      Redis (queue + cache)
                                                       ↓
                                          Notification Worker (BullMQ)
```

A modular monolith for the core app, with the ML workload and background jobs deliberately split into their own services — see [ADR-001](docs/adr/ADR-001-modular-monolith.md) for why. MySQL was chosen over MongoDB for relational integrity (e.g. preventing double-booked doctors) — see [ADR-002](docs/adr/ADR-002-mysql-prisma.md).

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** MySQL 8
- **Queue/Cache:** Redis, BullMQ
- **AI Service:** Python, FastAPI, scikit-learn
- **Frontend:** React, Vite, Redux Toolkit (planned)
- **Infra:** Docker, Docker Compose

## Running Locally

```bash
git clone https://github.com/jobayermannan/fastrev.git
cd fastrev
cp .env.example .env   # fill in local values
docker compose up -d --build
```

Backend runs on `http://localhost:4000`, AI service on `http://localhost:8000`, frontend on `http://localhost:3000`.

## A Note on How This Was Built

This project is being built with AI-assisted development (Kilo Code for scaffolding), following a documented process: every architecture decision is recorded as an ADR, every feature is reviewed and manually tested (not just assumed to work), and the build proceeds module by module rather than all at once. The goal is a system I can fully explain and defend, not just run.

## License

TBD
