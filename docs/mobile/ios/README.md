# XMobile iOS App Guide

This document details the iOS-specific configuration, commands, and setup for the XMobile React Native application.
> **Note**: Full iOS support is slated for Phase 2, but the infrastructure is present.

## Getting Started

1. **Install Dependencies (CocoaPods)**:
   Since iOS uses CocoaPods for native dependencies, you must install them before building:
   ```bash
   cd ios
   bundle install
   bundle exec pod install
   cd ..
   ```
   *You must run `pod install` every time a new native dependency is added to the project.*

2. **Start Metro Bundler**:
   From the `mobile` directory, start the Metro dev server:
   ```bash
   yarn start
   ```

3. **Run in Development**:
   With Metro running, start the app on an iOS Simulator or connected device:
   ```bash
   yarn ios
   ```

## Building in Xcode

Alternatively, you can open the workspace file directly in Xcode:

1. Run `bundle install` and `bundle exec pod install` from `mobile/ios` (see above) so `mobile.xcworkspace` exists.
2. Open Xcode → **Open a project or file**.
3. Open **`mobile/ios/mobile.xcworkspace`** (use the **`.xcworkspace`**, not `mobile.xcodeproj`).
4. Select your target device/simulator and press **Run** (⌘R).

## GitHub Actions: manual TestFlight upload

The workflow **iOS TestFlight upload** (`.github/workflows/ios-testflight-release.yml`) runs **only** from **Actions → Run workflow**. It does not run on push or PR.

It uses two jobs: **Build IPA** (compile, sign, export) and **Upload to TestFlight** (`fastlane pilot`). After processing, the build appears under **TestFlight**. It does **not** submit for App Review or release to the public App Store.

If **upload** fails but **build** succeeded, open that workflow run → **Re-run failed jobs** to retry only upload (GitHub keeps the IPA artifact from the successful build for that run).

**Prerequisite:** In [App Store Connect](https://appstoreconnect.apple.com) → **My Apps**, create an app with bundle ID **`com.xmobile.app`** (same as Xcode) before the first upload. Pilot cannot create that record for you.

The workflow caches **`mobile/node_modules`**, **`mobile/ios/Pods`**, and Bundler gems (`ruby/setup-ruby` + `mobile/Gemfile.lock`) using keys derived from `yarn.lock`, `package.json`, `Podfile`, `Gemfile.lock`, and `project.pbxproj` so caches invalidate when native deps or Ruby tooling change. If a run ever looks wrong after a tooling upgrade, bump the `-v1` suffix on those cache keys in the workflow file to force a cold restore.

### Optional: require approval before the job runs

The job uses GitHub Environment **`ios-appstore-release`**. To require another maintainer to approve before secrets are exposed to the runner:

1. On GitHub: **Settings** → **Environments** → **New environment** → name **`ios-appstore-release`** (must match exactly).
2. Under **Deployment protection rules**, enable **Required reviewers** and add trusted people (or a team, on org plans that support it).
3. Save. The first time the workflow runs, GitHub may create the environment automatically without rules; add reviewers before you rely on this gate.

Because **Build** and **Upload** both use this environment, **required reviewers** may prompt **twice** per run (once per job). To avoid that, move secrets to **repository** secrets, or split environments (e.g. build secrets vs upload-only), or accept two approvals.

If both **Build** and **Upload** use this environment and you use **required reviewers**, GitHub may ask for approval **once per job** in the same run. To avoid a second gate, keep upload-only secrets on this environment and move build/signing secrets to **repository** secrets, or accept two approvals.

### Repository or environment secrets (Settings → Secrets and variables → Actions)

Create these secrets as **repository** secrets **or** (as you did) under the **`ios-appstore-release`** environment — **same names**. Environment-only secrets are only available when the job uses that environment.

| Secret | What it is |
|--------|----------------|
| `IOS_DEVELOPMENT_TEAM` | Your **10-character Apple Team ID** (Membership details in [Apple Developer Account](https://developer.apple.com/account)). |
| `IOS_DISTRIBUTION_CERT_P12_BASE64` | **Base64** of a **Distribution** certificate + private key exported as **`.p12`** from Keychain Access (or created in the portal and exported). Must match the cert used for App Store builds. |
| `IOS_DISTRIBUTION_CERT_P12_PASSWORD` | Password you set when exporting that `.p12`. |
| `IOS_CI_KEYCHAIN_PASSWORD` | Any strong random string; used only to create a temporary keychain on the runner (not your Apple password). |
| `IOS_APPSTORE_PROVISIONING_PROFILE_BASE64` | **Base64** of the **App Store** provisioning profile for `com.xmobile.app` (download from [Profiles](https://developer.apple.com/account/resources/profiles/list); type **App Store**). |
| `IOS_PROVISIONING_PROFILE_NAME` | The profile’s **Name** field exactly as shown in the Apple developer portal (used in export options; often not the same as the `.mobileprovision` filename). |
| `IOS_GOOGLESERVICE_INFO_PLIST_BASE64` | **Base64** of your real `GoogleService-Info.plist` (this file is not committed to the repo). |
| `IOS_APP_STORE_CONNECT_API_KEY_JSON` | One JSON file used by Fastlane for upload, with keys **`key_id`**, **`issuer_id`**, and **`key`** (the `.p8` private key PEM as a string, including `\\n` for newlines if stored on one line). Create the key under [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → **Integrations** → **App Store Connect API** → **Team keys** (role must allow uploads, e.g. **App Manager** or **Admin**). |
| `IOS_APP_STORE_CONNECT_ITC_TEAM_ID` | **Optional.** Numeric **App Store Connect** team ID (shown when you click your name in the top-right of App Store Connect). Set this if Fastlane picks the wrong team or you have multiple teams. Not the same as the 10-character Apple Developer **Team ID**. |

**How to base64 a file (macOS):** `base64 -i YourFile.p12 | pbcopy` then paste into the secret. For the provisioning profile: `base64 -i YourProfile.mobileprovision | pbcopy`. For plist: `base64 -i GoogleService-Info.plist | pbcopy`.

**API key JSON example** (store the whole thing as the secret value; replace with your real key):

```json
{
  "key_id": "ABCDE12345",
  "issuer_id": "12345678-1234-1234-1234-123456789012",
  "key": "-----BEGIN PRIVATE KEY-----\\nMII...\\n-----END PRIVATE KEY-----\\n"
}
```

If your `.p8` uses real newlines, you can paste multi-line JSON into the secret; GitHub accepts it.

### Run the workflow

**Actions** → **iOS TestFlight upload** → **Run workflow** (pick branch if needed).
