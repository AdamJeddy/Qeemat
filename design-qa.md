# Qeemat design review

## Status and type tokens: device verification 13 November

The semantic type/layout tokens and shared status primitives were installed on the Samsung SM-S928B release and checked:

- Watchlist price rises now render amber instead of red; drops stay green, so green is reserved for price movement. [Watchlist evidence](docs/assets/design-2026-11-13/watchlist-status-colors.png)
- Product detail shows a neutral blue "Checked" status pill, and the snapshot list renders provenance ("Background", "Recheck all") as muted text instead of colored badges. [Detail evidence](docs/assets/design-2026-11-13/detail-neutral-check.png), [snapshot list](docs/assets/design-2026-11-13/detail-snapshot-provenance.png)
- Activity renders "Back in stock" in neutral blue, price rises in amber and drops in green, with muted provenance. [Activity evidence](docs/assets/design-2026-11-13/activity-status-colors.png)
- Search discovery cards use a compact outline Track action instead of a solid primary button on every card, so card content leads. [Search evidence](docs/assets/design-2026-11-13/search-after-pass.png)
- Device accessibility labels were present for the header and icon controls ("Go back", "Copy product link", "Tracking settings").
- **Screen-pass follow-up (installed after the token pass):** product detail shows the full title, an image plus price/status block, flat equal-weight insight cards and direction-colored snapshot prices [detail](docs/assets/design-2026-11-13/detail-hierarchy.png), [snapshots](docs/assets/design-2026-11-13/detail-snapshot-directions.png); Add collapses the supported-store list behind a disclosure [Add](docs/assets/design-2026-11-13/add-supported-stores-disclosure.png); Settings collapses run diagnostics and supported stores [Settings](docs/assets/design-2026-11-13/settings-progressive-disclosure.png); tracking settings adds a per-product **Active** switch [toggle](docs/assets/design-2026-11-13/tracking-active-toggle.png); the tab stack stays mounted so Watchlist keeps its scroll position after a product round trip [state](docs/assets/design-2026-11-13/watchlist-state-preserved.png); the archived-with-no-items state is covered [archived](docs/assets/design-2026-11-13/archived-empty-state.png). Discovery listing images fall back to a neutral placeholder when missing or broken, with three focused component tests. Search listing cards now show the same green/amber direction badge as Watchlist when a previously observed price changed [badges](docs/assets/design-2026-11-13/search-price-change-badges.png).

Remaining for later passes: the price-history chart keeps its own change indicator; a fuller Search hierarchy is still open, while the product-detail, Add, Settings and Activity passes are recorded below. The accessibility matrix still needs TalkBack order/heading announcement, landscape, larger scales with inputs, other devices and a loading/error/selection sweep; contrast, narrow widths and Android 16/17 edge-to-edge were checked.

## Shared input primitive: device verification 14 November

`src/components/AppTextInput.tsx` now implements the agreed input role and replaces the raw `TextInput`s across the app:

- 52-high bordered field, radius 8, 1px soft `colors.border` border matching the Watchlist chips and cards (primary border while focused, red on error), body-role text with the same manual 1.3 cap as `AppText`, an announced message for validation errors, optional label/hint and leading/trailing accessories. The `bare` variant keeps an input inside a custom search row while still sharing typography, placeholder colour and scaling.
- Migrated screens: Add Product (URL, folder name, target price, minimum drop), tracking settings (target price, minimum drop), Watchlist banner search, discovery search, discovery filters maximum price, the browse sheet search and the discovery brand/budget fields. No screen renders a raw `TextInput` any more.
- Checked on the Samsung SM-S928B in the release build: [Add Product URL field](docs/assets/design-2026-11-14/add-product-url-field.png), [Watchlist banner search](docs/assets/design-2026-11-14/watchlist-search-field.png), [discovery maximum price](docs/assets/design-2026-11-14/discovery-max-price-field.png) and [browse sheet search](docs/assets/design-2026-11-14/browse-sheet-search-field.png). The 52-high fields fit the existing scroll content without overlap; the blue-banner search keeps its compact white container.
- Design-language pass: the field surface uses the same flat white surface, soft `colors.border` and blue primary accent as the Watchlist search, filter chips and cards, rather than a heavier input-only border.
- `src/components/AppTextInput.test.tsx` covers label/hint accessibility, the 1.3 cap, focus and error borders and messages, accessories and bare mode.
- Review follow-up: the native input now stretches to the full field height (the field uses `alignItems: 'stretch'` and the input `textAlignVertical: 'center'`), so the whole visible field is the touch target rather than just the text strip. Device-checked by tapping the top edge of the Product URL field: it focused and showed the primary border. [screenshot](docs/assets/design-2026-11-14/input-focus-full-target.png)

