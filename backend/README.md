# KinLedger Backend

Production backend foundation for the budgeting app.

## Stack

- NestJS HTTP API
- PostgreSQL using `pg`
- Firebase Admin token verification
- Zod request validation

## Setup

1. Create a PostgreSQL database.
2. Apply the root `backend-schema.sql` file.
3. Seed the `plans` table.
4. Copy `.env.example` to `.env` and fill Firebase service account values.

```bash
cd backend
npm install
npm run start:dev
```

## Auth

All private routes require:

```http
Authorization: Bearer <Firebase ID token>
```

Firebase client SDK runs in the mobile app. This API verifies the ID token with Firebase Admin and syncs the user into the local `users` table.

## Main Routes

- `GET /api/plans`
- `GET /api/users/me`
- `POST /api/users/me`
- `GET /api/households`
- `POST /api/households`
- `POST /api/households/:householdId/invites`
- `GET|POST /api/households/:householdId/expenses`
- `GET|POST /api/households/:householdId/tasks`
- `PATCH /api/households/:householdId/tasks/:taskId/complete`
- `GET|POST /api/households/:householdId/subscriptions`
- `GET|POST /api/households/:householdId/goals`
- `GET|POST /api/households/:householdId/net-worth`
- `GET /api/households/:householdId/notifications`
- `POST /api/households/:householdId/notifications/rules`
- `POST /api/households/:householdId/assistant/ask`

## Next Integrations

- Add Firebase client SDK to the Expo app.
- Add a typed mobile API client.
- Add FCM device-token registration.
- Replace the local AI response with OpenAI API calls after permission-filtered budget summaries are stable.
- Add RevenueCat or native IAP before App Store subscription submission.
