# FastRev

**A clinic/patient management platform with an AI-powered no-show prediction engine.**

> Predicts which patients are likely to miss their appointment, so clinics can send a targeted reminder or fill the slot with another patient — before the revenue is lost.

## The Problem

Healthcare no-show rates average ~27% industry-wide, costing independent practices an estimated $150K–$1M/year in lost revenue. AI-driven prediction and reminder systems have been shown to cut no-shows by 40%+ in real deployments. FastRev is a from-scratch build of that idea: a working system, not a slide deck.

## Status: 🚧 Backend and AI complete, frontend not started

The whole server side is built — API, prediction service, trained model, and background worker. What's missing is the UI and an end-to-end run against live infrastructure.

| Component | Status |
|---|---|
| Backend foundation (auth, error handling, logging, config) | ✅ Done |
| Docker Compose (MySQL, Redis, backend, worker, AI service, frontend) | ✅ Done |
| Patients module (CRUD, admin enrollment, risk profile) | ✅ Done |
| Doctors module (admin-only account + profile management) | ✅ Done |
| Appointments module (double-booking prevention, status flow) | ✅ Done |
| No-show prediction service (FastAPI + trained XGBoost) | ✅ Done |
| Notification worker (reminder scheduling, retry queues) | ✅ Done |
| Unit / API tests (Vitest, unittest) | ✅ Done |
| End-to-end verification against live MySQL + Redis | ⏳ Not yet run |
| Real SMS provider adapter (only a `console` provider exists) | ⏳ Planned |
| Frontend (React dashboard) | ⏳ Not started |
| CI/CD | ⏳ Planned |

Two things to be explicit about:

- **The model's metrics are from synthetic data only.** The current XGBoost run scores F1 0.42 / ROC-AUC 0.69 on 12,000 generated rows ([`docs/model-evaluation.md`](docs/model-evaluation.md)). That is a working pipeline, not a claim about clinical accuracy.
- **Nothing is verified end to end yet.** Tests pass at the unit and API level, but the migrations, Redis queues, and the full booking→risk→reminder flow have not been exercised against running containers.

See [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) for the full architecture, database schema, and build order, and [`docs/adr/`](docs/adr) for the reasoning behind major technical decisions.

## Architecture (short version)

```
React Frontend → Node.js API (Express, modular) → MySQL (Prisma)
    (planned)              ↓                           ↓
              Python AI Service (FastAPI)      Redis (queue + cache)
                                                       ↓
                                          Notification Worker (BullMQ)
```

A modular monolith for the core app, with the ML workload and background jobs deliberately split into their own services — see [ADR-001](docs/adr/ADR-001-modular-monolith.md) for why. MySQL was chosen over MongoDB for relational integrity (e.g. preventing double-booked doctors) — see [ADR-002](docs/adr/ADR-002-mysql-prisma.md). Tests run on Vitest — see [ADR-003](docs/adr/ADR-003-vitest-testing.md).

### How the pieces behave

- **Double-booking is prevented at three levels:** a `SELECT ... FOR UPDATE` lock on the doctor row serializes concurrent bookings, a range query catches duration-based overlaps, and a unique index on the active slot acts as a database backstop. Cancelling an appointment frees its slot for rebooking.
- **The AI service never blocks a booking.** The API calls it with a 3-second timeout; on timeout or error the appointment is still created, a prediction row is stored with `risk_level = 'unknown'`, and a retry job is queued. The AI service is stateless and never touches MySQL.
- **The model degrades instead of failing.** The FastAPI service loads a versioned joblib artifact at startup; if it is missing or inference throws, it falls back to a deterministic `rule-v1` scoring rule and reports which source it used. A failed re-score never erases a score an appointment already has.
- **New patients aren't guessed at.** A patient with no recorded show or no-show is labelled `new_patient` instead of getting an AI score. Once their first visit has an outcome, their upcoming appointments are re-scored automatically.
- **Attendance drives the score.** Marking a visit `completed` or `no_show` updates the patient's history and re-scores their upcoming appointments. Appointments whose start time has passed without an outcome are flagged `needsOutcome` so staff record what happened; the system never assumes a no-show.
- **Reminders are queued, never sent inline.** High-risk appointments get two reminders (48h and 4h before), everything else gets one at 24h — plus an extra 48h one for a new patient who booked 14+ days ahead. Cancelling an appointment cancels its pending reminders.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** MySQL 8
- **Queue/Cache:** Redis, BullMQ
- **AI Service:** Python, FastAPI, scikit-learn, XGBoost
- **Testing:** Vitest + Supertest (backend), unittest (AI service)
- **Frontend:** React, Vite, Redux Toolkit (planned)
- **Infra:** Docker, Docker Compose

