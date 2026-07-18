import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy, securityHeaders } from '@/server/security';

describe('contentSecurityPolicy', () => {
  it('embeds the request nonce in the script-src directive', () => {
    const csp = contentSecurityPolicy('abc123');
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe('securityHeaders', () => {
  it('returns the full hardening header set', () => {
    const headers = securityHeaders('abc123');
    expect(headers['Content-Security-Policy']).toContain('abc123');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(headers['Permissions-Policy']).toContain('geolocation=()');
  });
});