Remaining after this pass: Search card/chip containers and the compact discovery budget rows still use local surface treatments; a shared surface primitive is still intended.

## Shared surface primitive: device verification 14 November

`src/components/Surface.tsx` now provides the shared flat-surface role:

- Variants: `card` (white, 1px `colors.border`, radius md), `muted` (surfaceMuted inset), `accent` (blueSoft) and `plain`; token-based padding (`none`/`sm`/`md`/`lg`) and radius (`sm`/`md`/`lg`). Layout styles such as flex direction, width and margins still come from the caller.
- Adopted by Search (discovery setup card, empty discovery card and discovery product cards), Watchlist and Activity empty states, and product-detail insight cards. Their rendered layout is unchanged because the component reproduces the previous visual treatment from shared tokens.
- Checked on the Samsung SM-S928B release build: [Search discovery cards](docs/assets/design-2026-11-14/search-cards-surface.png) and [product-detail insight cards](docs/assets/design-2026-11-14/detail-insight-surface.png) render the same flat bordered surfaces as before.
- `src/components/Surface.test.tsx` covers the default card role, muted/accent/plain variants, padding/radius token mapping and forwarded view props/layout overrides.

Remaining after this pass: Search filter chips and the still-local card styles (Settings/Activity rows, Add preview, update pin) already match the role; consolidating them onto `Surface` and defining a shared chip primitive are the next surface steps.

## Activity layout pass: device verification 14 November

The Activity tab was rebuilt as a calendar-day history rather than a list of relative-time groups:

- Events are grouped by stable **local calendar day** (`Today`, `Yesterday`, then e.g. `Mon, 10 Nov`) with a per-day change count; the grouping helper is unit-tested against fixed dates. [grouping tests](src/domain/__tests__/activity.test.ts)
- Each day is one flat `Surface` with compact rows (thumbnail, title, old → new price, explicit delta badge such as `+AED 39` or `−AED 250`, then retailer · source · time). This replaces one bordered card per event and matches the Watchlist card language. [before](docs/assets/activity-redesign/current-activity.png), [after](docs/assets/activity-redesign/activity-after.png)
- Stock transitions keep their state text (Out of stock / Back in stock) with the last or new price; first observations read “Started tracking” with a `New` badge. Source is still muted provenance text.
- Deleted products render a non-tappable “Product removed” row; existing products open their detail page with a descriptive accessibility label. Day headers are headings with counts.
- Device checks on the Samsung SM-S928B: populated list, 1.3 font scale (rows reflow, meta wraps instead of truncating) and landscape (rows use the full width, badges stay right-aligned). [1.3](docs/assets/activity-redesign/activity-font-scale-1-3.png), [landscape](docs/assets/activity-redesign/activity-landscape.png)
- Full plan and design rationale: [activity redesign](docs/activity-redesign-plan.md).

## Accessibility and device matrix: 13 November

Checked on the Samsung SM-S928B, Android 17 / SDK 37, 1440 × 3120 at override density 560 with font scale 0.9 restored:

