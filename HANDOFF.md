# FastRev — Handoff

Last updated: 2026-11-04. Branch `feat/nextjs-architecture`, PR [jobayermannan/FastRev#2](https://github.com/jobayermannan/FastRev/pull/2).

---

## 1. Login & 404 Investigation — Root Causes Found and Fixed

Two separate issues produced the symptoms reported on `https://fastrev.vercel.app/login`:

1. **The console `404` was `/favicon.ico`.**
   - Verified against the live deployment:
     - Inspected the compiled Next.js bundle on `https://fastrev.vercel.app` (`/_next/static/chunks/3k2p7p83fk086.js`): `NEXT_PUBLIC_API_URL` is already compiled in as `https://fastrev-api.onrender.com/api/v1` (not missing `/api/v1`).
     - `GET https://fastrev.vercel.app/favicon.ico` returned `404 Not Found` (`X-Matched-Path: /404`), which browsers log as `Failed to load resource: the server responded with a status of 404 ()`.
   - **Fixed:** Added `frontend/src/app/icon.svg` and `frontend/public/favicon.ico` rendered from the FastRev `BrandMark`.

2. **Cold-start port-bind deadlock on `https://fastrev-api.onrender.com`.**
   - Verified against Cloudflare/Render: `nonexistent-probe.onrender.com` answers immediately (`404 no-server`), while `https://fastrev-api.onrender.com/health` held connections open for >150 s with 0 bytes whenever Aiven MySQL was powered down.
   - **Why:** `backend/docker-entrypoint.sh` blocked for 12 `prisma migrate deploy` retries before starting `node dist/server.js`, and `backend/src/server.ts` awaited `connectWithRetry()` before calling `app.listen(env.PORT)` (exiting `1` on failure). Because `$PORT` never bound while Aiven MySQL was asleep, Render's edge proxy hung incoming requests instead of reaching Express's `503 "The database is waking up"` error handler.
   - **Fixed:**
     - `backend/src/server.ts` now binds `app.listen(env.PORT)` immediately and warms Prisma asynchronously in the background without crashing the HTTP process.
     - `backend/docker-entrypoint.sh` runs migrations synchronously when the database is already reachable, and falls back to a background retry loop when the database is asleep so HTTP binds right away.
     - `backend/src/common/middleware/errorHandler.ts` maps all Prisma initialization and timeout/unreachable codes (`P1001`, `P1002`, `P1008`, `P1017`, and `PrismaClientInitializationError` with or without `errorCode`) to `503`.
     - `LoginForm.tsx` shows a cold-start status message when sign-in stays pending past 4 seconds.
   - **Action for operator in Aiven Console:** Aiven's free MySQL plan powers off completely after extended inactivity and does **not** wake from TCP traffic alone — click **Power On** on the MySQL service in the Aiven dashboard if it is in the `POWEROFF` state, and optionally set `BOOTSTRAP_ADMIN_SYNC_PASSWORD=true` once on Render if you need `bootstrap-admin.ts` to overwrite an existing admin's password with `BOOTSTRAP_ADMIN_PASSWORD`.

---

## 2. Live URLs

| | |
|---|---|
| **Frontend (shareable)** | https://fastrev.vercel.app |
| Frontend (project alias) | https://fastrev-jobayermannans-projects.vercel.app — **behind Vercel deployment protection**, `/login` redirects to `vercel.com/login`. Do not send this to anyone. |
| API | https://fastrev-api.onrender.com (`/health` is public) |
| Prediction service | `http://fastrev-ai:10000` — private on Render's network, no public URL |

Only `fastrev.vercel.app` is public. That is the link to put in a README or send a recruiter.

---

## 3. Architecture as deployed — $0/month

| Piece | Host | Why there |
|---|---|---|
| Next.js dashboard | Vercel | Builds Next natively. The browser calls the API directly, so the two only meet through `CORS_ORIGIN`. |
| Express API **+ BullMQ consumers** | Render, Singapore, free | Render has **no free background worker**, so the queues run inside the API process (`RUN_WORKERS_IN_PROCESS=true`). |
| FastAPI / XGBoost prediction service | Render, Singapore, free | Private service; the API reaches it over Render's internal network. |
| Valkey 8 (Key Value) | Render, free | BullMQ's queues. `maxmemoryPolicy: noeviction` — an evicted job is a reminder that never goes out. |
| MySQL 8.4.11 | **Aiven free**, DigitalOcean `blr` (Bangalore) | Render has no managed MySQL (Postgres + Key Value only), and Neon is Postgres-only, so MySQL had to come from outside. |

Blueprint: [render.yaml](render.yaml). Render service id for the API: `srv-dbl23695efls7380u7j0`.

---

## 4. Environment variables, and where each one lives

### Render — `fastrev-api`
Declared in [render.yaml](render.yaml). Three are `sync: false`, set in the Render dashboard and never committed:

- `DATABASE_URL` — TiDB Cloud MySQL-compatible connection string (currently using `?sslaccept=accept_invalid_certs` on Render pending CA hardening)
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD` (optional `BOOTSTRAP_ADMIN_SYNC_PASSWORD=true` synchronizes an existing admin's password on boot)

Optional when switching from console logging (`SMS_PROVIDER=console`) to live SMS (`SMS_PROVIDER=twilio`):
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`), plus optional `TWILIO_WEBHOOK_URL`.

