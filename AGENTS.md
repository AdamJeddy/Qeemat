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
src/components/   — reusable UI (AppText, ProductCard, SiteIcon, etc.)
src/data/         — AsyncStorage persistence (database.ts)
src/domain/       — business logic (parser, checker, sites, dates, price, types)
  __tests__/      — Jest tests, parser fixtures only so far
src/theme/        — colors, radius, shadow tokens
App.tsx           — all screens in one file (no React Navigation)
android/          — Kotlin native modules (WorkManager, notifications)
assets/site-icons/— per-store favicon PNGs
```

## Conventions

- **Screens** live in `App.tsx` as top-level function components with a manual `Route` union type stack. No React Navigation.
- **Domain layer** is pure TypeScript; no React imports. Keeps parsers, price formatting, date helpers, and site config separate from UI.
- **Types** are defined in `src/domain/types.ts`. Add new `SiteKey` values there first; then `sites.ts`, then parser logic, then tests.
- **Components** use a wrapper `<AppText>` instead of raw `<Text>` for consistent typography. All colors come from `src/theme/theme.ts`.
- **Styles** use React Native `StyleSheet.create` at the bottom of each file.
- **Icons** come from `lucide-react-native`.
- **Storage** is AsyncStorage (flat key-value). Each entity type has its own key namespace managed through `src/data/database.ts`.
- **Tests** are parser-focused (`src/domain/__tests__/parser.test.ts` — 20 tests) and OOS-fixture-focused (`src/domain/__tests__/oos-parser.test.ts` — 9 fixture-driven tests). Use `--runInBand` to avoid parallel AsyncStorage conflicts.
- **Snapshots** carry a `source` field: `manual_single`, `manual_batch`, `background`, or `unknown`.
- **Tracked products** carry `lastAvailability` (from most recent successful check), used by UI components to render OOS state. Defaults to `'unknown'` for legacy data.
- **OOS detection** is handled per-site in `src/domain/parser.ts`. When a product is OOS with no price, `fetchAndParseProduct` still succeeds — the last known price is preserved on the product record. OOS test fixtures live in `src/domain/__tests__/fixtures/oos/` (gitignored).
- **Commit messages** follow conventional commits. When work corresponds to a GitHub issue, append `(#N)` — e.g. `feat: add adidas store (#18)`. Standalone or trivial changes (docs tweaks, formatting, tooling) don't require an issue number.

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
