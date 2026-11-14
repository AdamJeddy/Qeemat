# Qeemat UI and design-system handover

**Handover date:** 13 November 2026. This is a working-branch handover, not a claim that the app-wide redesign is complete. Confirm the current code and GitHub state before continuing.

## User's objective and working style

Qeemat is an Android-first, local-first UAE shopping price tracker. The user wants the app to feel modern, simple, and useful for monitoring prices. They asked for a genuine design system and a coherent product experience, not isolated cosmetic changes or an agent announcing that a partially implemented concept is complete.

The user wants the next agent to lead the design conversation, ground decisions in what the app actually does, review complete screens and states, and check the real rendered app. They value precise, concise explanations, practical device verification, preserving existing behavior, and small conventional commits. They explicitly requested normal branch names such as `feat/...` or `fix/...`, not `work/...` or `codex/...`. Do not make a new branch or push/open a PR unless the current user instruction calls for it; verify current state first.

## Accepted design direction

- **Feel:** clean and practical, compact and calm, but not bland. The user was open to another palette or gradients, then chose a direction close to Qeemat's existing blue, with flatter button colors. Subtle borders and restrained surfaces are preferred; use color to clarify hierarchy, selection and price status.
- **Reference:** the first of the final Watchlist banner variants was selected, after the user liked the elements and icons of an earlier second concept but wanted less visually loud colors. The selected image is currently at `C:\Users\Main\.codex\generated_images\01a1b16e-d8bd-7e13-bc0e-a05297fb8d9b\exec-e47a4ab7-a4f9-4ec9-b37a-c12961eef8d1.png`. This is a machine-local generated artifact, not a repository asset; do not assume it exists in another environment. Inspect it before implementing changes or ask for the reference if it is unavailable.
- **Watchlist hierarchy:** product title, current or last-known price and meaningful price change are the important information. Preserve retailer, selected variant, last check and truthful stock/failure state. The selected concept used a blue top banner, white wordmark and controls, a count pill, flat toolbar, pale out-of-stock section, compact separated product rows, a floating circular add button, and a pale-blue bottom navigation with a compact selected state.
- **Floating add button:** the user explicitly rejected the separate white dock because it wastes space and looks odd. Restore and retain the circular button floating over the list even if it can cover content. Do not reintroduce a full-width dock or classify the overlap alone as a defect requiring a dock. Leave enough bottom scroll padding for the final product to be scrolled clear.
- **System bar:** on Watchlist, the user requested the Android status area be blue with white icons/text. Other screens currently keep their light status bar. Test on an actual modern Android device because Android edge-to-edge behavior affects status-bar colors.
- **Truth over decoration:** Activity exists as a history of price/availability events, not a notification inbox. The Watchlist bell opens Activity and has no invented unread dot. Do not add fake notification states or made-up product metadata. Use real product images, retailer details, prices and selected variants.

## Current implementation

### Watchlist and navigation

`App.tsx` implements the manual tab/route stack; `WatchlistScreen` renders the blue header, Qeemat app mark, Search and Activity shortcuts, a bookmark count pill, filter/sort, archive and recheck actions, the collapsible out-of-stock section, flat list and floating add button. `src/components/ProductCard.tsx` renders compact, divided rows with real price direction, retailer, useful variant/folder/category and last check. It keeps selection, stock and error behavior.

The bottom navigation uses a pale background and compact active tab. The Watchlist tab uses a filled bookmark when selected; Search uses a search icon, not a sparkle. Blue status-bar handling uses the route, safe-area backgrounds and `StatusBar` in `App.tsx`. The user asked for Watchlist as the default app screen.

Prior accepted work also introduced bulk Watchlist actions and filter/sort controls; preserve long-press selection, archive, move, pause/resume, delete confirmation, and filter/stock/empty states. Verify them after changing the layout.

### Search and price history

The Search screen (`OpportunityScreen` and `src/components/Discovery.tsx`) shows departments, a search box and products, with an understated explanation of how Watchlist categories relate to the results. It supports source/filter selection and direct tracking. Search remains mounted after its first visit so switching tabs preserves its state; do not regress this cache. The leading products rotate across launches without dropping products. No unchanged-price message is shown: discovered listing cards show a previous observed price only when the price has changed and comparable prices exist.

The user requested price observations for **every discovered product**, not only products in Watchlist-related categories, plus automatic background refresh. This is local/on-device, not a cloud backend. Relevant code includes `src/data/discovery*.ts`, `src/domain/discoveryCatalog.ts`, `src/domain/discoveryBackground.ts` and Android background scheduling. Existing behavior and actual retailer coverage should be verified in source and on device before promising a completeness or freshness guarantee; Android schedules are best effort. UI design changes must not break discovery refresh, history, filtering, selected variants or direct tracking.

