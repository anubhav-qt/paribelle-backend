/**
 * GST rates, derived from a product's category and its own price.
 *
 * Indian apparel is taxed on a per-piece price band rather than a flat rate:
 * a kurti at ₹900 and one at ₹1,500 attract different rates even though they
 * sit in the same category. The rate therefore cannot live on the category
 * alone, and it cannot be a single number stamped on the product at creation
 * time either — it has to be recomputed whenever the price changes.
 *
 * This module is the single place those rules live. Both the import path and
 * the ordinary create/update path go through {@link gstRateFor}.
 */

/** A category's tax treatment. */
export type GstRule =
  | { kind: 'flat'; rate: number }
  | {
      kind: 'banded';
      /** Rate applied when the per-item price is at or below `threshold`. */
      rate: number;
      /** Inclusive upper bound of the lower band, in rupees per piece. */
      threshold: number;
      /** Rate applied above `threshold`. */
      rateAbove: number;
    };

/**
 * Per-category rules, keyed by category slug.
 *
 * Apparel: 5% up to ₹1,000 per piece, 12% above.
 * Jewellery: flat 3%.
 *
 * These are policy, not arithmetic — when the rates change, change them here
 * and nowhere else.
 */
export const CATEGORY_GST_RULES: Record<string, GstRule> = {
  kurtis: { kind: 'banded', rate: 5, threshold: 1000, rateAbove: 12 },
  jewellery: { kind: 'flat', rate: 3 },
};

/** Rate for a category with no rule of its own. */
export const DEFAULT_GST_RATE = 18;

/**
 * The GST rate for one item.
 *
 * @param categorySlug the product's primary category slug
 * @param unitPrice the price of a single piece — not the line total. The
 *   threshold is a per-piece test, so ordering two ₹600 kurtis leaves both in
 *   the 5% band rather than pushing the line into the 12% one.
 */
export function gstRateFor(categorySlug: string | undefined | null, unitPrice: number): number {
  const rule = categorySlug ? CATEGORY_GST_RULES[categorySlug] : undefined;
  if (!rule) return DEFAULT_GST_RATE;
  if (rule.kind === 'flat') return rule.rate;

  const price = Number(unitPrice);
  if (!Number.isFinite(price)) return rule.rate;

  return price > rule.threshold ? rule.rateAbove : rule.rate;
}

/**
 * Human-readable explanation of how a rate was reached, for admin screens and
 * invoice footnotes.
 */
export function gstRateExplanation(categorySlug: string | undefined | null, unitPrice: number): string {
  const rule = categorySlug ? CATEGORY_GST_RULES[categorySlug] : undefined;
  if (!rule) return `${DEFAULT_GST_RATE}% (default — no rule for this category)`;
  if (rule.kind === 'flat') return `${rule.rate}% (flat rate for ${categorySlug})`;

  const rate = gstRateFor(categorySlug, unitPrice);
  return price(unitPrice) > rule.threshold
    ? `${rate}% (above ₹${rule.threshold.toLocaleString('en-IN')} per piece)`
    : `${rate}% (at or below ₹${rule.threshold.toLocaleString('en-IN')} per piece)`;
}

function price(value: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
