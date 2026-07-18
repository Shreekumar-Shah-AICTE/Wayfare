/**
 * Security header construction.
 *
 * A strict, per-request nonce-based Content-Security-Policy plus the standard
 * hardening headers are applied to every response by `src/middleware.ts`. The
 * policy is built here as a pure function so it can be unit-tested without a
 * running server.
 */

/** Builds a per-request nonce-based Content-Security-Policy string. */
export function contentSecurityPolicy(nonce: string): string {
  const directives: readonly string[] = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `upgrade-insecure-requests`,
  ];
  return directives.join('; ');
}

/**
 * Returns the full set of security headers for a response, given a request
 * nonce. HSTS, nosniff, framing, and referrer protections are always present.
 */
export function securityHeaders(nonce: string): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(nonce),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    'X-DNS-Prefetch-Control': 'off',
  };
}
