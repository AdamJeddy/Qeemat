# Product metadata source review

Reviewed 12 November 2026 against the 21 configured retailer entries. A retailer may return different markup for another product, locale, variant, region, or session. An HTTP challenge or an inaccessible sample is not evidence that the store never supplies metadata. The app only saves fields it can associate with the tracked product; missing fields stay unknown.

The shared path reads product-scoped schema.org Product/ProductGroup data and ordered BreadcrumbList data, plus a matching, more detailed product-page heading. H&M also supplies a product type and selected garment attributes in its rendered product description; Al Yousuf supplies category links in its WooCommerce breadcrumb; Decathlon can supply a product type in its ProductJson; and Carrefour's selected product record can supply a product type and category identifiers. The shared extractor is exercised for every configured retailer with synthetic fixtures. The following describes evidence from a sample, not exhaustive verification of each retailer.

| Retailer | Sample reviewed | Evidence and limit |
| --- | --- | --- |
| Noon | Direct product response | BreadcrumbList category names, Product brand and color. |
| Carrefour UAE | Direct request returned 403; existing source-shaped Flight fixture reviewed | Selected product record can contain product type and category codes. Human-readable names were not verified in this request. |
| Nike UAE | Direct product response | Product brand and a more descriptive matching H1; no product category in the sampled structured data. |
| Sun & Sand Sports | Direct product response | Product brand and matching H1; sampled breadcrumb was empty. |
| Level Shoes | Direct product response | BreadcrumbList category names, Product brand and color. A numeric category value is not treated as a category name. |
| Al Yousuf Accessories | Direct product response | WooCommerce breadcrumb links and Product brand; category labels can contain slashes. |
| Ounass UAE | Direct request failed | No new live product metadata verified; shared structured-data extraction applies when present. |
| Amazon | Direct sample returned an interstitial or no usable product schema | No metadata availability claim for this sample or other regional domains. |
| Adidas UAE | Direct request returned 403 | No new live product metadata verified; shared structured-data extraction applies when present. |
| PUMA UAE | Direct product response | BreadcrumbList category names, Product brand and color. |
| Decathlon UAE | Direct product response | ProductGroup category and brand; ProductJson is also read for explicit product type and vendor when present. |
| Salomon GCC | Direct product response | Product brand; sampled breadcrumbs contained only Home and the product. A placeholder "Product Type" in unrelated page text is not used. |
| Sephora UAE | Direct request returned 403 | No new live product metadata verified; shared structured-data extraction applies when present. |
| Faces UAE | Direct request failed | No new live product metadata verified; shared structured-data extraction applies when present. |
| Centrepoint UAE | Direct request returned 403 | No new live product metadata verified; shared structured-data extraction applies when present. |
| Namshi UAE | Direct product response | BreadcrumbList category names and Product brand. |
| The Deal | Direct request failed | No new live product metadata verified; shared structured-data extraction applies when present. The initial product-page metadata is preserved when resolving a selected option. |
| Sharaf DG | Direct request returned 403 | No new live product metadata verified; shared structured-data extraction applies when present. |
| Brands For Less | Direct request returned 403 | No new live product metadata verified; shared structured-data extraction applies when present. |
| H&M UAE | Previously saved rendered product page; direct request returned 403 | BreadcrumbList, Product brand, and product-description type and garment attributes. |
| Zara UAE | Previously saved rendered product page; direct request returned a shell | ProductGroup brand and material; sampled breadcrumb contained only the store and product, not a category. |

Source metadata is captured at creation or the next successful product check. It is stored separately from a shopper-selected category; a later response that omits a field retains the previously known value. The retailer's category IDs are kept separately from readable names. Explicit user categories and the choice to leave a product uncategorized take precedence over inferred categories. A retailer page may omit metadata, be blocked, or change its format; in those cases Qeemat does not manufacture a source-provided category or type. Existing Search behavior may still use its separately identified title/URL suggestion when no recognized retailer category is available.