### Product metadata

The preceding work reviewed retailer metadata and added tracked-product metadata/category support. `src/domain/productMetadata.ts`, `watchlistDiscovery.ts`, parser code and the product information section in `App.tsx` are starting points. Search and future dynamic filters/recommendations may use categories and product attributes when available. Keep metadata truthful: retailer values may be missing or incomplete, inferred categories are not automatically confirmed choices, and manual user choices should remain distinguishable. Consult `docs/product-metadata-audit.md` and source/tests for exact coverage; do not assume every retailer exposes every field.

### Status, Activity, Add and Settings

`src/components/StatusPill.tsx` previously showed a green downward trend for every `price_changed`, including increases. It now uses a neutral blue check for the check state; the actual change direction remains separately represented. `src/components/StatusPill.test.tsx` covers this case.

Activity no longer repeats stock labels or presents the check source as a green success badge. Its overall layout still has room for a considered design pass. Add Product puts **Find product** immediately after the URL field instead of below the retailer list. Settings puts notifications, battery and scheduling before supported stores and uses flatter bordered surfaces. These are targeted improvements, not fully redesigned flows.

### Typography and theme

`src/theme/theme.ts` defines the current palette, spacing, radii and shadow. The primary blue is `#075FD8`. `DESIGN.md` documents the original baseline and intent, but it is not a complete or fully implemented system; source is authoritative. `AppText` in `src/components/AppText.tsx` uses `FontScaleContext` from `src/theme/FontScaleContext.ts` and computes a scaled font size and line height capped at 1.3. This was introduced after text clipped when Android's font scale changed while the app remained open. One Samsung device was checked at 0.9 → 1.3; the original setting was restored. Do not assume this establishes accessibility across inputs, other scales, Android's non-linear font scaling, other devices or all screens. Review the global implications of manually scaled text before changing it.

## What remains

1. **Agree and implement the system across the app.** Establish semantic type, spacing, surfaces, buttons, inputs and state treatments in code and documentation. Search product cards, product details/price insights, Activity, Add and Settings still have differing visual rhythms, density and control treatments. Treat each as a complete task flow, not just a color swap. Search discovery cards and Watchlist monitoring rows have different jobs and need not be identical.
2. **Prioritize real content and actions.** Revisit Search's repeated strong track buttons and above-the-fold hierarchy; product detail's title/price/insights/chart hierarchy; Activity's event scanability; and Add/Settings copy and progressive disclosure. These need visual exploration and actual device review. Existing improvements should be retained unless the user selects a different design.
3. **Accessibility and edge cases.** Verify TalkBack labels and order, touch targets, contrast, 1.3 and larger system text, font-size changes while editing a `TextInput`, small/narrow displays, long names and prices, unavailable and broken images, loading, empty, error, filtered, archived, selection and out-of-stock states. Test Android back behavior and screen transitions. The 1.3 Watchlist check is evidence for that one flow, not an app-wide accessibility audit.
4. **Validate the design-system docs.** Update `DESIGN.md` when decisions are implemented, document semantic status rules and component states, and keep intended vs shipped behavior clear. `docs/design-system-review.md` and the historical section of `design-qa.md` contain snapshots and some now-fixed findings: read their dated follow-up and compare with current code. Do not treat the earlier floating-button recommendation as current user intent.
5. **Preserve product correctness.** Verify Search's observed-price history and background refresh with realistic data, retailer response/error cases and selected variants when relevant. Do not claim that historical prices update or all source metadata are comprehensive based only on UI.

## Verification and evidence so far

