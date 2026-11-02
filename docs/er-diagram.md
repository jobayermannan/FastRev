# FastRev — Entity-Relationship Diagram

Canonical relational schema managed by Prisma in [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

```mermaid
erDiagram
    USERS ||--o| PATIENTS : "optional portal account"
    USERS ||--o| DOCTORS : "doctor credentials"
    USERS ||--o{ PATIENTS : "enrolled_by_admin_id"
    USERS ||--o{ AUDIT_LOGS : "records actions"
    PATIENTS ||--o{ APPOINTMENTS : "books"
    DOCTORS ||--o{ APPOINTMENTS : "attends"
    APPOINTMENTS ||--o| PREDICTIONS : "has 1:1 risk score"
    APPOINTMENTS ||--o{ NOTIFICATIONS : "schedules reminders"

    USERS {
        string id PK "UUID"
        string email UK
        string password_hash
        string role "admin | doctor | patient"
        datetime created_at
    }

    PATIENTS {
        string id PK "UUID"
        string user_id FK,UK "nullable"
        string idempotency_key UK "nullable"
        string enrolled_by_admin_id FK
        string name
        string phone
        date date_of_birth
        int prior_no_show_count
        int completed_appointment_count
        int total_appointment_count
        datetime created_at
    }

    DOCTORS {
        string id PK "UUID"
        string user_id FK,UK
        string specialty
    }

    APPOINTMENTS {
        string id PK "UUID"
        string patient_id FK
        string doctor_id FK
        datetime scheduled_at
        int duration_minutes "default 30"
        string active_slot_key UK "doctorId:timestamp when active, NULL when cancelled"
        string idempotency_key UK "nullable"
        string status "booked | confirmed | completed | no_show | cancelled"
        datetime created_at
    }

    PREDICTIONS {
        string id PK "UUID"
        string appointment_id FK,UK
        float no_show_probability "nullable (0.0 - 1.0)"
        string risk_level "low | high | unknown | new_patient"
        json reason_codes "nullable array of explainability codes"
        string model_version
        datetime created_at
    }

    NOTIFICATIONS {
        string id PK "UUID"
        string appointment_id FK
        string dedupe_key UK "nullable"
        string channel "sms | email"
        string type "standard_reminder | high_risk_reminder"
        string status "queued | retrying | sent | failed | cancelled"
        datetime scheduled_at "nullable"
        datetime sent_at "nullable"
        int attempts
        string error_message "nullable"
        string provider_message_id "nullable"
    }

    AUDIT_LOGS {
        string id PK "UUID"
        string user_id FK
        string action
        string entity
        datetime created_at
    }
```

## Key Relational Constraints

1. **Doctor Slot Uniqueness & Indexing**:
   - `appointments.active_slot_key` (`@unique`) prevents two non-cancelled appointments from claiming the exact same `(doctor_id, scheduled_at)` slot at the storage engine level while permitting cancelled slots (`active_slot_key = NULL`) to be rebooked.
   - `@@index([doctorId, scheduledAt])` accelerates range overlap queries inside `SELECT ... FOR UPDATE` booking transactions.
2. **One-to-One Appointment Prediction**:
   - `predictions.appointment_id` (`@unique`) guarantees at most one current risk assessment per appointment, updated atomically via `prisma.prediction.upsert`.
3. **Idempotent Mutations & Deduplicated Notifications**:
   - `patients.idempotency_key` (`@unique`) and `appointments.idempotency_key` (`@unique`) prevent duplicate records on network retries.
   - `notifications.dedupe_key` (`@unique`) prevents duplicate scheduled reminders across prediction re-scores.
