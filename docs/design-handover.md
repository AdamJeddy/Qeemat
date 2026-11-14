# Qeemat UI and design-system handover

**Handover date:** 13 November 2026; updated with status through the v0.6.5-alpha release. This is a historical handover, not a claim that every item below is still open. For current shipped behavior, read [current-state.md](current-state.md); for current design evidence, read [design-qa.md](../design-qa.md).

## User's objective and working style

Qeemat is an Android-first, local-first UAE shopping price tracker. The user wants the app to feel modern, simple, and useful for monitoring prices. They asked for a genuine design system and a coherent product experience, not isolated cosmetic changes or an agent announcing that a partially implemented concept is complete.

The user wants the next agent to lead the design conversation, ground decisions in what the app actually does, review complete screens and states, and check the real rendered app. They value precise, concise explanations, practical device verification, preserving existing behavior, and small conventional commits. They explicitly requested normal branch names such as `feat/...` or `fix/...`, not `work/...` or `codex/...`. Do not make a new branch or push/open a PR unless the current user instruction calls for it; verify current state first.

## Accepted design direction

- **Feel:** clean and practical, compact and calm, but not bland. The user was open to another palette or gradients, then chose a direction close to Qeemat's existing blue, with flatter button colors. Subtle borders and restrained surfaces are preferred; use color to clarify hierarchy, selection and price status.
- **Reference:** the first of the final Watchlist banner variants was selected, after the user liked the elements and icons of an earlier second concept but wanted less visually loud colors. The original reference was a machine-local generated image and is not available in this repository; use the shipped Watchlist/Explore screens and `DESIGN.md` as the current visual reference. Inspect the app or ask the user if a historical reference is needed.
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

At handover time the Search screen (`OpportunityScreen` and `src/components/Discovery.tsx`) showed departments, a search box and products, with an understated explanation of how Watchlist categories related to the results. It supported source/filter selection and direct tracking, stayed mounted after its first visit so switching tabs preserved its state, and rotated leading products across launches. It has since been rebuilt and renamed **Explore**; see [current-state.md](current-state.md) and [search-tab-review.md](search-tab-review.md) for the shipped behavior, grouping, compare sheet and automatic continuation. No unchanged-price message is shown: discovered listing cards show a previous observed price only when the price has changed and comparable prices exist.

The user requested price observations for **every discovered product**, not only products in Watchlist-related categories, plus automatic background refresh. This is local/on-device, not a cloud backend. Relevant code includes `src/data/discovery*.ts`, `src/domain/discoveryCatalog.ts`, `src/domain/discoveryBackground.ts` and Android background scheduling. Existing behavior and actual retailer coverage should be verified in source and on device before promising a completeness or freshness guarantee; Android schedules are best effort. UI design changes must not break discovery refresh, history, filtering, selected variants or direct tracking.

### Product metadata

The preceding work reviewed retailer metadata and added tracked-product metadata/category support. `src/domain/productMetadata.ts`, `watchlistDiscovery.ts`, parser code and the product information section in `App.tsx` are starting points. Search and future dynamic filters/recommendations may use categories and product attributes when available. Keep metadata truthful: retailer values may be missing or incomplete, inferred categories are not automatically confirmed choices, and manual user choices should remain distinguishable. Consult `docs/product-metadata-audit.md` and source/tests for exact coverage; do not assume every retailer exposes every field.

### Status, Activity, Add and Settings

`src/components/StatusPill.tsx` previously showed a green downward trend for every `price_changed`, including increases. It now uses a neutral blue check for the check state; the actual change direction remains separately represented. `src/components/StatusPill.test.tsx` covers this case.

Activity no longer repeats stock labels or presents the check source as a green success badge. The planned Activity layout pass has since shipped with calendar-day groups and compact rows (see [design-qa.md](../design-qa.md)). Add Product puts **Find product** immediately after the URL field instead of below the retailer list. Settings puts notifications, battery and scheduling before supported stores and uses flatter bordered surfaces.

### Typography and theme

`src/theme/theme.ts` defines the current palette, spacing, radii and shadow. The primary blue is `#075FD8`. `DESIGN.md` documents the original baseline and intent, but it is not a complete or fully implemented system; source is authoritative. `AppText` in `src/components/AppText.tsx` uses `FontScaleContext` from `src/theme/FontScaleContext.ts` and computes a scaled font size and line height capped at 1.3. This was introduced after text clipped when Android's font scale changed while the app remained open. One Samsung device was checked at 0.9 → 1.3; the original setting was restored. Do not assume this establishes accessibility across inputs, other scales, Android's non-linear font scaling, other devices or all screens. Review the global implications of manually scaled text before changing it.

## What remained at handover — status in v0.6.5-alpha

1. **Agree and implement the system across the app.** **Shipped:** semantic type/spacing/layout tokens, `Surface`, `AppTextInput`, status primitives, Watchlist, product detail, Add, Settings, Activity and the Explore hierarchy. A shared chip/action primitive is still a possible follow-up.
2. **Prioritize real content and actions.** **Shipped:** the Search hierarchy was rebuilt as Explore with compact rows, a compare sheet and automatic continuation; Watchlist and product detail were reworked. Ongoing product judgement still applies.
3. **Accessibility and edge cases.** **Partial:** contrast, touch targets, 1.3/1.5 font scale, compact width and landscape Watchlist were checked; TalkBack speech order, dark mode, other devices and transient-state sweeps remain open.
4. **Validate the design-system docs.** **Shipped:** `DESIGN.md`, `design-qa.md`, `docs/design-system-review.md` and this handover were reconciled for v0.6.5-alpha. Continue updating them with future passes.
5. **Preserve product correctness.** **Ongoing:** prices remain observations, grouping is conservative, and retailer coverage/error cases require continuing verification.