- Before this handover, the Android arm64 release was installed and viewed on a Samsung SM-S928B. Watchlist's populated/out-of-stock and filter sheet, Activity shortcut, Add, Search, Settings and a product detail were inspected. The blue status bar, status-pill correction and one live 0.9 → 1.3 text-scale transition were viewed on that phone. Evidence images were saved under `C:\Users\Main\AppData\Local\Temp\q-*.png`; these are ephemeral machine-local files and may not survive.
- The last full suite before the floating-button revert passed: 42 suites, 377 tests, 1 skipped. For the revert, typecheck, the focused `App.test.tsx` suite (37 tests) and the Android release build passed. ESLint completed with one `react-native/no-inline-styles` warning for the out-of-stock thumbnail overlap. The resulting arm64 release was installed and launched on the Samsung; the floating control and absence of a white dock were visually checked (`%TEMP%/q-handover.png`), and tapping the control opened Add Product. The full suite was not rerun for this small layout-only revert.
- Usual commands from the project root: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`. Android release: from `android`, run `gradlew.bat :app:assembleRelease`; the arm64 artifact is `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`. Install with the correct connected device selected via `adb -s <serial> install -r <apk>`. Never infer installation or a working UI from a successful build alone.

## Git and workspace at handover

- Repository: `D:\Code\GitHub\Qeemat`; branch: `feat/watchlist-ui-refinement`.
- `origin/dev` was fetched during this handover. At that moment it pointed to `7b4ddb1` (merge of PR #80); the UI branch was 13 commits ahead and two merge commits behind it before the floating-button/documentation changes. Those two commits are merge history, so inspect ancestry and diff rather than assuming code is missing. Re-fetch and check before any integration or PR.
- `git ls-remote --heads origin feat/watchlist-ui-refinement dev` returned the `dev` head but no remote head for the UI branch at that moment. The branch has not been pushed by this handover; recheck before acting. PR #80 concerns the preceding metadata/Search baseline, not proof that these later Watchlist commits are merged.
- Commits are intentionally small; use `git log --oneline origin/dev..HEAD` to inspect them. Preserve any later user work. The untracked `output/` directory pre-existed this handover and must not be deleted or committed without understanding its contents.
- The floating-button correction and handover were prepared after the branch counts above; use `git status` and `git log` to determine their final commit state, and preserve all work before starting.

## Implementation constraints

The project uses React Native + TypeScript, a manual route stack in `App.tsx`, AsyncStorage, Lucide icons and `AppText`; follow the project `AGENTS.md`. Avoid introducing React Navigation, SQLite, iOS native work or a server/backend. Do not use `QeematTemplate/`. User-facing experience should not expose internal engineering details unnecessarily. Respect the user's chosen design and work from screenshots, not assumptions.

## Postscript (later 13 November 2026)

- `output/pdf/qeemat-whats-new-since-v0.5.5-alpha.pdf` is now tracked (commit `5bc1294`). The `output/` directory is no longer untracked, and its PDF must not be deleted. The earlier note that `output/` pre-existed as an untracked directory describes the handover state only.
- After the floating-button revert (`12aaa66`), the full Jest suite was rerun and passed: 42 suites, 377 passed, 1 skipped. The current run after the accessibility label/touch-target fixes adds two regression tests: 42 suites, 378 passed, 1 skipped (379 total). Typecheck is clean, and ESLint reports only the one known `react-native/no-inline-styles` warning noted above. This supersedes the earlier note that the full suite was not rerun for the revert.
- The rest of this handover remains the historical record; check current `git log` and `git status` before continuing.

## Postscript (14 November 2026)

- PR #84 merged the Watchlist/design-system work into `dev` at `6ef108e`: semantic type/layout tokens, status primitives, product-detail/Add/Settings hierarchy passes, Watchlist banner search, multi-store filters, duplicate warnings and persisted price-change badges.
- PR #85 merged the in-app update flow into `dev` at `32a6163`: device-ABI-aware APK download, SHA-256 verification, standard Android install prompt, update popup, bell and Activity badges, and the pinned Activity item. Its review findings were fixed in `c80d223` and `989f49e`.
- Issues #81, #82 and #83 were closed as completed with evidence links. The merged feature branches were deleted.
- Still open: a fuller Search hierarchy, a shared chip primitive, the manual accessibility matrix (TalkBack, larger text with inputs, other devices), and a release cut for the merged work. #37 (iOS) remains deliberately deferred.
- The shared input primitive shipped on 14 November: `AppTextInput` implements the 52-high field role with focus/error states, the 1.3 text cap and a `bare` variant, and every screen now uses it. See [`design-qa.md`](../design-qa.md#shared-input-primitive-device-verification-14-november).
- The shared surface primitive shipped on 14 November: `Surface` provides the card/muted/accent/plain flat-surface role from shared tokens; Search cards, empty states and detail insight cards use it. See [`design-qa.md`](../design-qa.md#shared-surface-primitive-device-verification-14-november).
- The product detail compact pass shipped on 14 November: Watchlist-style blue banner and summary card, divided price-insight rows, collapsed About this item and three snapshot groups with Show all. See [`design-qa.md`](../design-qa.md#product-detail-compact-pass-device-verification-14-november).`n- The Activity layout pass shipped on 14 November: stable calendar-day sections with per-day counts and flat event rows (explicit delta badges, source/time metadata, deleted-product handling). See [`design-qa.md`](../design-qa.md#activity-layout-pass-device-verification-14-november).
- Current gates: typecheck clean, ESLint 0 errors (one known `react-native/no-inline-styles` warning), Jest 49 suites / 446 passed / 1 skipped.
