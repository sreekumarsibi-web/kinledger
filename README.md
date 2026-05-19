# KinLedger Budget App MVP

Mobile-first collaborative budgeting MVP for single users, couples, and families. The current workspace ships as a no-build web prototype so the flows can be opened directly from `index.html`.

## Included MVP Flows

- Email/phone login mock with separate user profiles.
- Single, couple, and family account types.
- Spouse/family invite model with permission levels.
- Free, Premium Single, Premium Couple, and Premium Family plan selection with monthly/yearly billing.
- Manual and quick-add expense tracking.
- Personal, shared, and split expense scopes.
- Smart reminder settings for expense, evening, missed, bill, subscription, goal, task, and overspending nudges.
- Husband/wife task assignment with due date, priority, notes, completed, pending, and missed states.
- Recurring subscription tracking with monthly burn rate and cancel recommendation copy.
- Basic analytics for category spending, shared vs personal spending, savings ratio, and overspend risk.
- Goal setting with monthly contribution suggestions.
- Net worth tracking for assets and liabilities.
- AI assistant simulation for overspending explanation, savings suggestions, and affordability checks.
- Privacy and security settings for biometric login, PIN lock, private expenses, and linked-user permissions.

## Suggested Production Architecture

- Frontend: Flutter or React Native.
- Backend: Node.js/NestJS with modular services for auth, households, expenses, tasks, goals, subscriptions, notifications, billing, and AI.
- Database: PostgreSQL using the schema in `backend-schema.sql`.
- Auth: Firebase Auth for email/phone authentication.
- Push: Firebase Cloud Messaging.
- Payments: Stripe and/or Razorpay.
- AI: OpenAI API with household-scoped budget summaries and strict permission filtering.

## RBAC Model

- `owner`: Manages household, billing, members, permissions, shared data.
- `spouse`: Creates shared expenses, assigns tasks, views household analytics based on permission.
- `parent`: Similar to spouse for family plans.
- `child`: Limited shared expense/task access.
- `shared_only`: Can view and edit shared items only.
- `summary`: Can view household summaries without private expense details.
- `full`: Can view household-level analytics and shared records; private expenses stay hidden unless explicitly allowed.

## Local Run

Open `index.html` in a browser. Data persists in `localStorage` under `kinledger-budget-mvp`.

## Mobile App Foundation

An Expo React Native implementation now lives in `mobile/`.

```bash
cd mobile
npm install
npm run start
```

The current mobile app uses local React state and mirrors the MVP flows from the web prototype. The next production step is replacing local state mutations with NestJS API calls backed by `backend-schema.sql`.

## Backend + Firebase

The production backend foundation lives in `backend/`.

```bash
cd backend
npm install
npm run build
npm run start:dev
```

Copy `backend/.env.example` to `backend/.env`, apply `backend-schema.sql` to PostgreSQL, then run `backend/seed-plans.sql`.

The Expo app now includes a first production auth path:

- `mobile/src/services/firebase.js`
- `mobile/src/services/api.js`
- `mobile/.env.example`

Copy `mobile/.env.example` to `mobile/.env` and fill Firebase web app values. The app will then show login/register, sync the Firebase user to `/api/users/me`, load `/api/households`, and let the user create the first household. The rest of the MVP screens still use local demo state until each module is connected to its matching backend endpoint.

If authentication is not appearing or login fails, follow [AUTH_SETUP.md](</C:/Users/sreek/OneDrive/Belgeler/New project/AUTH_SETUP.md>).
