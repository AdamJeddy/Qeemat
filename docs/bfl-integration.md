# Brands For Less (BFL) Integration

**Issue:** #9  
**Status:** Parked — parser complete, fetch path blocked by Cloudflare  
**Last reconciled with the repo:** 2026-07-23

## What's implemented (and working)

All six store-integration steps from `AGENTS.md` are complete:

| Step | File | Status |
|------|------|--------|
| `SiteKey` | `src/domain/types.ts` | `'brands_for_less'` added |
| `SupportedSite` | `src/domain/sites.ts` | Entry with hostnames, icon, notes — status: `experimental` |
| Favicon | `assets/site-icons/brands_for_less.png` | 32px PNG |
| `SITE_COLORS` | `src/components/SiteIcon.tsx` | `#E31E24` |
| Parser | `src/domain/parser.ts` | `parseBFLProduct()` + `extractNextData()` + `detectBFLOutOfStock()` |
| Tests | `src/domain/__tests__/parser.test.ts` | 4 tests (SSR payload, meta fallback, OOS, URL detection) |

The parser handles:
- `__NEXT_DATA__` SSR payloads (product name, price, images, stock status)
- Meta tag fallbacks (`og:title`, `product:price:amount`, etc.)
- OOS detection via HTML text patterns (`out of stock`, `sold out`, etc.)
- In-stock detection via `add to bag` / `add to cart` buttons

## The problem: Cloudflare

BFL (`brandsforless.com`) is behind Cloudflare. The site serves JS challenge interstitials to non-browser HTTP clients.

The root cause is **TLS fingerprinting** (JA3/JA4), not User-Agent. React Native's `fetch` (backed by OkHttp) has a fundamentally different TLS fingerprint than any browser. Cloudflare detects this and challenges the request regardless of header values.

## Approaches tried

### 1. Header tweaking — ❌ Failed

**What:** Changed User-Agent and removed Chrome-specific `Sec-Ch-Ua*` headers.
- Attempt A: iOS Safari 17.5 UA → still blocked
- Attempt B: Chrome-on-Android UA with matching `Sec-Ch-Ua-Mobile: ?1` and `Sec-Ch-Ua-Platform: "Android"` → still blocked

**Why it failed:** Cloudflare fingerprints the TLS handshake, not just HTTP headers. OkHttp's TLS cipher suite order, extensions, and HTTP/2 settings don't match any real browser.

### 2. Native Android WebView (headless) — ❌ Not working

**What:** Created `QeematWebViewFetcherModule.kt` — a native module that:
- Creates a headless `android.webkit.WebView` (uses Chrome engine on Android)
- Loads the product URL
- Extracts `document.documentElement.outerHTML` via `evaluateJavascript`
- Returns HTML to JS via Promise

**WebView v2 improvements:**
- Detects Cloudflare challenge pages in extracted HTML and waits for redirect (instead of returning challenge HTML)
- 2.5s post-load delay for Cloudflare JS challenge to complete
- 45s total timeout
- Doesn't reject on HTTP errors (Cloudflare returns 503 for challenges)

**Files:** `QeematWebViewFetcherModule.kt`, `QeematWebViewFetcherPackage.kt`, `src/domain/webViewFetcher.ts`

**Why it didn't work:** Unknown — the WebView should pass Cloudflare challenges since it uses the real Chrome engine. Possible causes:
- `onPageFinished` timing still racing with Cloudflare's post-challenge redirect
- Application context issues in headless/service contexts
- BFL uses "I'm Under Attack" mode with stricter challenge requirements

### 3. Parser flow with WebView fallback

**What:** `fetchAndParseProduct()` in `parser.ts` tries standard `fetch` first, and if blocked, falls back to the native WebView module.

**Flow:**
```
fetch() → blocked → WebView fallback → parse HTML → success
                     ↓ (unavailable)
                   return blocked error
```

## What to try next

### Option A: `react-native-webview` (recommended first try)
Use the well-maintained `react-native-webview` library instead of the custom native module. It handles navigation lifecycle more robustly and is battle-tested.

- Install: `npm install react-native-webview`
- Mount a hidden `<WebView>` in the React tree
- Use `injectedJavaScript` + `onMessage` to extract HTML
- **Limitation:** Won't work for background checks (Headless JS has no UI)

### Option B: Custom OkHttp TLS
Configure OkHttp with Chrome-matching cipher suites and TLS extensions:
- Set specific `ConnectionSpec` with Chrome's cipher order
- Override TLS extension values
- Use `SSLSocketFactory` customization
- **Advantage:** Works for both foreground and background

### Option C: Find BFL API endpoint
- Check if BFL has a mobile app (inspect APK for API endpoints)
- Try Next.js `_next/data/{buildId}/...` JSON endpoints
- Try `api.brandsforless.com` or alternative subdomains
- Try search/autocomplete endpoints that might bypass Cloudflare

### Option D: Cookie pre-warming
- First request the BFL homepage (might have lighter Cloudflare settings)
- Extract Cloudflare clearance cookie from response
- Use cookie in subsequent product page requests

## Current state

- BFL is marked as `status: 'experimental'` in `sites.ts` — hidden from UI (store chips, supported count)
- All parser code, site config, icon, and tests remain intact
- To re-enable: change status back to `'supported'` in `sites.ts`
- The `_bfl*.js`, `_fetch_bfl.js`, `_save_icon.js` scratch scripts were deleted (experimentation helpers)
