export interface Ingredient {
  /** Chemical / common name as printed in Section 3. */
  name: string;
  /** CAS registry number, e.g. "134-62-3". Empty string if none found. */
  cas: string;
  /** Raw concentration text as printed, e.g. "10 - 30%" or "Proprietary". */
  concentrationRaw: string;
  /** Lower bound of the disclosed concentration range (%), or null if unknown. */
  min: number | null;
  /** Upper bound of the disclosed concentration range (%), or null if unknown. */
  max: number | null;
  /** True when the concentration is withheld as a trade secret / proprietary. */
  isProprietary: boolean;
  /** Estimated single-point concentration (%), normalized so the set sums to ~100. */
  estimatedPct: number;
}

export interface Composition {
  ingredients: Ingredient[];
  /** Sum of disclosed range midpoints before normalization (sanity signal). */
  disclosedMidpointTotal: number;
  /** Whether Section 3 was located in the document. */
  found: boolean;
}
