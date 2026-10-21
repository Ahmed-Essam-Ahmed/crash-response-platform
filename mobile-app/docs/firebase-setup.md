# Firebase — the last part that needs YOUR Google account (steps 3, 9, 15)

Everything else is already in the app. These steps connect it to a backend.

## What is free
| Service | Plan | Cost |
|---|---|---|
| Authentication, Firestore, FCM push | Spark (free) | 0 |
| Cloud Functions (`firebase/functions`) | Blaze (needs a card) | free tier covers a demo |

If you cannot add a card, skip Cloud Functions: the app already sends alerts
directly through the Telegram bot (`secrets.json`).

## 1. Create the project (5 min, browser)
1. https://console.firebase.google.com → **Add project** → name `safedrive` → Analytics off.
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Build → Firestore Database → Create database → Production mode → location `eur3`**.

## 2. Connect the Flutter app (terminal, in `D:\grad project\safedrive`)
```powershell
npm install -g firebase-tools
firebase login
dart pub global activate flutterfire_cli
flutterfire configure --project=<your-project-id> --platforms=android,ios
flutter pub add firebase_core firebase_auth cloud_firestore firebase_messaging
```
`flutterfire configure` creates `lib/firebase_options.dart`.

## 3. Deploy the security rules (+ functions if Blaze)
```powershell
cd firebase
firebase use <your-project-id>
firebase deploy --only firestore:rules
# optional (Blaze):
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase deploy --only functions
```

## 4. Tell Claude "Firebase is ready"
Claude then adds (≈4 files, no other change — interfaces already exist):
- `Firebase.initializeApp` in `AppServices.init()`
- sign-in / sign-up screen (FR-01)
- `FirestoreRemoteSink implements RemoteSink` → `SqlEventStore.remote` (offline-first sync is already built)
- FCM token registration + notification tap → opens the map link (step 15)

## Data model (file 02 §7) — already enforced by `firebase/firestore.rules`
```
users/{uid}: name, phone, settings{countdownSec, confidenceThreshold}, telegramChatIds[]
users/{uid}/emergencyContacts/{id}: name, phone, fcmToken?, priority
users/{uid}/sessions/{id}: startTime, endTime, distance, maxSpeed
users/{uid}/accidents/{id}: timestamp, sessionId, class, confidence, severity,
    maxAccel, maxGyro, speedBefore, speedAfter, rollover, location(geopoint),
    status(cancelled|dispatched), sensorWindowRef
sensorWindows/{id}: ownerUid, compressed samples (gzip, same format as SQLite)
```