### Render — `fastrev-ai`
`PORT=10000` and `MODEL_PATH=/app/models/no_show_model.joblib`.

### Vercel
`NEXT_PUBLIC_API_URL` → `https://fastrev-api.onrender.com/api/v1` (inlined at build time).

### Deployment integrations
- Vercel is connected directly to `jobayermannan/FastRev`, tracks `main`, and uses `frontend/` as the project Root Directory.
- Render's `fastrev-api` and `fastrev-ai` services are connected directly to the same repository and track `main` with Auto-Deploy enabled.
- GitHub Actions stores no production deployment tokens; `.github/workflows/ci.yml` remains the test/build workflow.

---

## 5. Completed in this follow-up pass

- **Workspace cleanup:** Moved unrelated projects (`audio-tests`, `productions`, `video-pilot`, `tools`, `drive-scan-report.json`, `drive-scan-summary.md`, `reference_contact_sheet.jpg`) out of `E:\FastRev` to `E:\`.
- **404 & cold-start reliability:** Added `frontend/src/app/icon.svg` + `frontend/public/favicon.ico`, decoupled `app.listen(env.PORT)` from sleeping-DB startup in `backend/src/server.ts` and `backend/docker-entrypoint.sh`, widened Prisma `503` wakeup handling in `errorHandler.ts`, added optional `BOOTSTRAP_ADMIN_SYNC_PASSWORD=true` in `bootstrap-admin.ts`, and added cold-start feedback + unit tests (`41` frontend tests, `52` backend unit tests, `6` AI service tests).
- **Model evaluation (`ai-service/training/evaluate.py` + `docs/model-evaluation.md`):** Automated baseline comparison across prevalence floor, smoothed history heuristic, `rule-v1` (both emergency `0.50` and validation-tuned), balanced logistic regression, and `xgboost-v1` (ROC-AUC, PR-AUC, Brier calibration, confusion matrices, returning-patient API cohort, operating-threshold sweep, and gain importances).
- **Explainable risk reason codes:** Implemented counterfactual marginal lift `reason_codes` in `ai-service/app/main.py` and persisted them through `backend/src/modules/predictions/predictions.service.ts` into `Prediction.reasonCodes` for `RiskBadge`.
- **Real SMS provider & inbound reply webhook:** Added `TwilioSmsProvider` (`SMS_PROVIDER=twilio`) with fail-fast Zod config validation and `POST /api/v1/notifications/webhooks/sms` with HMAC-SHA1 `X-Twilio-Signature` verification (`1` confirms, `2` cancels and frees the slot).
- **Continuous deployment:** Vercel and both Render web services now track `main` through native Git integrations; the obsolete token/deploy-hook workflow was removed.

---

## 6. Rules that remain in force

- **No `Co-Authored-By` line in commit messages.**
- Never touch `.env` or print secret values into a chat or a log.
- No destructive migration or reset against any non-test database (`backend/tests/setup.ts` guards `fastrev_test`).
- Start Docker Desktop only via `~/start-docker.ps1`; never reset Docker factory defaults.
