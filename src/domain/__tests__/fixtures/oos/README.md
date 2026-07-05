# OOS Test Fixtures

HTML snapshots of out-of-stock product pages, used by `src/domain/__tests__/oos-parser.test.ts`.

## Adding a new fixture

1. Run the fetch script with the site key and URL:

```bash
node scripts/fetch-oos-fixture.mjs <site-key> "<url>"
```

Example:
```bash
node scripts/fetch-oos-fixture.mjs noon "https://www.noon.com/uae-en/some-product/p/"
```

2. Verify the saved HTML contains OOS signals (open the file and search for out-of-stock text/JSON).

3. The test at `src/domain/__tests__/oos-parser.test.ts` auto-discovers fixtures by filename:
   - `noon.html` → tests against `parseProductHtml('noon', ...)`
   - `amazon_ae.html` → tests against `parseProductHtml('amazon_ae', ...)`
   - etc.

4. Run the tests:

```bash
npm test -- --runInBand oos-parser
```

## Fixture naming convention

| Filename | Site Key | Test URL pattern |
|----------|----------|-----------------|
| `noon.html` | `noon` | noon.com |
| `amazon_ae.html` | `amazon_ae` | amazon.ae |
| `amazon_com.html` | `amazon_ae` | amazon.com |
| `ounass.html` | `ounass` | ounass.ae |
| `ay_accessories.html` | `ay_accessories` | ay-accessories.com |
| `level_shoes.html` | `level_shoes` | levelshoes.com |
| `nike_uae.html` | `nike_uae` | nike.ae |
| `sun_sand_sports.html` | `sun_sand_sports` | sssports.com |
| `adidas.html` | `adidas` | adidas.ae |

## Notes

- These HTML files contain real product page markup. They are gitignored by default
  to avoid committing large files and site-specific content.
- When a fixture is present, the corresponding test runs automatically.
- When a fixture is missing, the test is skipped with `it.skip`.