- **Edge-to-edge:** the blue Watchlist status bar renders with white system icons on the enforced edge-to-edge build (target SDK 36), and other tabs keep the light bar. No Android 16/17 status-bar regression was observed.
- **Font scale:** 1.3 and 1.5 produce identical layouts, confirming the 1.3 cap; at 1.3 the Watchlist toolbar wraps "Recheck all" to its own row without clipping. [1.3](docs/assets/design-2026-11-13/font-scale-1-3-watchlist.png), [1.5](docs/assets/design-2026-11-13/font-scale-1-5-cap.png). Changing the system scale restarted the activity on this device; the app reopened at Watchlist with the larger layout instead of remeasuring the current screen in place — a platform behaviour to re-check on other devices.
- **Narrow width:** at 343dp effective width the Watchlist uses the compact single-column card layout, the toolbar wraps, the out-of-stock section expands, and product detail stacks cleanly. [Watchlist](docs/assets/design-2026-11-13/narrow-343dp-watchlist.png), [detail](docs/assets/design-2026-11-13/narrow-343dp-detail.png).
- **Keyboard:** with the Add URL field focused, the intro, field and Find product stay visible above the keyboard. [screenshot](docs/assets/design-2026-11-13/add-keyboard-open.png)
- **Contrast (WCAG AA):** body 17.1:1; muted text 4.55:1 on page and 4.76:1 on white; primary on white 5.77:1 and on blue-soft 4.73:1; green on green-soft 4.59:1 after lightening the tint; amber on amber-soft 4.51:1; red on red-soft 4.52:1; placeholders now use muted text; the banner count pill uses primary-dark (8.5:1). Green-soft also backs the drop badge, so the direction text stays AA.
- **Accessibility tree:** UI Automator showed labels for "Go back", "Find product" and the supported-store disclosure. Android heading flags are not exposed in the dump, so TalkBack heading navigation still needs a manual pass.
- **Empty and error checks:** the filtered-to-nothing state now has its own explanation and recovery action [screenshot](docs/assets/design-2026-11-13/filtered-empty-state.png); the price-history chart's legend now matches the shared direction colors [screenshot](docs/assets/design-2026-11-13/chart-direction-legend.png).

Remaining: TalkBack order and heading announcement, landscape, dark mode, scales above 1.3 with a text input focused, other Android versions/devices, and a manual pass over every loading/error/selection state.

## Check reliability: Amazon and Decathlon (13 November)

Watchlist checks were failing for Decathlon and Amazon products. Investigated on the installed release build and by running the parser against the fetched storefront HTML:

- **Decathlon was a false 404 rejection.** The generic 404 heuristic looked for an image containing "404" and the phrase "product ... not found". The current Decathlon Shopify theme includes an image srcset width of 404 and the theme script text "Product section not found for variant price updates", so every product page was discarded before parsing. Fixed by skipping the 404 heuristics when the page embeds Shopify's `ProductJson`, and narrowing the phrase match to "product not found". The Germany jersey now checks successfully (AED 250, checked just now). [evidence](docs/assets/design-2026-11-13/decathlon-check-recovered.png)
- **Amazon failures were intermittent network resets and partial pages** ("Could not reach the product page", "Qeemat could not find product details on this page"). Amazon now retries the exact URL once, then uses the Android WebView fallback for network and parser failures, the same recovery path used by other browser-only storefronts. The watchlist recheck completed with the Amazon items checked successfully this run; challenge pages can still return `blocked` and are reported honestly.
- Regression tests cover the Decathlon 404 false positive, genuine 404 detection, Amazon partial-page and network-error fallbacks, and the Decathlon missing-ProductJson fallback.

## Watchlist search, filters and duplicate adds (13 November)

- **One search on Watchlist** — the blue-banner search control now opens the watchlist search itself; there is no second search control in the toolbar. The inline field filters tracked products by product name, retailer, folder and selected option (multi-word queries must all match), combines with the filters below and supports an empty state with **Clear search**. Discovery Search stays available through the bottom Search tab. [evidence](docs/assets/design-2026-11-13/watchlist-banner-search.png)
- **Archived control** — the archived view is toggled from an icon-only toolbar button with a selected state instead of a text button. [evidence](docs/assets/design-2026-11-13/archived-icon-control.png)
- **Multi-store filter** — the Filter & sort sheet now allows selecting any number of stores (or All stores), and the active summary lists them. Folders and sorting stay single-choice. [evidence](docs/assets/design-2026-11-13/multi-store-filter.png)
- **Recheck placement** — `Recheck all` is pinned to the far right edge of the Watchlist toolbar (after a flexible spacer) and uses a bordered button treatment so it reads as an action instead of a text link; the checking and disabled states are unchanged. [evidence](docs/assets/design-2026-11-13/toolbar-recheck-right.png)
- **Duplicate warning timing and variants** — the watchlist check now runs as soon as a product is parsed:
  - an exact duplicate (same variant id, or two page-level trackers for the same normalized URL) shows an inline amber **Duplicate product** warning that explains adding it again would create a duplicate, offers a filled **Open product** button, and disables **Confirm Tracking**; a save-time check remains as a fallback; [evidence](docs/assets/design-2026-11-13/duplicate-warning-refined.png)
  - a different option of the same product shows a blue **Adding another option** notice listing the tracked options, and is saved as its own tracker. Every variant is a separate item with its own history, which matches the existing model; no extra confirmation dialog is shown because the notice appears before the user reaches the button.
