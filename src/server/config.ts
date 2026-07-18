/**
 * Server-side operational constants: rate limits, AI resilience budgets, and
 * the set of supported locales (including right-to-left languages, which the UI
 * must render correctly for a global World Cup audience).
 */

/** Maximum API requests permitted per client key within one window. */
export const RATE_LIMIT_MAX = 60;

/** Length of a rate-limit window in milliseconds. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Locales the narrator can target. Includes RTL scripts (Arabic, Hebrew). */
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'pt', 'hi', 'ar', 'he'] as const;

/** Locales that must render right-to-left. */
export const RTL_LOCALES: readonly string[] = ['ar', 'he'];

/** Whether a locale should be laid out right-to-left. */
export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.includes(locale);
}
