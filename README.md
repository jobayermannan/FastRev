# FastRev

**A clinic/patient management platform with an AI-powered no-show prediction engine.**

> Predicts which patients are likely to miss their appointment, so clinics can send a targeted reminder or fill the slot with another patient — before the revenue is lost.

## The Problem

Healthcare no-show rates average ~27% industry-wide, costing independent practices an estimated $150K–$1M/year in lost revenue. AI-driven prediction and reminder systems have been shown to cut no-shows by 40%+ in real deployments. FastRev is a from-scratch build of that idea: a working system, not a slide deck.

## Status: 🚧 MVP complete, not production-ready

The whole system runs end to end: API, prediction service, trained model, background worker, and a React dashboard for clinic staff. What's missing before real use is a live SMS provider and a model trained on real clinic data.

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
| End-to-end verification against live MySQL + Redis | ✅ Done (68 checks) |
| Frontend (React dashboard: login, dashboard, appointments, patients, doctors) | ✅ Done |
| CI (GitHub Actions: backend, AI service, frontend) | ✅ Done |
| Real SMS provider adapter (only a `console` provider exists) | ⏳ Planned |
| Deployment (CD) | ⏳ Planned |

Two things to be explicit about:

- **The model's metrics are from synthetic data only.** The current XGBoost run scores F1 0.42 / ROC-AUC 0.69 on 12,000 generated rows ([`docs/model-evaluation.md`](docs/model-evaluation.md)). That is a working pipeline, not a claim about clinical accuracy.
- **No real SMS is sent.** Reminders are scheduled, queued and "delivered" through a `console` provider that only logs them, until a real provider is chosen.

See [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) for the full architecture, database schema, and build order, and [`docs/adr/`](docs/adr) for the reasoning behind major technical decisions.

## Architecture (short version)

```
React Frontend → Node.js API (Express, modular) → MySQL (Prisma)
                           ↓                           ↓
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
- **Reminders are queued, never sent inline.** High-risk appointments get two reminders (48h and 4h before), everything else gets one at 24h — plus an extra 48h one for a new patient who booked 14+ days ahead. When a re-score changes the plan, reminders from the old plan are cancelled; cancelling an appointment cancels all of its pending reminders.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** MySQL 8
- **Queue/Cache:** Redis, BullMQ
- **AI Service:** Python, FastAPI, scikit-learn, XGBoost
- **Testing:** Vitest + Supertest (backend), unittest (AI service)
- **Frontend:** React 18, Vite, Redux Toolkit + RTK Query, React Router
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

`GET /api/v1/appointments` filters: `status` (one value or a comma-separated list, e.g. `booked,confirmed`), `riskLevel` (`low`, `high`, `unknown`, `new_patient`), `from`/`to`, `needsOutcome=true|false`, and `order=asc|desc` by appointment time (default `desc`). Every appointment in a response carries a `needsOutcome` flag, and the patient risk profile reports `isNewPatient`, completed visits, no-shows, a no-show rate over visits with an outcome, and `awaitingOutcome`.

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

Open the dashboard at `http://localhost:3000` and sign in with the bootstrap admin; the API runs on `http://localhost:4000`. The frontend image bakes in `VITE_API_URL` (default `http://localhost:4000/api/v1`) at build time — set it in the root `.env` if the API lives elsewhere, then rebuild. The AI service image trains the model during the build, so the container always ships with an artifact.

On Windows, if Docker Desktop crash-loops with *"The file cannot be accessed by the system"*, it is stuck on stale socket files from an earlier crash ([desktop-feedback#625](https://github.com/docker/desktop-feedback/issues/625)): quit it, move `%LOCALAPPDATA%\Docker\run` and `%LOCALAPPDATA%\docker-secrets-engine` aside, and start it again from the Start menu.

For frontend development with hot reload, run the API stack in Docker and Vite locally:

```bash
cd frontend
npm ci
npm run dev   # http://localhost:5173
```

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

1. Add a real SMS provider adapter behind the existing provider-neutral interface, with patient consent and opt-out — then record replies ("1 to confirm, 2 to cancel") as a no-show signal.
2. Replace synthetic training data with de-identified consented historical data; add calibration and drift monitoring.
3. Deployment (CD), linting, a root `.env.example`, and frontend tests.
4. Screens for the doctor role beyond read-only patients.

## License

TBD
