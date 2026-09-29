/**
 * Finds `quote` in `text`, tolerating line breaks, punctuation and case
 * differences between the stored text and the quote the AI cited.
 * Returns [start, end] or null.
 */
export function locateQuote(text, quote) {
  const words = quote?.match(/[\p{L}\p{N}]+/gu);
  if (!text || !words || words.length < 2) return null;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const match = new RegExp(escaped.join('[^\\p{L}\\p{N}]+'), 'iu').exec(text);
  return match ? [match.index, match.index + match[0].length] : null;
}