- **Price-change consistency** — previously a single unchanged check replaced the price direction with "checked", so a recent rise/drop disappeared from cards. Tracked products now persist the last actual change (price before the change and when it happened); later unchanged or out-of-stock checks preserve it, and a one-time migration backfills existing trackers from their snapshot history. Cards and the largest-drop sort use that persisted change, and the badge accessibility label includes the changed time. Verified with a full flat `Recheck all`: the badges remained after the run while prices that did change updated. [evidence](docs/assets/design-2026-11-13/price-change-after-recheck.png)
- Domain and widget tests cover page-level duplicates, same-variant duplicates, different options of one product, different products, URL normalization, multi-store filtering, the persisted change fields, the snapshot backfill derivation and card rendering after flat checks.

## User correction: floating add button

The user explicitly rejected the white dock added during the follow-up below. The add button has been restored as a floating overlay; covering content is an accepted tradeoff (commit `12aaa66`; device evidence `%TEMP%/q-handover.png`). Bottom scroll padding is kept so the last product can be scrolled clear. Do not reintroduce the dock to address the historical overlap finding. See `docs/design-handover.md` for the current direction and verification.

## Follow-up: 13 November

The updated Android release was installed and checked on the Samsung SM-S928B. Watchlist now extends its blue header behind the status bar, with white system icons (`%TEMP%/q-system.png`); other screens retain a light status bar. The add button occupies a dedicated area rather than covering prices. *(Superseded by the user correction above: the dock was rejected and the floating button restored in `12aaa66`.)* The Watchlist was also checked while changing the system font scale from 0.9 to 1.3 with the app open (`%TEMP%/q-scale-final.png`): header, controls and navigation reflowed without the earlier clipping. The original font scale was restored.

Add Product now shows Find product immediately after the URL field (`%TEMP%/q-add-new.png`). Settings places notifications and scheduling before supported stores and uses flatter surfaces (`%TEMP%/q-set-final.png`). Activity no longer duplicates availability badges or presents the check source as a green status. These are targeted improvements, not a complete redesign of Search, product details or every app state. Narrow screens, keyboard/input behavior during font-scale changes, and the empty, error and selection states still need a dedicated device pass.

The findings below preserve the initial review and its evidence; the live Watchlist font-size, Add/Settings priority and Activity-label findings were addressed in this follow-up, while the floating-button finding was later superseded by the user correction above.

## Scope and evidence

- Selected Watchlist reference: `C:\Users\Main\.codex\generated_images\01a1b16e-d8bd-7e13-bc0e-a05297fb8d9b\exec-e47a4ab7-a4f9-4ec9-b37a-c12961eef8d1.png` (852 × 1846).
- Before and after device comparisons: `C:\Users\Main\AppData\Local\Temp\q-compare-before.png` and `C:\Users\Main\AppData\Local\Temp\q-compare-after.png`. Each puts the reference and the 1440 × 3120 Samsung capture side by side at 426 × 923 per image. Native status and navigation bars are present only on the phone; both views show the same populated Watchlist, with live content and timestamps that may change.
- Focused state evidence: `C:\Users\Main\AppData\Local\Temp\qeemat-expanded.png` and `C:\Users\Main\AppData\Local\Temp\qeemat-filter.png`. Other screens examined: `qeemat-search-review.png`, `qeemat-activity-review.png`, `qeemat-settings-review.png`, `qeemat-detail-review.png`, and `qeemat-add-review.png` in the same temp directory.

