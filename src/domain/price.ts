export function parsePriceToMinor(value: string | number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (!value) {
    return undefined;
  }

  const normalized = normalizePriceNumberString(String(value));
  if (!normalized) {
    return undefined;
  }

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

function normalizePriceNumberString(value: string): string | undefined {
  const sanitized = value.replace(/[^\d.,-]/g, '').trim();
  if (!sanitized) {
    return undefined;
  }

  const dotCount = (sanitized.match(/\./g) ?? []).length;
  const commaCount = (sanitized.match(/,/g) ?? []).length;

  if (dotCount > 0 && commaCount > 0) {
    const lastDot = sanitized.lastIndexOf('.');
    const lastComma = sanitized.lastIndexOf(',');
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';

    const withoutThousands = sanitized.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '');
    return decimalSeparator === ',' ? withoutThousands.replace(',', '.') : withoutThousands;
  }

  if (commaCount > 0) {
    return normalizeSingleSeparatorNumber(sanitized, ',');
  }

  if (dotCount > 0) {
    return normalizeSingleSeparatorNumber(sanitized, '.');
  }

  return sanitized;
}

function normalizeSingleSeparatorNumber(value: string, separator: ',' | '.'): string {
  const parts = value.split(separator);

  if (parts.length === 2) {
    const fractional = parts[1] ?? '';
    if (fractional.length > 0 && fractional.length <= 2) {
      return separator === ',' ? `${parts[0]}.${fractional}` : value;
    }
  }

  return value.replace(new RegExp(`\\${separator}`, 'g'), '');
}
