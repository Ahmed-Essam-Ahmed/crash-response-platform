# SafeDrive — Hazem's part (Member B: Product, Emergency & Backend)

## First run in VS Code (Windows)

Open **VS Code → File → Open Folder → `D:\grad project\safedrive`**, then open the
terminal (**Ctrl + `**) and run these one at a time:

```powershell
flutter --version
flutter create . --project-name safedrive --org com.safedrive --platforms android,ios
flutter pub get
flutter analyze
flutter test
flutter run
```

- `flutter create .` only **adds** the missing `android/` and `ios/` folders. It
  does not overwrite `lib/`, `test/` or `pubspec.yaml`.
- `flutter run` needs a phone (USB debugging on) or an Android emulator. Pick
  the device from the bottom-right of VS Code, or press **F5**.
- iOS builds need a Mac. The `ios/` folder is still created so the project
  stays cross-platform.

## What runs today

Everything uses **mocks**, so the app runs with no Firebase and no real
sensors yet.

| Screen | Status |
|---|---|
| Splash → Onboarding (6 pages: what it does, detection, permissions, countdown, contacts, privacy) | ✅ |
| Home dashboard (System / GPS / Motion / Contacts / Detection ON-OFF, manual start) | ✅ |
| Driving Mode (speed + status, opens automatically when driving starts) | ✅ (fake GPS speed) |
| Emergency contacts (max 5, add/edit/delete, drag to reorder priority) | ✅ |
| Settings (countdown 10–60 s, confidence threshold, detection on/off) | ✅ |

## Folder layout (file 02 §2)

```
lib/
  domain/          ← SHARED CONTRACT with Ahmed. Don't edit alone.
  application/     ← app_services.dart (wiring), later EmergencyController impl
  services/
    mocks/         ← fake DrivingDetector + DetectionEngine (until Ahmed's land)
    storage/       ← contacts + settings repos (in-memory → drift/Firestore)
  presentation/    ← screens + cubits (BLoC)
docs/contract-draft-for-ahmed.md   ← choices to confirm in Week 1
```

When Ahmed's real `DrivingDetector` / `DetectionEngine` are ready, only
`lib/application/app_services.dart` changes.

## Next steps (from 05-tasks-hazem)

1. Review `lib/domain/` with Ahmed (see `docs/contract-draft-for-ahmed.md`) and commit it together.
2. **Step 3**: Firebase project (`flutterfire configure`): Auth, Firestore schema, rules, FCM.
3. **Step 5**: permission flows (motion, location "Always", notifications) on Android + iOS.
4. **Step 6**: `EventRepository` with drift + Firestore sync.
