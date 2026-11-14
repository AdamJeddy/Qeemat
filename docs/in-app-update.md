# In-app updates

Qeemat can download and install a newer GitHub release without leaving the app. This document records the shipped flow, its constraints and the device verification for issue #83.

## Flow

1. On launch (and from the 48-hour background check) Qeemat asks the GitHub releases API for a newer version. For the chosen release it selects an APK asset, preferring `arm64-v8a`, then a universal build, then any APK.
2. The update notice shows **Download and install**, with the release page still linked as **Release notes**.
3. Pressing the action downloads the APK inside the app to the app cache, over HTTPS only. GitHub hosts are allowlisted (`github.com` and `*.githubusercontent.com`); redirects are followed manually and each hop is re-checked.
4. After the download, Qeemat verifies the byte count against GitHub's asset size and, when the API publishes a digest, the SHA-256 against the downloaded bytes. A mismatch deletes the file and reports an error instead of opening the installer.
5. If Android has not been allowed to install apps from Qeemat, the notice explains this and opens **Settings → Install unknown apps → Qeemat**; the downloaded file is retained so **Install update** continues without downloading again.
6. Qeemat opens the standard Android install prompt from a `FileProvider` content URI. Android verifies the signing certificate before applying the update; a differently signed APK is rejected by the platform.

Progress is polled from the native module every 400 ms and shown as a percentage and a progress bar; the download can be cancelled, and dismissing the notice during a download cancels it.

## Implementation

- `src/domain/updates.ts` — release/version comparison and APK asset selection (URL, name, size, SHA-256 digest).
- `src/domain/appUpdate.ts` — typed bridge to the native module, with safe fallbacks when the module is missing (the notice then falls back to the GitHub release page link).
- `src/components/UpdateNotice.tsx` — idle, downloading, verifying, ready, installing and failed states, the permission hand-off, retry and cancellation.
- `android/app/src/main/java/com/qeemat/QeematAppUpdaterModule.kt` — streamed download, digest/size verification, cache file management and install intent.
- `android/app/src/main/res/xml/qeemat_file_paths.xml` and the `com.qeemat.fileprovider` provider in `AndroidManifest.xml` — expose only the update cache directory.
- `REQUEST_INSTALL_PACKAGES` permission in `AndroidManifest.xml`.

Both the background update notification and the in-app notice refer to the same in-app action; the notification still opens Qeemat.

## Verification (14 November 2026)

Samsung SM-S928B, Android 17 / API 37, 1440 × 3120, connected via wireless debugging. A verification build with `versionName` `0.5.5-alpha` and `versionCode` 4 was installed over the previous build so a real update was offered:

- The notice appeared for `0.6.0-alpha` with **Download and install** and **Release notes**. [screenshot](assets/app-update-2026-11-14/update-available.png)
- The download streamed the 25,621,040-byte release APK and showed live progress (7% → 62% → ready). [screenshot](assets/app-update-2026-11-14/download-progress.png)
- Windows Android settings: **Install unknown apps → Qeemat → Allow permission** was reached from the notice's permission hand-off. [screenshot](assets/app-update-2026-11-14/install-permission.png)
- Tapping **Install update** opened the standard Android prompt; Google Play Protect offered its usual pre-install scan for a sideloaded APK. [screenshot](assets/app-update-2026-11-14/install-prompt.png)
- After the install, `dumpsys package com.qeemat` reported `versionName=0.6.0-alpha` and `lastUpdateTime=2026-11-14 10:33:05`; Qeemat relaunched on the new version.

The download's SHA-256 digest matched GitHub's published `sha256:ff8f90db…`, and the same debug signing certificate as the installed build let Android apply the update. Automated coverage: `src/domain/__tests__/updates.test.ts`, `src/domain/__tests__/appUpdate.test.ts`, `src/components/UpdateNotice.test.tsx`.

## Limitations

- The download runs while Qeemat's process is alive; there is no foreground service and no resume after the process dies. If the app is killed, pressing the action again downloads the APK again.
- Dismissing the notice during a download cancels it; completed downloads are not persisted across app restarts.
- Play Protect or device-vendor install screens may add their own prompts for sideloaded APKs; Qeemat cannot bypass them and should not try to.
- The GitHub release must include an APK asset; releases without one are ignored by the update check, as before.
