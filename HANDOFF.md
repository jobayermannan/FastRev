# FastRev handoff — snapshot: 2026-10-17 (Asia/Dhaka)

এই নথি বর্তমান checkout ও এই চ্যাটে উপলব্ধ আলোচনা থেকে তৈরি একটি **স্থির snapshot**; এটি নিজে থেকে আপডেট হয় না। পুরোনো, এখানে অনুপলব্ধ কোনো চ্যাট দেখা হয়েছে বলে ধরে নেওয়া হয়নি। পরের কাজ শুরু করার আগে Git status ও প্রকল্পের ফাইল আবার যাচাই করুন।

## উদ্দেশ্য ও প্রযুক্তি

FastRev হলো ক্লিনিকের রোগী, ডাক্তার ও অ্যাপয়েন্টমেন্ট ব্যবস্থাপনার অ্যাপ। লক্ষ্য হলো অ্যাপয়েন্টমেন্টে রোগী না আসার ঝুঁকি আগে দেখানো, যাতে ক্লিনিক পরবর্তী পদক্ষেপ নিতে পারে। MVP-তে clinic admin login, patient/doctor management, booking এবং প্রতিটি appointment-এ risk score/badge চাওয়া হয়েছে। SMS/email reminder, BullMQ worker, trained ML model, payment ও file upload MVP-র বাইরে।

বর্তমান প্রযুক্তি: Express + TypeScript API (modular monolith), MySQL 8 + Prisma, JWT/bcrypt/Zod, Python FastAPI risk service, Vitest/Supertest, Docker Compose। Redis ও BullMQ dependency/Compose service আছে, কিন্তু কার্যকর reminder queue নেই। পরিকল্পিত frontend React + Vite; বাস্তবে এখনও তৈরি হয়নি। মূল পরিকল্পনা [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md), সিদ্ধান্ত [docs/adr/](docs/adr/) এবং বর্তমান risk rule [docs/model-evaluation.md](docs/model-evaluation.md)-এ।

## গুরুত্বপূর্ণ ফাইল

