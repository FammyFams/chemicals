import type { Ingredient } from './types';

export interface ParsedConcentration {
  min: number | null;
  max: number | null;
  isProprietary: boolean;
}

const PROPRIETARY_RE =
  /proprietary|trade\s*secret|confidential|withheld|not\s*disclosed|\bnda\b/i;

// Number possibly written with a comma decimal separator.
const NUM = '\\d+(?:[.,]\\d+)?';

const RANGE_RE = new RegExp(`(${NUM})\\s*[-–—to]+\\s*(${NUM})\\s*%?`, 'i');
const COMPARATOR_RE = new RegExp(`([<>≤≥]=?)\\s*(${NUM})\\s*%?`);
const SINGLE_RE = new RegExp(`(${NUM})\\s*%`);

function num(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

/**
 * Turn a raw concentration string from SDS Section 3 into a numeric range.
 * Handles ranges ("10 - 30%"), comparators (">= 60%", "< 0.1%"), single
 * values ("30%"), and trade-secret markers ("Proprietary").
 */
export function parseConcentration(raw: string): ParsedConcentration {
  const text = raw.trim();

  if (PROPRIETARY_RE.test(text)) {
    return { min: null, max: null, isProprietary: true };
  }

  const range = text.match(RANGE_RE);
  if (range) {
    const a = num(range[1]);
    const b = num(range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b), isProprietary: false };
  }

  const cmp = text.match(COMPARATOR_RE);
  if (cmp) {
    const op = cmp[1];
    const v = num(cmp[2]);
    if (op.startsWith('>')) return { min: v, max: 100, isProprietary: false };
    if (op.startsWith('<')) return { min: 0, max: v, isProprietary: false };
  }

  const single = text.match(SINGLE_RE);
  if (single) {
    const v = num(single[1]);
    return { min: v, max: v, isProprietary: false };
  }

  // No usable number — treat as unknown (will share the remainder).
  return { min: null, max: null, isProprietary: false };
}

const midpoint = (i: Ingredient): number | null =>
  i.min !== null && i.max !== null ? (i.min + i.max) / 2 : null;

/**
 * Assign each ingredient an estimated single-point percentage.
 *
 * Disclosed ingredients use their range midpoint. Proprietary / unknown
 * ingredients split whatever is left to reach 100% (weighted by any partial
 * range they do disclose). Everything is then normalized to sum to exactly
 * 100 so the stacked bar is well-formed. These are estimates, not the SDS's
 * own numbers — the UI labels them as such.
 */
export function estimatePercentages(ingredients: Ingredient[]): Ingredient[] {
  const disclosed = ingredients.filter((i) => midpoint(i) !== null);
  const unknown = ingredients.filter((i) => midpoint(i) === null);

  const disclosedTotal = disclosed.reduce(
    (sum, i) => sum + (midpoint(i) as number),
    0,
  );
  const remaining = Math.max(0, 100 - disclosedTotal);

  // Weight the remainder by each unknown's hinted upper bound (else equal).
  const weights = unknown.map((i) => i.max ?? i.min ?? 1);
  const weightTotal = weights.reduce((s, w) => s + w, 0) || unknown.length || 1;

  const withRaw = ingredients.map((i) => {
    const mid = midpoint(i);
    if (mid !== null) return { i, raw: mid };
    const idx = unknown.indexOf(i);
    const w = weights[idx] ?? 1;
    return { i, raw: (remaining * w) / weightTotal };
  });

  const rawTotal = withRaw.reduce((s, x) => s + x.raw, 0) || 1;

  return withRaw.map(({ i, raw }) => ({
    ...i,
    estimatedPct: Math.round(((raw / rawTotal) * 100 + Number.EPSILON) * 100) / 100,
  }));
}
