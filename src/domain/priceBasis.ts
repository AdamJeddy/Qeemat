/** Stable comparison basis. Pack prices remain pack prices; weighted prices use kg. */
export type PriceBasis = 'kg' | `pack:${string}`;

export function inferPackBasis(title: string): PriceBasis | undefined {
  const lower = title.toLowerCase();
  const count = lower.match(/\bpack\s*(?:of\s*)?(\d+)\b/)?.[1] ?? lower.match(/\b(\d+)\s*(?:count|pcs|pieces|packs?)\b/)?.[1];
  const sizes = [...lower.matchAll(/(?:^|[^\d.-])(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|litres?|liters?|ltr|l)\b/g)].map((match) => {
    const unit = match[3];
    const amount = Number(match[2]) * (/^(kg|l|litres?|liters?|ltr)$/.test(unit) ? 1000 : 1);
    return `${match[1] ?? count ?? 1}x${amount}${unit === 'kg' || unit === 'g' ? 'g' : 'ml'}`;
  });
  return sizes.length ? `pack:${sizes.join('+')}` : count ? `pack:${count}pcs` : undefined;
}

type PriceIdentity = { title: string; priceBasis?: PriceBasis };
export function pricesShareBasis(before: PriceIdentity, after: PriceIdentity): boolean {
  return (before.priceBasis ?? inferPackBasis(before.title)) === (after.priceBasis ?? inferPackBasis(after.title));
}

export function priceBasisSuffix(basis?: PriceBasis): string {
  return basis === 'kg' ? ' /kg' : basis?.startsWith('pack:') ? ` · ${basis.slice(5).replace(/\b1x/g, '').replace(/x/g, ' × ').replace(/pcs/g, ' pieces')} pack` : '';
}
