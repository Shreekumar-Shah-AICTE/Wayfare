/**
 * Sanitises untrusted model output before it is stored or rendered.
 *
 * The deterministic core already guarantees decisions cannot be altered by an
 * LLM, so this is defence-in-depth for *display*: angle brackets are stripped
 * (belt-and-braces with React's own escaping), whitespace is collapsed, and the
 * string is length-capped to bound payload size.
 */

/** Maximum characters retained from a narration string. */
export const MAX_NARRATION_CHARS = 4000;

/** Returns a display-safe version of arbitrary model text. */
export function sanitizeModelText(text: string): string {
  const withoutAngles = text.replace(/[<>]/g, ' ');
  const collapsed = withoutAngles.replace(/\s{2,}/g, ' ');
  return collapsed.trim().slice(0, MAX_NARRATION_CHARS);
}
