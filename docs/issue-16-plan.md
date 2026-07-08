# Plan: Add mini icons for each website (#16)

## Summary

Download and bundle real favicon PNGs for each of the 7 supported stores, then display them alongside or replacing the text-only site indicators everywhere site identity appears in the UI: product cards, add flow, settings, and product preview.

## Key Implementation Changes

### 1. Favicon Assets

- Download favicons from each store's actual website into `assets/site-icons/`:
  - **Noon** — `noon.com/favicon.ico` (convert `.ico` → `.png`)
  - **Nike UAE** — extract PNG from discovered favicon path
  - **Sun & Sand Sports** — `sssports.com` (16×16 PNG found)
  - **Level Shoes** — `levelshoes.com/favicon.ico` (convert)
  - **AYM Accessories** — `/favicon.ico` 404s; use the discovered `apple-touch-icon` PNG and resize
  - **Ounass UAE** — `ounass.ae/static/images/favicons/favicon-32.png`
  - **Amazon** — `amazon.ae/favicon.ico` (convert)
- `.ico` files must be converted to PNG for React Native `Image` compatibility (`react-native-svg` is already available as a fallback approach if needed).
- Always create 24×24 PNG output; store as `assets/site-icons/{siteKey}.png`.
- If any download/conversion fails for a site, generate a simple colored letter-circle fallback at build time (first letter of `shortName` on a brand-appropriate background color).

### 2. Type & Site Registry

- **`types.ts`** — add optional `iconAsset` field to `SupportedSite`:
  ```ts
  iconAsset?: string; // e.g. require('../assets/site-icons/noon.png')
  ```
- **`sites.ts`** — add `iconAsset` with a `require()` or equivalent for each supported site entry.

### 3. Reusable `<SiteIcon>` Component

- New `src/components/SiteIcon.tsx`:
  - Accepts `siteKey: SiteKey` and optional `size` prop (default 20).
  - Falls back to a colored letter-circle if `iconAsset` is undefined (graceful degradation).
  - Exported for use across all UI surfaces.

### 4. UI Surfaces — Site Icons

**ProductCard** (`src/components/ProductCard.tsx`, line 33):
- Replace text-only badge with `<SiteIcon>` + `shortName` inline.

**Add flow — detected site** (`App.tsx` ~line 503):
- Add `<SiteIcon>` before `displayName` in the detection status row.

**Add flow — supported site chips** (`App.tsx` ~line 508–516):
- Add `<SiteIcon>` before `shortName` inside each chip.

**ProductPreview** (`App.tsx` ~line 573):
- Add `<SiteIcon>` before `storeName` in the store pill.

**Settings — Supported Stores** (`App.tsx` ~line 1064–1073):
- Replace the generic `<Store>` lucide icon with `<SiteIcon>` for each site.

**Activity feed** (noted, deferred):
- Activity events don't currently carry `siteKey` or show any site identity. Adding site info to the activity feed would require a data model change + migration on `ActivityEvent`. This is out of scope for this issue but worth a follow-up.

## Test Plan

- `npm run typecheck` — passes with new `iconAsset` field.
- `npm run lint` — no new issues.
- Manual verification: each site's icon renders correctly at all 5 UI surfaces listed above.
- Manual verification: if an icon asset is missing, the letter-circle fallback renders instead.

## Assumptions

- `.ico` → `.png` conversion will use a one-time script (Node buffer/image-processing or a small CLI tool like ImageMagick if available), not a runtime dependency.
- Downloaded favicons are small, static, and bundled as local assets — no network fetch at runtime.
- Fallback letter-icons use existing `colors` from the theme (each site gets a distinct tint from a predefined palette).
- The ActivityEvent data model change is intentionally excluded to keep scope minimal; can be a follow-up issue.
