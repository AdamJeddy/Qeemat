# In-app updates

Qeemat can download and install a newer GitHub release without leaving the app. This document records the shipped flow, its constraints and the device verification for issue #83.

## Flow

1. On launch Qeemat asks the GitHub releases API for a newer version. For the chosen release it selects an APK asset, preferring `arm64-v8a`, then a universal build, then any APK.
2. If a newer version exists, an **update popup** opens over the app: the version, **Download and install**, **Release notes** and a close button. It opens once per release; closing it remembers that version.
3. Closing the popup adds red badges to the Watchlist bell and the Activity tab. Activity also keeps a pinned **Qeemat update available** item that opens the popup again. The badges stay until the installed version is the latest, when the popup, badges and pinned item all disappear.
4. Pressing **Download and install** downloads the APK inside the app to the app cache, over HTTPS only. GitHub hosts are allowlisted (`github.com` and `*.githubusercontent.com`); redirects are followed manually and each hop is re-checked.
5. After the download, Qeemat verifies the byte count against GitHub's asset size and, when the API publishes a digest, the SHA-256 against the downloaded bytes. A mismatch deletes the file and reports an error instead of opening the installer.
6. If Android has not been allowed to install apps from Qeemat, the popup explains this and opens **Settings → Install unknown apps → Qeemat**; the downloaded file is retained so **Install update** continues without downloading again.
7. Qeemat opens the standard Android install prompt from a `FileProvider` content URI. Android verifies the signing certificate before applying the update; a differently signed APK is rejected by the platform.

Progress is polled from the native module every 400 ms and shown in the popup as a percentage, transferred size and progress bar. The download can be cancelled, and closing the popup during a download cancels it.

## Implementation

- `src/domain/updates.ts` — release/version comparison and APK asset selection (URL, name, size, SHA-256 digest).
- `src/domain/updatePrompt.ts` — the dismissed-release memory used to badge the bell instead of reopening the popup on every launch.
- `src/domain/appUpdate.ts` — typed bridge to the native module, with safe fallbacks when the module is missing (the popup then falls back to the GitHub release page link).
- `src/components/UpdateNotice.tsx` — the modal popup and its idle, downloading, verifying, ready, installing and failed states, the permission hand-off, retry and cancellation.
- `App.tsx` — the release check, popup visibility, bell badge and the pinned Activity item.
- `android/app/src/main/java/com/qeemat/QeematAppUpdaterModule.kt` — streamed download, digest/size verification, cache file management and install intent.
- `android/app/src/main/res/xml/qeemat_file_paths.xml` and the `com.qeemat.fileprovider` provider in `AndroidManifest.xml` — expose only the update cache directory.
- `REQUEST_INSTALL_PACKAGES` permission in `AndroidManifest.xml`.

Both the background update notification and the in-app popup refer to the same in-app action; the notification still opens Qeemat.

## Verification (14 November 2026)

Samsung SM-S928B, Android 17 / API 37, 1440 × 3120, connected via wireless debugging. Verification builds use `versionName` `0.5.5-alpha` and `versionCode` 4 so a real `0.6.0-alpha` release is offered while the signing key and version code stay compatible:

- The update popup appeared over the Watchlist for `0.6.0-alpha` with **Download and install** and **Release notes**. [screenshot](assets/app-update-2026-11-14/update-available.png)
- Closing the popup added red badges to the bell and the Activity tab. [Watchlist](assets/app-update-2026-11-14/update-bell-badge.png)
- Activity showed the pinned update item; the Activity badge stayed visible while the update was pending. [pinned item](assets/app-update-2026-11-14/activity-pinned-update.png)
- The pinned item reopened the popup. Downloading from it streamed the 25,621,040-byte release APK with live progress, size and percentage. [screenshot](assets/app-update-2026-11-14/download-progress.png)
- Windows Android settings: **Install unknown apps → Qeemat → Allow permission** was reached from the popup's permission hand-off. [screenshot](assets/app-update-2026-11-14/install-permission.png)
- The standard Android install prompt opened; Google Play Protect offered its usual pre-install scan for a sideloaded APK. [screenshot](assets/app-update-2026-11-14/install-prompt.png)
- After the install, `dumpsys package com.qeemat` reported `versionName=0.6.0-alpha` and a fresh `lastUpdateTime`; Qeemat relaunched on the new version with no popup, no bell or Activity badges and no pinned Activity item. [screenshot](assets/app-update-2026-11-14/badges-after-update.png)

The download's SHA-256 digest matched GitHub's published `sha256:ff8f90db…`, and the same debug signing certificate as the installed build let Android apply the update. Automated coverage: `src/domain/__tests__/updates.test.ts`, `src/domain/__tests__/appUpdate.test.ts`, `src/domain/__tests__/updatePrompt.test.ts`, `src/components/UpdateNotice.test.tsx`.

## Limitations

- The download runs while Qeemat's process is alive; there is no foreground service and no resume after the process dies. If the app is killed, pressing the action again downloads the APK again.
- Closing the popup during a download cancels it; completed downloads are not persisted across app restarts.
- A dismissed release stays dismissed until the update is installed; the bell and Activity badges and the pinned item keep the update reachable in the meantime.
- Play Protect or device-vendor install screens may add their own prompts for sideloaded APKs; Qeemat cannot bypass them and should not try to.
- The GitHub release must include an APK asset; releases without one are ignored by the update check, as before.
