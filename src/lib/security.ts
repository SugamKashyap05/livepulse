export const MAX_INPUT_CHARS = 4000;

/**
 * Validates that string input is under a safe character limit.
 */
export function enforceInputLimit(input: unknown, maxChars: number = MAX_INPUT_CHARS): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length > maxChars) {
    return trimmed.slice(0, maxChars);
  }
  return trimmed;
}

/**
 * Super lightweight HTML stripper for AI outputs.
 * In a real-world scenario, you might want to use DOMPurify,
 * but for this, stripping <, >, and javascript: is usually enough
 * to block direct script injections while allowing safe markdown.
 */
export function sanitizeAiOutput(output: string): string {
  if (typeof output !== "string") return "";
  
  // Neutralize common XSS markers while trying to preserve basic text
  return output
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "blocked:")
    .replace(/onerror=/gi, "blocked=")
    .replace(/onload=/gi, "blocked=")
    .replace(/eval\(/gi, "blocked(")
    .replace(/document\.cookie/gi, "blocked_cookie")
    .replace(/[\uFF01-\uFF5E]/g, ""); // Strip Unicode full-width characters that bypass naive filters
}

/**
 * Checks if a payload string is too large to process.
 */
export function isPayloadTooLarge(payload: string, limitBytes = 500_000): boolean {
  return new Blob([payload]).size > limitBytes;
}