## Findings

- **Resolved P1 — Product detail status was misleading.** A recent price increase appeared beside a green downward arrow. The status now uses a neutral check for a price change; the actual price direction remains in price history. Verified on the installed build in `C:\Users\Main\AppData\Local\Temp\qeemat-detail-final.png`. Fixed in commit `16019c1`; `src/components/StatusPill.test.tsx` covers the neutral check.
- **P2 — Floating add button can obscure a price-change badge.** In the after comparison it covers part of the fourth row's badge. Scrolling makes it accessible, but the screen should avoid overlapping important data; a placement decision is still needed. **Superseded (13 November 2026):** the user rejected the dock that addressed this, and the floating button was restored in `12aaa66`; the overlap is now the accepted tradeoff and should not be re-fixed (see the user correction above).
- **P2 — The visual system stops at Watchlist.** Search uses a separate light page hierarchy and large grid cards; Activity uses outlined cards with repeated source/status pills; Settings uses large shadowed containers. The shared navigation helps, but spacing, surfaces and hierarchy are not yet a coherent app-wide system. **Status (13 November 2026): partial.** Settings now uses flatter bordered surfaces and Activity's check source is muted text rather than a badge; Search and product detail still use their previous visual systems.
- **P2 — Primary actions are buried on Add and Settings.** Add places a long list of stores between the URL field and Find product; Settings starts with a full screen of supported stores before notification controls. These screens need task-first layouts, not just matching colors. **Fixed (13 November 2026):** Add now puts **Find product** directly after the URL field (`04e8bfb`), and Settings places notifications and scheduling before supported stores (`b1069b6`). A broader task-first layout pass on both screens is still open.
- **P2 — Activity shows implementation detail as a prominent green badge.** “Background” reads like a positive event, even when the price rose, and “Back in stock” is repeated. Reduce the prominence of check provenance and show the change once. **Fixed in Activity (13 November 2026):** the check source is now muted text instead of a green badge and availability labels are no longer repeated (`5608b6e`). **Fixed on product detail (14 November 2026):** the snapshot list now renders provenance through `SourceLabel` as muted text instead of the green badge (`6794cec`).
- **P1 — Text can be clipped after changing system font size while Qeemat is open.** At 1.3×, the captured live configuration change truncated labels across the header, toolbar and navigation (`qeemat-large.png` in the temp directory). Restarting at the same size restored full labels and reflowed the controls (`qeemat-large2.png`); the original 0.9 setting was restored. The live resize needs investigation. **Fixed (13 November 2026):** `bb1883f` remeasures text when the system font scale changes, and the follow-up recheck of the live 0.9 → 1.3 transition reflowed without clipping (`%TEMP%/q-scale-final.png`). Larger scales, `TextInput`s and TalkBack remain unverified.
- **P2 — Narrow phones, empty/error states and selection mode remain unverified on device.** The populated and expanded states alone do not establish complete responsive or accessibility coverage.

## Comparison history

The first render omitted the brand mark, Activity shortcut, bookmark in the count, compact active navigation, and had oversized gaps between product rows. The revised render adds these elements, connects the shortcuts to real screens, and reduces list spacing. The native app mark intentionally differs from the concept's simplified tag, and there is no unread dot because there is no notification inbox or unread state. The post-fix comparison still shows the floating-button overlap described above. *(Superseded by the user correction above: the overlap is now the accepted tradeoff of the chosen floating button, not an open defect.)*

## Fidelity surfaces

- **Typography:** both use bold product names and prominent prices; the app uses Android system type and real dynamic text, rather than an identified reference font. Long text and enlarged system text need further verification.
- **Spacing:** list density is much closer; the native system bars and real content leave different visible space. The floating-button overlap remains; it is the accepted tradeoff of the chosen floating button (see the user correction above).
- **Color:** the flat Qeemat blue, pale blue surfaces and directional price colors are present. Other screens have not been harmonized.
- **Imagery:** real retailer images and Qeemat's existing app mark are used; imagery and cropping differ naturally from the generated reference. Image failure and missing-image states need device verification.
- **Copy:** actual item counts, prices and check times are used. The reference's notification dot is intentionally omitted. “Background” still appears as check provenance in diagnostics and the product-detail snapshot list; the earlier “MVP” copy is no longer present.

