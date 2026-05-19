# KinLedger Backend Deployment

The backend is ready to deploy as a hosted Node service.

## Recommended First Host

Use Render for the first deployment because this repo now includes `render.yaml`.

## Deploy on Render

1. Push this project to GitHub.
2. In Render, choose **New Blueprint**.
3. Select the repository.
4. Render will detect `render.yaml`.
5. Create the `kinledger-backend` web service.
6. Add the required environment variables below.
7. Deploy.

Health check:

```text
/api/health
```

## Required Environment Variables

Set these in the hosting provider dashboard:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=your-supabase-pooler-url
DATABASE_SSL=true
CORS_ORIGINS=https://your-mobile-web-preview.example,https://your-public-app-domain.example

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4.1-mini

APP_PUBLIC_URL=https://your-public-app-domain.example

EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-key
EMAIL_FROM=KinLedger <invite@yourdomain.com>

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Database

Your Supabase schema is already set up locally. If you create a fresh database, run:

```bash
cd backend
npm run db:setup
npm run db:migrate:device-tokens
npm run db:migrate:income
```

Do not put secrets into GitHub. Add them only in the hosting dashboard.

## After Deployment

If your hosted URL is:

```text
https://kinledger-backend.onrender.com
```

Then your mobile API URL is:

```text
https://kinledger-backend.onrender.com/api
```

Update:

- `mobile/eas.json`
- `mobile/.env`
- `backend APP_PUBLIC_URL`
- Firebase authorized domains, if needed

## Verify

Open:

```text
https://your-backend-host/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "kinledger-backend"
}
```
