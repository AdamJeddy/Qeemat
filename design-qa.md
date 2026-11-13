# Qeemat design review

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
- **P2 — Activity shows implementation detail as a prominent green badge.** “Background” reads like a positive event, even when the price rose, and “Back in stock” is repeated. Reduce the prominence of check provenance and show the change once. **Fixed in Activity (13 November 2026):** the check source is now muted text instead of a green badge and availability labels are no longer repeated (`5608b6e`). The same green `Background` badge remains on product detail's snapshot list (`snapshotSourceBadgeStyle` returns the green `sourceBadgeGreen` style for `background` in `App.tsx`); that is the remaining instance.
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
3. Apply the agreed visual language to Search, Activity, Add, details and Settings with task-first layouts; review each as a complete flow. *(Partial: Add priority and Settings order improved; Search, Activity and product detail still need the full visual pass.)*
4. Recheck accessibility, shared components and device behavior across the app before treating the design system rollout as complete. *(Open; see the verification limits in the [design-system review](docs/design-system-review.md).)*

final result: blocked

**Status (13 November 2026):** the `blocked` verdict above is historical and is not the current status. The initial blocking findings were addressed or explicitly superseded: the misleading detail status (`16019c1`) and live font-scale clipping (`bb1883f`) are fixed, Add and Settings now put the primary task first (`04e8bfb`, `b1069b6`), and Activity's green source badge is fixed (`5608b6e`), with product detail's snapshot list still outstanding. The floating-button finding is superseded by the user correction at the top. The app-wide visual-system rollout and the remaining accessibility and edge-state checks are open and are tracked in [the handover's “What remains” section](docs/design-handover.md#what-remains).

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