## Interaction checks

On the phone, Activity opened from the header bell, out-of-stock products expanded, and the filter sheet opened with sort, store and folder controls. Search, Settings, product details and Add were opened for visual review. A 1.3× system-font check exposed the live-resize issue above. Automated tests cover the header shortcuts and neutral price-change status. Destructive actions were not exercised; empty, loading, failure and selection states have not all been visually checked.

## Checklist

1. Resolve the floating button overlapping product information and retest populated and out-of-stock lists. *(Superseded by the user correction above: the floating button is the chosen pattern and its overlap is accepted, so there is no dock to build. The post-restore device check is recorded in [the handover](docs/design-handover.md).)*
2. Fix live font-scale changes and check long names, missing images, empty/error and larger-text states. *(Live font-scale remeasure fixed in `bb1883f`; the remaining state checks are still open.)*
3. Apply the agreed visual language to Search, Activity, Add, details and Settings with task-first layouts; review each as a complete flow. *(Partial: product-detail, Add, Settings and Activity passes shipped; a fuller Search hierarchy is still open.)*
4. Recheck accessibility, shared components and device behavior across the app before treating the design system rollout as complete. *(Open; see the verification limits in the [design-system review](docs/design-system-review.md).)*

final result: blocked

**Status (14 November 2026):** the `blocked` verdict above is historical and is not the current status. The initial blocking findings were addressed or explicitly superseded: the misleading detail status (`16019c1`) and live font-scale clipping (`bb1883f`) are fixed, Add and Settings now put the primary task first (`04e8bfb`, `b1069b6`), Activity's green source badge is fixed (`5608b6e`), and product detail now renders provenance as muted text (`6794cec`). The floating-button finding is superseded by the user correction at the top. The app-wide visual-system rollout, a fuller Search hierarchy and the remaining accessibility and edge-state checks are open and are tracked in [the handover's “What remains” section](docs/design-handover.md#what-remains).

## Earlier For You review

# For You visual QA

Final result: passed with the follow-up noted below.

Selected reference: the [third generated concept](docs/assets/for-you-2026-10-28/selected-concept.png), 853 × 1844. Implementation: the standalone Android release installed on a Samsung SM-S928B, 1440 × 3120, with Footwear selected ([screenshot](docs/assets/for-you-2026-10-28/footwear.png)). Both were opened together for comparison. Their aspect ratios are close; the phone capture includes Android status and navigation areas absent from the concept. The reference uses illustrative products and a sample budget; the app uses the user's real catalogue and only displays a budget when one is saved.

The initial device capture showed too much vertical space before products. The final build removes the idle search status row, tightens the screen spacing, and combines refresh and filters with the result count. The selected tile, category heading, real products and prices are now visible on the opening screen. On this phone a short scroll is still needed to expose Track price; this is a P3 density follow-up rather than a blocked action.

- Typography and copy: native app typography and blue/white tokens remain consistent with the reference. The search hint describes the number of supported stores. The user-selected category names the feed.
- Layout and spacing: the header, search, six visual tiles, department heading, two-column product grid and bottom navigation retain the reference's hierarchy. Existing search coverage, filter and refresh actions remain available.
- Colors and selection: the selected tile uses the existing blue border and light blue surface; buttons and links use the existing primary color.
- Imagery: six generated, unbranded transparent illustrations provide stable department imagery, while product cards use actual retailer images. An interest selected through the full browser can use a cached product image or a neutral icon when no image is available.
- Content and behavior: Fresh food replaces the concept's broader Groceries tile to preserve the separate fresh food, pantry, beverages and frozen food interests. Choosing an interest updates products in place and honors its saved budget. The full department/retailer browser, search, refresh, and existing watchlist remain available.

The device check covered selecting Footwear, opening the full department browser, searching, clearing search back to the selected category, scrolling to Track price, and seeing 24 existing tracked items. No product was added or removed. No AndroidRuntime or ReactNativeJS errors appeared in sampled logs. These checks do not establish full accessibility or coverage across devices and retailers.

final result: blocked
