# Firebase Authentication Setup

Authentication is not active until both environment files exist.

## 1. Create Firebase Project

1. Go to Firebase Console.
2. Create a project.
3. Open Authentication.
4. Enable Email/Password sign-in.
5. Add a Web App and copy its config values.

## 2. Configure Expo App

Create `mobile/.env` from `mobile/.env.example`.

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

Restart Expo after editing env values.

```bash
cd "C:\Users\sreek\OneDrive\Belgeler\New project\mobile"
npm.cmd run web
```

Use `http://localhost:8081`, not the root `index.html`, for the Expo app.

## 3. Configure Backend

Create `backend/.env` from `backend/.env.example`.

```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kinledger
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The backend values come from Firebase Project Settings -> Service Accounts -> Generate new private key.

## 4. Configure PostgreSQL

Create the database, then run:

```bash
psql -d kinledger -f backend-schema.sql
psql -d kinledger -f backend/seed-plans.sql
```

## 5. Start Backend

```bash
cd "C:\Users\sreek\OneDrive\Belgeler\New project\backend"
npm.cmd run start:dev
```

## Common Failure Modes

- Browser is on `file:///.../index.html`: this is the static prototype, not the Expo app with Firebase auth.
- `mobile/.env` missing: Expo stays in demo mode and real login is hidden.
- Backend not running: login may succeed, but household sync fails.
- Firebase Admin private key has real line breaks instead of `\n`: keep it quoted as shown in `.env.example`.