## API

All protected routes take `Authorization: Bearer <token>`.

| Method | Route | Access |
|---|---|---|
| `POST` | `/api/v1/auth/register` | public (creates `patient` role only) |
| `POST` | `/api/v1/auth/login` | public |
| `POST` | `/api/v1/patients` | admin |
| `GET` | `/api/v1/patients` | admin, doctor |
| `GET` | `/api/v1/patients/:id` | admin, doctor |
| `GET` | `/api/v1/patients/:id/risk-profile` | admin, doctor |
| `PATCH` `DELETE` | `/api/v1/patients/:id` | admin |
| `POST` `GET` | `/api/v1/doctors` | admin |
| `GET` `PATCH` `DELETE` | `/api/v1/doctors/:id` | admin |
| `POST` `GET` | `/api/v1/appointments` | admin |
| `GET` | `/api/v1/appointments/:id` | admin |
| `PATCH` | `/api/v1/appointments/:id/status` | admin |
| `POST` | `/api/v1/appointments/:id/prediction/retry` | admin |
| `GET` | `/health` | public |

The AI service exposes `GET /health` and `POST /predict/no-show-risk` on its own container — internal to the Compose network, not published to the host.

`GET /api/v1/appointments` filters: `status`, `riskLevel` (`low`, `high`, `unknown`, `new_patient`), `from`/`to`, and `needsOutcome=true|false`. Every appointment in a response carries a `needsOutcome` flag, and the patient risk profile reports `isNewPatient`, completed visits, no-shows, a no-show rate over visits with an outcome, and `awaitingOutcome`.

Appointment status flow: `booked → confirmed → completed` or `no_show`; cancellation is allowed from `booked` or `confirmed`. Marking a patient `no_show` increments their history and re-queues risk scores for their upcoming appointments. Patient enrollment and booking both accept an optional `Idempotency-Key` header.

The first admin account is created at startup from `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` — public registration only ever creates patients.

## Running Locally

There is no root `.env.example` yet; create a root `.env` for Compose with these variables:

```
MYSQL_ROOT_PASSWORD=   MYSQL_DATABASE=   MYSQL_USER=   MYSQL_PASSWORD=
DATABASE_URL=          # internal host, e.g. mysql://user:pass@mysql:3306/fastrev
REDIS_URL=redis://redis:6379
AI_SERVICE_URL=http://ai-service:8000
JWT_SECRET=            # at least 32 characters
JWT_EXPIRY=24h
BOOTSTRAP_ADMIN_EMAIL= BOOTSTRAP_ADMIN_PASSWORD=   # optional, both or neither
```

```bash
git clone https://github.com/jobayermannan/fastrev.git
cd fastrev
docker compose up -d --build
```

The API runs on `http://localhost:4000` and the frontend container on `http://localhost:3000` — currently serving a placeholder page, since there is no frontend source yet. The AI service image trains the model during the build, so the container always ships with an artifact.

For backend development outside Docker (see [`backend/.env.example`](backend/.env.example), and point `DATABASE_URL` at a database you own):

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Tests

```bash
cd backend && npm run typecheck && npm test
```

Database integration tests are skipped unless `FASTREV_TEST_DATABASE_URL` is set, and a guard in [`backend/tests/setup.ts`](backend/tests/setup.ts) only accepts a dedicated local `fastrev_test` database — the suite will not run destructively against anything else.

```bash
cd ai-service && python -m unittest discover -s tests -v
```

### Retraining the model

```bash
cd ai-service
python training/generate_synthetic_data.py --output data/synthetic_no_show_data.csv
python training/train.py --data data/synthetic_no_show_data.csv --model-output models/no_show_model.joblib --metrics-output models/training-metrics.json
```

## A Note on How This Was Built

This project is being built with AI-assisted development (Kilo Code for scaffolding), following a documented process: every architecture decision is recorded as an ADR, every feature is reviewed and manually tested (not just assumed to work), and the build proceeds module by module rather than all at once. The goal is a system I can fully explain and defend, not just run.

## Roadmap

1. Verify migrations, the Redis worker, and the full booking→risk→reminder flow against running containers and a dedicated test database.
2. Add a real SMS provider adapter behind the existing provider-neutral interface, with patient consent and opt-out.
3. Build the React + Vite frontend: admin login, patient and doctor management, booking, appointment list with risk badges, patient risk profile.
4. Replace synthetic training data with de-identified consented historical data; add calibration and drift monitoring.
5. CI, linting, and a root `.env.example`.

## License

TBD
