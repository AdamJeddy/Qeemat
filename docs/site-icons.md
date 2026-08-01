# Website Mini Icons

**Status:** Implemented (issue #16)

Qeemat bundles a PNG favicon for every registered store and renders it through the reusable `SiteIcon` component. This document records the delivered implementation; current store configuration lives in `src/domain/sites.ts`.

## Delivered

- Thirteen local PNG assets are bundled in `assets/site-icons/`, including supported stores and the experimental Brands For Less integration.
- `SupportedSite.iconAsset` registers each favicon in the site registry.
- `src/components/SiteIcon.tsx` renders the asset at the requested size and falls back to a coloured letter-circle if an asset cannot load.
- Icons appear in product cards, the add-flow store-detection row and chips, the product preview, and the settings store list.
- Activity events intentionally do not show site icons because the activity-event model does not store a site key.

## Verification

- `npm run typecheck`
- `npm run lint`
- Manual device check of the icon surfaces above, including the fallback path when an icon asset is unavailable.

## Maintenance

When adding a store, follow the checklist in [current-state.md](current-state.md#adding-a-store). Add the PNG asset and `SITE_COLORS` fallback entry with the parser, registry, and tests; do not add surface-specific icon wiring.
