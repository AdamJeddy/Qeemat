# Design QA: Watchlist Store Filter

## Comparison Target

- Source visual truth: `C:\Users\Main\.codex\generated_images\019fa4b3-e73b-7ca2-a343-3f93541386d1\exec-9068c258-6352-4dad-af9a-8643f09fac6d.png` (selected concept 1, adapted to logo-only store controls).
- Existing application reference: `release\v0.5-alpha\screenshots\01-watchlist.png` (1080 x 2340).
- Intended implementation state: populated watchlist with more than one tracked store; All stores selected, then one store selected.

## Evidence Status

- Implementation screenshot: unavailable.
- Intended viewport: Android phone, including compact effective widths below 360px.
- Density normalization: blocked; a matching rendered Android screen could not be captured because ADB did not respond in this environment.
- Full-view and focused-region comparison: blocked pending a device/emulator screenshot of the implemented watchlist.

## Automated Checks

- Full Jest suite: 42 passed, 1 existing fixture skipped.
- TypeScript: passed.
- ESLint: no errors; one existing inline-style warning in `App.tsx`.
- Android `assembleDebug`: passed.

## Findings

- [P2] Visual confirmation is pending.
  Location: Watchlist store-filter rail.
  Evidence: the implementation cannot be compared with the selected design without a rendered Android screenshot.
  Impact: compact-width spacing, logo crop, selected-state visibility, and horizontal scrolling need real-device confirmation.
  Fix: install the generated debug APK on an Android device or emulator, add products from at least two stores, capture the All-stores and selected-store states, then compare the content region against the source visual.

## Required Fidelity Surfaces

- Fonts and typography: follows the existing `AppText` hierarchy in code; visual confirmation pending.
- Spacing and layout rhythm: 44px logo targets use the existing spacing/radius tokens; compact rail gap reduces to 6px; visual confirmation pending.
- Colors and visual tokens: selected state uses `blueSoft` with a primary-blue border; visual confirmation pending.
- Image quality and asset fidelity: reuses tracked stores' existing local `SiteIcon` assets; visual confirmation pending.
- Copy and content: logo-only controls expose store names through accessibility labels; visual confirmation pending.

## Implementation Checklist

1. Install the debug APK and seed at least two stores.
2. Verify logo-only rail scrolling, selected state, filtered count, in-stock section, and OOS section.
3. Capture matching screenshots and update this report with the comparison result.

final result: blocked