## Verification and evidence so far

- Before this handover, the Android arm64 release was installed and viewed on a Samsung SM-S928B. Watchlist's populated/out-of-stock and filter sheet, Activity shortcut, Add, Search, Settings and a product detail were inspected. The blue status bar, status-pill correction and one live 0.9 → 1.3 text-scale transition were viewed on that phone. Later evidence is in [`design-qa.md`](../design-qa.md) and `docs/assets/`; the original local `%TEMP%` captures are not repository assets and are not relied on.
- The v0.6.5-alpha release gate was typecheck clean, ESLint 0 errors (one known inline-style warning), and Jest 61 suites / 579 passed / 1 skipped. The arm64 release APK was built, and its metadata/signature verified. Earlier device passes were captured on the Samsung SM-S928B; this exact release APK was not installed during release prep.
- Usual commands from the project root: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`. Android release: from `android`, run `gradlew.bat :app:assembleRelease`; the arm64 artifact is `android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`. Install with the correct connected device selected via `adb -s <serial> install -r <apk>`. Never infer installation or a working UI from a successful build alone.

## Git and workspace at handover

- Repository: `D:\Code\GitHub\Qeemat`. This section describes the 13 November working branch; do not use the branch/ancestry notes as the current git state. Since then the work was merged into `dev` and shipped in v0.6.5-alpha.
- Since this handover the release line has moved on: Explore and its second-pass UX shipped in v0.6.5-alpha, together with the review fixes, in-app update flow and accessibility corrections. The old branch/PR state below is historical; re-fetch and inspect `dev`/`main` before acting.
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
- Still open at that point: a fuller Search hierarchy, a shared chip primitive, the manual accessibility matrix (TalkBack, larger text with inputs, other devices), and a release cut for the merged work. #37 (iOS remains deliberately deferred). The Search hierarchy and release have since shipped; see the v0.6.5-alpha postscript.
- The shared input primitive shipped on 14 November: `AppTextInput` implements the 52-high field role with focus/error states, the 1.3 text cap and a `bare` variant, and every screen now uses it. See [`design-qa.md`](../design-qa.md#shared-input-primitive-device-verification-14-november).
- The shared surface primitive shipped on 14 November: `Surface` provides the card/muted/accent/plain flat-surface role from shared tokens; Search cards, empty states and detail insight cards use it. See [`design-qa.md`](../design-qa.md#shared-surface-primitive-device-verification-14-november).
- The product detail compact pass shipped on 14 November: Watchlist-style blue banner and summary card, divided price-insight rows, collapsed About this item and three snapshot groups with Show all. See [`design-qa.md`](../design-qa.md#product-detail-compact-pass-device-verification-14-november).
- The Activity layout pass shipped on 14 November: stable calendar-day sections with per-day counts and flat event rows (explicit delta badges, source/time metadata, deleted-product handling). See [`design-qa.md`](../design-qa.md#activity-layout-pass-device-verification-14-november).
- Gates at that point: typecheck clean, ESLint 0 errors (one known `react-native/no-inline-styles` warning), Jest 49 suites / 446 passed / 1 skipped.

## Postscript — Search comparison redesign (14 November 2026)

- The Search tab was rebuilt on `feat/search-tab-redesign` and later shipped as Explore in v0.6.5-alpha: a Watchlist-style blue banner, a watchlist-derived relevance feed with honest reasons, conservative cross-retailer clubbing with per-store prices and a best source, tracked-product annotations, a compare sheet, a filter sheet, and grouped search results with accessory-aware ranking. The old discovery quiz UI and grid preview were removed. See [the Search tab review](search-tab-review.md) and the [device evidence](../design-qa.md#explore-experience-iteration--device-verification-14-november-2026).
- Review fixes after the initial PR: unique group ids for deliberately separate matches, model qualifiers (Pro/Pro Max) required to agree, decimal sizes and fragrance concentrations kept distinct, range-priced offers excluded from tracked savings, accessories sorted after products, and department/store-scoped continuation restored.

### Postscript — Explore iteration (14 November 2026, evening)

- The Search tab was renamed **Explore** and its second-pass UX was merged and released in v0.6.5-alpha: an animated per-store search-progress card instead of a first-search zero state, multi-store promotion within textual match grades, automatic infinite continuation with no Show more/Load more buttons, watchlist duplicates hidden unless another retailer is cheaper, price-sorted compare offers, and a 24-hour in-memory cache for visited department/store scopes.
- Evidence is in [design-qa.md](../design-qa.md#explore-experience-iteration--device-verification-14-november-2026) and the behavior is documented in [the Search tab review](search-tab-review.md#9-follow-up-iteration-explore-experience-14-november-2026).

## Postscript — v0.6.5-alpha release (14 November 2026)

- `v0.6.5-alpha` was published on 14 November 2026 with the Explore redesign, search/grouping fixes, compact product detail, Activity redesign, H&M UAE + Zara UAE, in-app update download/install and the new update notification copy.
- Release prep (version bump, release notes and screenshots) is committed on `dev` and promoted to `main`; see [release notes](../release/v0.6.5-alpha/RELEASE_NOTES.md).
- Release gate: typecheck clean, ESLint 0 errors (one known inline-style warning), Jest 61 suites / 579 passed / 1 skipped. The arm64 release APK was built and its metadata/signature verified; screenshots were captured from the same codebase on the Samsung SM-S928B.