| পথ | কাজ |
| --- | --- |
| `README.md`, `docs/BUILD_SPEC.md`, `docs/adr/` | লক্ষ্য, build order, স্থাপত্য সিদ্ধান্ত; README-র status/setup এখন পুরোনো। |
| `docker-compose.yml`, `backend/Dockerfile`, `backend/Dockerfile.worker`, `ai-service/Dockerfile`, `frontend/Dockerfile` | service/build সংজ্ঞা; frontend Dockerfile `dist` কপি করে, কিন্তু frontend build project নেই। |
| `backend/src/app.ts`, `backend/src/server.ts` | API route mounting, middleware, startup। |
| `backend/src/common/config/env.ts`, `backend/src/common/prisma.ts`, `backend/src/common/middleware/`, `backend/src/common/utils/` | env validation, একক Prisma client, error/auth-adjacent middleware, pagination/idempotency helper। |
| `backend/src/modules/{auth,patients,doctors,appointments}/` | প্রতিটি module-এর routes/controller/service/schema (auth validation বর্তমানে controller-এ)। |
| `backend/src/modules/predictions/predictions.service.ts`, `ai-service/app/main.py` | timeout/fallback সহ scoring call এবং deterministic `rule-v1`। |
| `backend/src/bootstrap-admin.ts`, `backend/docker-entrypoint.sh` | ঐচ্ছিক env-নির্ভর প্রথম admin সৃষ্টি; container startup-এ migrate → bootstrap → API। |
| `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | ৭টি model ও migrations; `backend/src/prisma/schema.prisma` একটি পুরোনো duplicate। |
| `backend/tests/`, `ai-service/tests/` | unit/API tests; DB integration test আলাদা local test DB চাই। |
| `frontend/` | শুধু nginx Dockerfile; React/Vite source, package manifest ও `dist` অনুপস্থিত। |

## বাস্তবায়নের অবস্থা

- **ব্যাকএন্ড:** auth register/login/JWT, patient CRUD, admin-only doctor account/profile CRUD, admin-only booking/list/detail/status/prediction retry, pagination/filtering, 404/400/409 mapping, booking idempotency, duration overlap check ও status row lock কোডে আছে। Public registration সর্বদা `patient` role তৈরি করে। Admin bootstrap কোডে আছে। এগুলো unit/API স্তরে আংশিক পরীক্ষিত; চলমান MySQL-এ end-to-end যাচাই হয়নি।
- **Prediction:** `ai-service/training/`-এ reproducible synthetic-data generator, Logistic Regression baseline, XGBoost (`xgboost-v1`) training, validation-based threshold এবং evaluation report আছে। AI API artifact load করে; artifact অনুপস্থিত/ব্যর্থ হলে rule fallback ব্যবহার করে। বর্তমান metrics শুধুই synthetic demo data-র, বাস্তব clinic accuracy নয়। Backend failure-এ `unknown` row রেখে BullMQ retry job দেয়।
- **Worker/Redis:** worker এখন prediction retry এবং notification delivery queue process করে। High risk-এ 48h/4h এবং low/unknown-এ 24h reminder record/job তৈরি হয়; cancellation queued jobs-কে database-এ cancelled করে। Default `console` SMS provider কোনো external SMS পাঠায় না—delivery log করে। Real provider adapter/credentials, patient consent এবং live delivery validation বাকি।
- **Frontend:** login, patients, doctors, appointments/risk badge—কোনোটির UI নেই। তাই পূর্ণ MVP বা clean-checkout `docker compose up` success দাবি করা যাবে না।

## API, auth ও database

মূল route তালিকা `backend/src/app.ts` এবং সংশ্লিষ্ট `*.routes.ts`-এ। `POST /api/v1/auth/register` শুধু patient role; `POST /api/v1/auth/login` JWT দেয়। Protected route-এ `Authorization: Bearer <token>`; role checks `backend/src/modules/auth/auth.middleware.ts`-এ। Patients: `/api/v1/patients`-এ POST/GET এবং `/:id`-এ GET/PATCH/DELETE; GET admin/doctor, mutations admin। Doctors: `/api/v1/doctors`-এ POST/GET এবং `/:id`-এ GET/PATCH/DELETE; admin-only। Doctor POST body: `email`, `password`, `specialty`। Appointments: `/api/v1/appointments`-এ POST/GET, `/:id`-এ GET, `/:id/status`-এ PATCH, `/:id/prediction/retry`-এ POST; admin-only। Appointment POST: `patientId`, `doctorId`, offset-সহ `scheduledAt`, positive integer `durationMinutes`; patient enrollment ও booking-এ ঐচ্ছিক `Idempotency-Key` header। List filters/schema যথাক্রমে `patients.schema.ts` ও `appointments.schema.ts`-এ। API health: `GET /health`; AI: `GET /health`, `POST /predict/no-show-risk`।

Appointment status flow: `booked → confirmed → completed` অথবা `no_show`; `booked`/`confirmed` থেকে cancellation; cancelled slot মুক্ত হয়। `no_show` হলে patient-এর ভবিষ্যৎ booked/confirmed appointment prediction retry queue-তে যায়। `GET /api/v1/patients/:id/risk-profile` admin/doctor-কে attendance summary ও upcoming risk scores দেয়। একই doctor-এর overlapping uncancelled booking আটকাতে transaction-এ doctor row lock ও range query আছে; exact active start-এর unique key-ও আছে (`appointments.service.ts`)। MySQL schema-তে `User`, `Patient`, `Doctor`, `Appointment`, `Prediction`, `Notification`, `AuditLog`—৭ model। Notification delivery tracking-এর জন্য আরেকটি নতুন migration আছে। পুরোনো migration বদলানো হয়নি। **নতুন migrations বাস্তব MySQL-এ প্রয়োগ করে যাচাই করা হয়নি।**

## Setup ও চালানোর নির্দেশনা

প্রয়োজন: Docker Desktop-এর Linux daemon চালু, অথবা local Node/npm, Python ও একটি **স্বতন্ত্র test/development MySQL**। Root `README.md`-র `cp .env.example .env` ধাপ বর্তমানে ভুল: root `.env.example` নেই। `frontend/`-এ build source না থাকায় বর্তমান checkout-এ পুরো Compose build সফল হবে বলে বলা যায় না। কোনো বিদ্যমান non-test database-এ destructive migration/reset চালাবেন না।

Backend local (নিজের নিরাপদ env configuration ও MySQL প্রস্তুত থাকলে):

```powershell
cd backend
npm ci
npx prisma generate
npx prisma validate
npx prisma migrate deploy
npm run build
npm run db:seed    # BOOTSTRAP_ADMIN_EMAIL/PASSWORD সেট থাকলে
npm start          # অথবা npm run dev
```

`migrate deploy` লক্ষ্য database বদলায়; আগে URL ও database পরিচয় নিজে যাচাই করতে হবে। Container-এ `backend/docker-entrypoint.sh` স্বয়ংক্রিয়ভাবে migration ও admin bootstrap চালায়। Compose command: repository root-এ উপযুক্ত env দিয়ে `docker compose up --build`; **এটি এখনও সফলভাবে চালিয়ে যাচাই করা যায়নি**, এবং frontend বর্তমানে build blocker। Backend check: `cd backend; npm run typecheck; npm test; npm run build`। AI unit check: `cd ai-service; python -m unittest discover -s tests -v` (Python requirements `ai-service/requirements.txt`)। DB integration tests চালাতে `FASTREV_TEST_DATABASE_URL`-এ শুধু local `fastrev_test` database এবং `fastrev_test` user অনুমোদিত; guard `backend/tests/setup.ts`-এ।

Environment variable-এর **নাম/উদ্দেশ্য** (কোনো বাস্তব secret value এখানে নেই):

| নাম | উদ্দেশ্য |
| --- | --- |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Compose MySQL initialization। |
| `DATABASE_URL` | Backend/Prisma MySQL connection; Compose-এ internal `mysql` host লাগবে। |
| `JWT_SECRET`, `JWT_EXPIRY` | JWT signing secret (কমপক্ষে ৩২ অক্ষর) ও token lifetime। |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | প্রথম admin login; দুটো একসঙ্গে দিতে হয়, password কমপক্ষে ৮ অক্ষর। |
| `AI_SERVICE_URL`, `AI_PREDICT_TIMEOUT_MS` | AI service address (Compose-এ internal `ai-service` host) ও timeout; default 3000 ms। |
| `REDIS_URL` | ভবিষ্যৎ queue/worker connection; Compose-এ internal `redis` host। |
| `SMS_PROVIDER` | Open-source default `console`; এটি external SMS পাঠায় না। |
| `PORT`, `NODE_ENV`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `LOG_LEVEL` | API runtime ও auth rate limit/logging। |
| `FASTREV_TEST_DATABASE_URL` | কেবল dedicated local integration-test database; test guard দ্বারা সীমাবদ্ধ। |
| `VITE_API_URL` | ভবিষ্যৎ Vite frontend build-time API base URL; Compose-এ এখন runtime environment হিসেবে লেখা, frontend build নেই। |
| `MODEL_PATH` | AI Compose config-এ আছে; বর্তমান rule-based `main.py` মডেল ফাইল load করে না। |

`backend/.env.example` আছে, কিন্তু root Compose example ও bootstrap vars documentation অসম্পূর্ণ। `.env`-এর বাস্তব মান এই নথিতে পড়া বা লেখা হয়নি।

## এই চ্যাটের সিদ্ধান্ত ও সীমা

ব্যবহারকারী আগে project files পড়ে কাজ করতে, `BUILD_SPEC.md` ও বিদ্যমান modular structure মানতে, Zod/AppError/এক shared Prisma client ব্যবহার করতে, প্রয়োজন ছাড়া dependency না বাড়াতে, schema বদলালে নতুন migration দিতে এবং পুরোনো migration না ছুঁতে বলেছেন। অজানা বিষয় বা spec/code conflict হলে জানাতে হবে। `.env` স্পর্শ/secret প্রকাশ নয়; non-test DB-তে destructive command নয়; ছোট, পর্যায়ক্রমিক পরিবর্তনের পর থামতে হবে। পরে backend MVP দ্রুত শেষ করে frontend-এ আলাদা পর্যায়ে যাওয়ার নির্দেশ দিয়েছেন।

নির্দিষ্ট সিদ্ধান্ত: appointment-এ `durationMinutes` থাকবে; admin email/password/specialty দিয়ে doctor account+profile বানাবেন; প্রথম admin env credentials থেকে bootstrap হবে; MVP risk prior no-show + lead time rule, `high` threshold 0.5; উপরোক্ত status flow। Reminders/BullMQ/trained ML/payments/uploads MVP-র বাইরে। এই handoff কাজের জন্য application code, install, commit, push বা deploy করা নিষিদ্ধ।

## পরিচিত ফাঁক, বিরোধ ও অনিশ্চয়তা

1. **সবার আগে:** frontend source/package/build নেই; `frontend/Dockerfile` অনুপস্থিত `dist` কপি করে। Root `.env.example` নেই, অথচ README তা ব্যবহার করতে বলে। `docker compose up` clean checkout-এ যাচাই হয়নি।
2. নতুন migrations, Redis queue, trained-model Docker image এবং doctor/appointment বাস্তব DB/API flow পরীক্ষিত নয়। Docker Desktop Linux daemon আগের যাচাইয়ে চালু ছিল না। বর্তমান daemon অবস্থা আবার যাচাই করা হয়নি।
3. `BUILD_SPEC.md`-এর overlap rule এখনও `doctor_id + scheduled_at` compound unique constraint চায়; বর্তমান implementation তা nullable `activeSlotKey` unique + doctor lock/range query-তে বদলেছে, যাতে cancelled একই-start slot rebook করা যায়। এটি spec/code disagreement; পরের পরিবর্তনের আগে ব্যবহারকারীর সঙ্গে মেলাতে হবে।
4. Spec AI failure retry queue এখন আছে, কিন্তু live SMS provider নেই। Twilio commercial service; open-source core-এর জন্য provider-neutral interface ও console default করা হয়েছে। বাস্তব SMS provider, opt-in/opt-out এবং sender identity পরের সিদ্ধান্ত। Spec-এর frontend-এ admin/patient dashboard ও revenue-saved metric আছে; ব্যবহারকারীর MVP-তে login, patients, appointments/risk badge আগে।
5. README-র status, setup ও AI port বিবরণ পুরোনো; `backend/src/prisma/schema.prisma` duplicate পুরোনো schema; cleanup বাকি। Backend `.env.example`-এ bootstrap vars নেই।
6. `backend/Dockerfile.worker` runner image-এ generated Prisma client আছে কি না container build দিয়ে যাচাই করা হয়নি; worker নিজেই placeholder। AI retry ব্যর্থ হলে পূর্বের score `unknown` দিয়ে overwrite হতে পারে (`predictions.service.ts`); আচরণটি পর্যালোচনার বিষয়।
7. `backend/package-lock.json`-এ বড় diff আছে; dependency install/lockfile পরিবর্তনের কারণ এখানে পৃথকভাবে যাচাই হয়নি। `backend/audit.json` এবং Python `__pycache__` untracked artifact; অনুমতি ছাড়া মুছবেন না।

## পরীক্ষা ও Git snapshot

এই চ্যাটে সর্বশেষ `npm run typecheck`, `npm run build`, `npx prisma validate`, `git diff --check` সফল হয়েছিল; backend Vitest: **28 passed, 7 skipped** (DB integration-এর URL ছিল না); Python unittest: **4 passed**। Synthetic training run-এ XGBoost F1 0.4233, Logistic F1 0.4037 এসেছে; এগুলো বাস্তব performance নয়। `docker version` Docker Desktop Linux engine-এ connect করতে পারেনি; Compose/container/migration smoke test হয়নি।

Git: branch `main` (tracking `origin/main`), HEAD `d1e06450ef19ce6c44057fcf53cff4b6ae102ae2`। অনেক uncommitted পরিবর্তন আছে; সেগুলো commit/push করা হয়নি। Tracked changes: AI rule ও Dockerfile, backend auth/error/app wiring, worker Dockerfile, entrypoint, package/lockfile, Prisma schema, Compose, BUILD_SPEC। Untracked: নতুন modules/tests/utils/bootstrap, তিনটি 2026-10-04 migrations এবং 2026-08-31 patient-count migration, AI tests, model-evaluation/ADR-003, duplicate schema/worker files, `backend/audit.json`, Python caches। নতুন `HANDOFF.md`-ও untracked থাকবে। `git diff --stat` untracked ফাইল দেখায় না; status দেখুন। বিদ্যমান uncommitted কাজের কোনটি কার লেখা, তা সম্পূর্ণ যাচাই করা যায়নি—সংরক্ষণ করুন।

## এরপর কী করবেন

1. Docker daemon ও নিরাপদ dedicated test DB উপলব্ধ হলে নতুন migration, Redis worker, admin bootstrap, doctor→patient→booking→trained risk→reminder, overlap/cancel/rebook ও AI fallback end-to-end যাচাই করুন। Non-test DB reset করবেন না।
2. Consent/opt-out ও sender policy ঠিক করে একটি configured real SMS provider adapter যোগ করুন; provider key কখনো repository-তে রাখবেন না।
3. De-identified, consented historical attendance data পেলে synthetic data বদলে real training/evaluation, calibration, drift monitoring এবং approved-model comparison যোগ করুন।
4. React + Vite frontend তৈরি করুন: admin login, patient/doctor management, appointment booking/list/status, risk badge ও patient risk-profile view; `VITE_API_URL` যেন Docker build-এ সত্যি প্রয়োগ হয়।
5. README এবং root/backend example env ঠিক করুন; duplicate Prisma schema সরানোর আগে references পরীক্ষা করুন; Compose clean-checkout build যাচাই করুন। CI/lint এবং spec/documentation mismatch মেলান।

## Continue from here (নতুন চ্যাটে কপি করুন)

> FastRev repo-র `HANDOFF.md` (2026-10-17 snapshot), `README.md`, `docs/BUILD_SPEC.md`, current code এবং `git status` পড়ে শুরু করো। বিদ্যমান uncommitted কাজ সংরক্ষণ করো। AI training, prediction retry, reminder queue এবং console SMS provider আছে, কিন্তু migrations/Redis/Compose end-to-end যাচাই হয়নি; frontend এখনও নেই। প্রথমে dedicated test DB-তে migration ও worker flow যাচাই করো, তারপর provider-neutral live SMS adapter বা frontend scope নিয়ে আমার নির্দেশ মেনে কাজ করো। `.env` বা secrets ছুঁয়ো না, non-test DB-তে destructive command চালিও না; phase শেষে test/status জানিয়ে থামো।
