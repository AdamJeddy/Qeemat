export function parsePriceToMinor(value: string | number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (!value) {
    return undefined;
  }

  const normalized = String(value)
    .replace(/AED/gi, '')
    .replace(/[^\d.,-]/g, '')
    .replace(/,/g, '')
    .trim();

  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount)) {
    return undefined;
  }

  return Math.round(amount * 100);
}

export function formatPrice(priceMinor?: number, currency = 'AED'): string {
  if (priceMinor === undefined || priceMinor === null) {
    return 'Price unavailable';
  }

  const amount = priceMinor / 100;
  return `${currency} ${amount.toLocaleString('en-AE', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatPriceDelta(deltaMinor?: number, currency = 'AED'): string {
  if (!deltaMinor) {
    return `${currency} 0`;
  }

  const abs = Math.abs(deltaMinor);
  return `${deltaMinor < 0 ? '-' : '+'}${formatPrice(abs, currency)}`;
}

export function parseTargetPriceInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return parsePriceToMinor(trimmed);
}
