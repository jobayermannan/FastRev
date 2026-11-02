# FastRev Background Workers (`/workers`)

Redis + BullMQ background job processors for FastRev:

- **`prediction-retry`**: Retries asynchronous no-show risk scoring against `/ai-service` when an appointment was booked during an AI service timeout or when historical patient attendance changes.
- **`notification-delivery`**: Delivers scheduled SMS/email appointment reminders (48h/4h high-risk cadence, 24h standard cadence) off the synchronous HTTP request path.

> **Note:** In single-repo container deployments (`docker-compose.yml`), `backend/src/worker/notification.worker.ts` shares the generated Prisma client directly with `/backend`. This standalone `/workers` workspace provides an isolated BullMQ consumer runtime and shared queue contract for independent scaling.

## Quick Start

```bash
cd workers
cp .env.example .env
npm install
npm run typecheck
npm run dev
```
