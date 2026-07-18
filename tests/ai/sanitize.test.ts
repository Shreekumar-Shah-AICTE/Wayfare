import { describe, expect, it } from 'vitest';

import { MAX_NARRATION_CHARS, sanitizeModelText } from '@/ai/sanitize';

describe('sanitizeModelText', () => {
  it('removes angle brackets to prevent markup injection', () => {
    const output = sanitizeModelText('Head <script>left</script> then right');
    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
    expect(output).toContain('left');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(sanitizeModelText('  turn    left  ')).toBe('turn left');
  });

  it('caps very long output', () => {
    expect(sanitizeModelText('a'.repeat(MAX_NARRATION_CHARS + 100))).toHaveLength(
      MAX_NARRATION_CHARS,
    );
  });
});
