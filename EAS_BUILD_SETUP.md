# KinLedger EAS Build Setup

This project is configured for Expo EAS cloud builds.

## App IDs

- iOS bundle ID: `com.kinledger.app`
- Android package: `com.kinledger.app`
- URL scheme: `kinledger`

Change these before your first store submission if you want a different permanent app identifier.

## One-time setup

```bash
cd mobile
npm install -g eas-cli
eas login
eas init
```

After `eas init`, Expo may add an EAS project ID to `app.json`. Keep it.

## Development builds

Android APK:

```bash
npm run build:android:dev
```

iOS simulator build:

```bash
npm run build:ios:dev
```

## Preview builds

Android internal APK:

```bash
npm run build:android:preview
```

iOS internal/TestFlight-ready build:

```bash
npm run build:ios:preview
```

## Production builds

```bash
npm run build:android:production
npm run build:ios:production
```

## Store submission

```bash
npm run submit:android
npm run submit:ios
```

## Before production

- Deploy the backend and replace `https://api.kinledger.app/api` in `mobile/eas.json`.
- Add final app icon and splash assets.
- Configure Firebase iOS/Android apps for `com.kinledger.app`.
- Add Apple/Google in-app subscriptions for paid digital plans.
- Rotate all secrets that were pasted during setup.
