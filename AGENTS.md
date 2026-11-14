# AGENTS.md

Qeemat — Android-first, local-first price tracker for UAE shopping sites + selected Amazon domains, built with React Native + TypeScript.

## Build / Test / Lint

```bash
npm run typecheck   # tsc --noEmit (strict mode)
npm run lint        # ESLint (extends @react-native)
npm test -- --runInBand   # Jest (preset: react-native)
```

Start Metro: `npm run start`
Run on Android: `npm run android:device`
Node ≥ 20 required.

## Project Layout

```
src/components/   — reusable UI (AppText, AppTextInput, Surface, ProductCard, SiteIcon, etc.)
src/data/         — AsyncStorage persistence and discovery cache (database.ts, discovery.ts)
src/domain/       — business logic (parser, checker, sites, discovery grouping/search/ranking, updates)
  __tests__/      — domain and parser tests
src/theme/        — colors, radius, spacing, typography and layout tokens
App.tsx           — all screens in one file (no React Navigation)
android/          — Kotlin native modules (WorkManager, notifications, updater, WebView fetch)
assets/site-icons/— per-store favicon PNGs
release/          — versioned release notes and screenshots
docs/             — current state, audits, evidence and design history
```

## Conventions

- **Screens** live in `App.tsx` as top-level function components with a manual `Route` union type stack. No React Navigation.
- **Domain layer** is pure TypeScript; no React imports. Keeps parsers, price formatting, date helpers, and site config separate from UI.
- **Types** are defined in `src/domain/types.ts`. Add new `SiteKey` values there first; then `sites.ts`, then parser logic, then tests.
- **Components** use a wrapper `<AppText>` instead of raw `<Text>` for consistent typography, `<AppTextInput>` instead of raw `<TextInput>` for the shared 52-high field role (labels, focus/error states, 1.3 text cap, `bare` variant for embedded search rows), and `<Surface>` for flat card/muted/accent surfaces instead of repeating background, border, radius and padding styles. All colors come from `src/theme/theme.ts`.
- **Styles** use React Native `StyleSheet.create` at the bottom of each file.
- **Icons** come from `lucide-react-native`.
- **Storage** is AsyncStorage (flat key-value). Each entity type has its own key namespace managed through `src/data/database.ts`.
- **Tests** live beside domain logic and components: parser and OOS-fixture suites, domain logic, component renders and full `App.test.tsx` flows. Use `--runInBand` to avoid parallel AsyncStorage conflicts. The release gate is typecheck + lint + the full Jest suite; do not quote outdated suite/test counts from older docs.
- **Docs:** `docs/current-state.md` is the source of truth for shipped behavior and limitations. Dated review/QA documents are evidence records; mark them as historical when their decisions are superseded instead of silently rewriting history.
- **Snapshots** carry a `source` field: `manual_single`, `manual_batch`, `background`, or `unknown`.
- **Tracked products** carry `lastAvailability` (from most recent successful check), used by UI components to render OOS state. Defaults to `'unknown'` for legacy data.
- **OOS detection** is handled per-site in `src/domain/parser.ts`. When a product is OOS with no price, `fetchAndParseProduct` still succeeds — the last known price is preserved on the product record. OOS test fixtures live in `src/domain/__tests__/fixtures/oos/` (gitignored).
- **Commit messages** follow conventional commits. When work corresponds to a GitHub issue, append `(#N)` — e.g. `feat: add adidas store (#18)`. Standalone or trivial changes (docs tweaks, formatting, tooling) don't require an issue number.
- **Pull requests:** talk to the repo owner (`AdamJeddy`) and always add them as an **assignee** on every PR, in addition to any review request.
- **Releases:** release prep is committed directly on `dev`, then promoted with a `dev` → `main` PR. Bump `package.json`, `package-lock.json` and `android/app/build.gradle` together (`versionName`, `versionCode`), add `release/vX.Y.Z-alpha/RELEASE_NOTES.md` plus 1440-wide `screenshots/`, and build the APK separately (do not commit it). Release-note images use fixed-width HTML (`<img width="300" ...>`) so they do not render at full article width. Tag and publish the GitHub release only after the PR is merged.

## Adding a New Store

1. `src/domain/types.ts` — add to `SiteKey` union
2. `src/domain/sites.ts` — add `SupportedSite` entry
3. `assets/site-icons/{key}.png` — add favicon PNG (32–64px)
4. `src/components/SiteIcon.tsx` — add to `SITE_COLORS` record
5. `src/domain/parser.ts` — add parser branch/fixture
6. `src/domain/__tests__/parser.test.ts` — add test
7. `<SiteIcon>` auto-wires across all UI surfaces; no manual UI changes needed

## Avoid

- **No React Navigation** — the app uses a hand-rolled route stack. Do not install `@react-navigation`.
- **No SQLite** — storage is AsyncStorage. Do not introduce SQLite or an ORM without explicit direction.
- **No iOS native code** — background checks and notifications are Android-only. iOS native files may exist from the RN template but are not maintained.
- **QeematTemplate/** — kept out of the build via tsconfig excludes and `.gitignore`; do not reference it.
- **No cloud/backend** — the app is fully local; do not add server dependencies or API keys.

## Specialists

Project-local Zero specialists (in `.zero/specialists/`):

- **`karpathy-guidelines`** — Behavioral guidelines from [Andrej Karpathy's LLM coding observations](https://github.com/multica-ai/andrej-karpathy-skills). Four principles: Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution. Use via Task or as a code review lens.
- **`code-review`** — Standard code review for correctness, regressions, and missing tests.
- **`explorer`** — Fast read-only codebase exploration.
- **`worker`** — General delegated coding tasks.
