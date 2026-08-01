# iOS Implementation Handoff

Qeemat's shared React Native and TypeScript code is ready to host an iOS implementation, but this Windows checkout does not yet contain an `ios/` project. Create and validate that project on macOS with the React Native version pinned in `package.json`.

## Native contracts to implement

Keep the JavaScript-facing module names and method shapes aligned with `src/platform/`:

- `QeematBackgroundCheck`: schedule, run once, test once, and cancel background work. iOS does not implement Android battery-optimization methods; the shared UI already hides those controls.
- `QeematNotifications`: report authorization, request permission, open notification settings, and display local price alerts.
- `QeematWebViewFetcher`: return rendered page HTML when the standard network request is blocked.
- `QeematShare`: provide the initial shared text and emit `qeematShareReceived` for warm share events. The iOS share extension should pass shared text through an App Group or equivalent native handoff.

## Delivery sequence

1. Generate the React Native iOS project on macOS and confirm the shared app renders in a simulator.
2. Add signing, bundle identifiers, app icons, privacy declarations, and required capabilities.
3. Implement notification and share intake contracts, then validate them on a physical iPhone.
4. Implement best-effort background tasks and the WKWebView fetch fallback. Do not promise an exact daily execution time because iOS controls scheduling.
5. Run TypeScript, lint, Jest, simulator checks, physical-device checks, and a signed TestFlight archive.

Local AsyncStorage remains independent per device. Accounts, cloud sync, reliable server-side checking, and a tracking-capable web app remain separate backend work rather than prerequisites for the iOS client.
