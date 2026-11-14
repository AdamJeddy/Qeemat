# Source onboarding: <retailer name>

Copy this template into the issue/PR evidence and fill it in. Do not commit secrets, cookies, private account URLs or personal data.

## Decision

- **Site key:** `<snake_case>`
- **Display name / short name:** `<display>` / `<short>`
- **Support level:** `supported` / `experimental`
- **Scope:** tracking / discovery / search (delete any that do not apply)
- **Why this scope:** <one or two sentences>
- **If tracking-only:** `discoveryAvailable: false` — is the limitation visible to users?
- **If search excluded:** reason shown in Coverage: <reason>

## Access and evidence

| Question | Evidence/URL | Result |
| --- | --- | --- |
| Product page fetches without login/CAPTCHA? | | |
| Share/URL forms recognized? | | |
| Price/currency unambiguous? | | |
| Availability signal reliable? | | |
| Variant identity/options exposed? | | |
| Price basis/range (kg, pack, "from")? | | |
| Discovery collection URLs work? | | |
| Search endpoint + query echo verified? | | |
| Search no-results/challenge/pagination? | | |
| Rate limit / minimum interval? | | |
| Android WebView fallback needed? | | |

**Observed dates and device:** <date, Samsung SM-S928B / desktop / browser>
**Artifacts:** <screenshots, fixture names, sanitized response samples>

## Implementation record

- [ ] `SiteKey` added (`src/domain/types.ts`)
- [ ] `SUPPORTED_SITES` entry added (`src/domain/sites.ts`)
- [ ] icon asset + `SITE_COLORS` + `docs/site-icons.md`
- [ ] URL detection/cleaning verified (`detectSupportedSite`, `cleanUrl`/`normalizeUrl`)
- [ ] product parser branch + headers/blocked handling
- [ ] OOS/failure semantics checked
- [ ] variants/price basis/range implemented or explicitly page-level
- [ ] discovery JSON + import + listing parser
- [ ] `DISCOVERY_PARSER_VERSION` bumped if cached parser output changed
- [ ] search request/parse/coverage (or exclusion) complete
- [ ] Add flow / Settings / Explore / search coverage / icons checked
- [ ] background/rate interval checked

## Tests and verification

| Gate | Command/check | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | |
| Lint | `npm run lint` | |
| Unit/component | `npm test -- --runInBand` | |
| ARM64 build | `gradlew :app:assembleRelease` | |
| Device: Add + track | Samsung SM-S928B | |
| Device: product detail/check | | |
| Device: Explore + discovery | | |
| Device: search + compare | | |
| Device: variant selection | | |

## Documentation

- [ ] `README.md` supported-store list/count
- [ ] `docs/current-state.md` store table and discovery/search counts
- [ ] `docs/discovery-sources.md` / `docs/discovery-category-audit.md` / `docs/discovery-search-feasibility.md` as applicable
- [ ] release notes if included in a release

## Limitations and follow-ups

- <blocked/partial coverage, missing variants, search exclusion, locale/currency caveats>
- <anything that would change the support level>

## Final decision

- [ ] `supported` — verified for the declared scope
- [ ] `experimental` — hidden from supported UI; evidence incomplete
- [ ] not supported — explain why
