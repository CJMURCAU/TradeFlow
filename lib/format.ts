// Shared, locale-aware formatting (audit A-M2 dedup + i18n).
//
// Currency and locale were hardcoded ($ / en-US) across the app, the PDF and
// the email even though the product targets the UK/AU ("Labour" spelling).
// Centralise them here so a single change switches market. Override per call
// if/when business-level currency is stored.

export const LOCALE = 'en-GB';
export const CURRENCY = 'GBP';

export function formatCurrency(amount: number, currency: string = CURRENCY, locale: string = LOCALE): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number.isFinite(amount) ? amount : 0);
}

/** Seconds -> HH:MM:SS. */
export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** ISO string -> localized date+time, with a fallback for null. */
export function formatDateTime(dateString: string | null, locale: string = LOCALE): string {
  if (!dateString) return 'Not scheduled';
  return new Date(dateString).toLocaleDateString(locale, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
