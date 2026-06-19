// ─────────────────────────────────────────────────────────────────────────────
// Currency formatting.
//
// V1 hardcoded `$${n.toFixed(2)}` everywhere even though the product targets
// LatAm (the voice parser understands "pesos", "lempiras", "soles"...). V2
// formats from the user's `preferences.currency`, falling back to USD.
// ─────────────────────────────────────────────────────────────────────────────

export type CurrencyCode = string;

/** Supported display currencies (ISO 4217). Extend freely. */
export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'MXN', label: 'Peso mexicano', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'COP', label: 'Peso colombiano', symbol: '$' },
  { code: 'ARS', label: 'Peso argentino', symbol: '$' },
  { code: 'CLP', label: 'Peso chileno', symbol: '$' },
  { code: 'PEN', label: 'Sol peruano', symbol: 'S/' },
  { code: 'HNL', label: 'Lempira', symbol: 'L' },
  { code: 'GTQ', label: 'Quetzal', symbol: 'Q' },
  { code: 'BRL', label: 'Real', symbol: 'R$' },
  { code: 'GBP', label: 'Pound', symbol: '£' },
];

const ZERO_DECIMAL = new Set(['CLP', 'COP', 'ARS']); // commonly shown without cents

/**
 * Formats an amount in the given currency using the platform Intl when
 * available, with a safe manual fallback (Hermes ships a limited ICU on some
 * RN builds, so we never assume Intl.NumberFormat exists).
 */
export function formatMoney(amount: number, currency: CurrencyCode = 'USD'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const fractionDigits = ZERO_DECIMAL.has(currency) ? 0 : 2;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    const meta = CURRENCIES.find((c) => c.code === currency);
    const symbol = meta?.symbol ?? '$';
    return `${symbol}${value.toFixed(fractionDigits)}`;
  }
}

/** The bare symbol for a currency (for inline `$` adornments). */
export function currencySymbol(currency: CurrencyCode = 'USD'): string {
  return CURRENCIES.find((c) => c.code === currency)?.symbol ?? '$';
}
