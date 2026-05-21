import type { Composition, Ingredient } from './types';
import { parseConcentration, estimatePercentages } from './composition';

// CAS registry number: 2-7 digits, 2 digits, 1 check digit.
const CAS_RE = /\b\d{2,7}-\d{2}-\d\b/;
const CAS_RE_G = /\b\d{2,7}-\d{2}-\d\b/g;

const PROPRIETARY_TEXT = /proprietary|trade\s*secret|confidential|withheld|not\s*disclosed/i;

const SECTION3_START = /(?:section\s*3\b|^\s*3[.\s)]|composition.*ingredient|ingredient.*composition)/i;
const SECTION4_START = /(?:section\s*4\b|^\s*4[.\s)]|first[\s-]?aid)/i;

// Concentration fragment used to slice the trailing % text off a row.
const CONC_RE =
  /(proprietary|trade\s*secret|confidential|withheld|[<>≤≥]=?\s*\d+(?:[.,]\d+)?\s*%?|\d+(?:[.,]\d+)?\s*[-–—to]+\s*\d+(?:[.,]\d+)?\s*%?|\d+(?:[.,]\d+)?\s*%)/i;

/** Locate the Section 3 slice of the document's lines. */
function sliceSection3(lines: string[]): string[] {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION3_START.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return [];

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (SECTION4_START.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end);
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'being', 'withheld', 'specific', 'identity',
  'chemical', 'composition', 'information', 'ingredient', 'ingredients', 'this',
  'that', 'with', 'from', 'has', 'have', 'not', 'disclosed', 'claimed', 'secret',
  'trade', 'percentage', 'concentration', 'exact',
]);

/**
 * Guard against capturing prose fragments (e.g. "...withheld as a trade
 * secret.") as proprietary ingredients. Requires at least one substantive,
 * non-stopword word.
 */
function looksLikeChemicalName(name: string): boolean {
  const words = name.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  return words.some((w) => !STOPWORDS.has(w));
}

function cleanName(raw: string): string {
  return raw
    .replace(/\b(chemical\s*name|common\s*name|ingredient|cas[-\s]*(no|number)?\.?|synonyms?|%|wt|weight|conc(?:entration)?|:)\b/gi, ' ')
    .replace(/[•·\-–—|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse SDS Section 3 into ingredients. Each ingredient row is anchored on a
 * CAS number; the text before the CAS is the name, and the concentration is
 * pulled from anywhere on the row (or the following line, since wrapped tables
 * sometimes push the % onto its own line).
 */
export function parseSds(lines: string[]): Composition {
  const section = sliceSection3(lines);
  if (section.length === 0) {
    return { ingredients: [], disclosedMidpointTotal: 0, found: false };
  }

  const ingredients: Ingredient[] = [];

  const HEADER_RE = /^(chemical|substance|ingredient|component|cas|common)\b/i;

  for (let i = 0; i < section.length; i++) {
    const line = section[i];
    const cas = line.match(CAS_RE);

    if (!cas) {
      // Proprietary/trade-secret ingredients are often listed without a CAS.
      // Capture them by name so they still appear in the breakdown.
      if (
        PROPRIETARY_TEXT.test(line) &&
        !SECTION3_START.test(line) &&
        !HEADER_RE.test(line)
      ) {
        const name = cleanName(line.replace(/proprietary|trade\s*secret|confidential|withheld|not\s*disclosed/gi, ''));
        if (!looksLikeChemicalName(name)) continue;
        ingredients.push({
          name: name || 'Proprietary ingredient',
          cas: '',
          concentrationRaw: 'Proprietary',
          min: null,
          max: null,
          isProprietary: true,
          estimatedPct: 0,
        });
      }
      continue;
    }

    const casValue = cas[0];
    const casIndex = line.indexOf(casValue);
    const before = line.slice(0, casIndex);
    const after = line.slice(casIndex + casValue.length);

    // Concentration may be on this row, or wrapped onto the next.
    let concMatch = after.match(CONC_RE) || before.match(CONC_RE);
    if (!concMatch && i + 1 < section.length && !CAS_RE.test(section[i + 1])) {
      concMatch = section[i + 1].match(CONC_RE);
    }
    const concentrationRaw = concMatch ? concMatch[0].trim() : '';

    let name = cleanName(before.replace(CONC_RE, ''));
    if (!name && i > 0 && !CAS_RE.test(section[i - 1])) {
      name = cleanName(section[i - 1]);
    }

    const { min, max, isProprietary } = parseConcentration(concentrationRaw);

    ingredients.push({
      name: name || 'Unnamed ingredient',
      cas: casValue,
      concentrationRaw: concentrationRaw || (isProprietary ? 'Proprietary' : 'Not stated'),
      min,
      max,
      isProprietary,
      estimatedPct: 0,
    });
  }

  // Fallback: some SDS list CAS numbers loosely without clean rows.
  if (ingredients.length === 0) {
    const joined = section.join(' ');
    const found = joined.match(CAS_RE_G) ?? [];
    for (const casValue of found) {
      ingredients.push({
        name: 'Unnamed ingredient',
        cas: casValue,
        concentrationRaw: 'Not stated',
        min: null,
        max: null,
        isProprietary: false,
        estimatedPct: 0,
      });
    }
  }

  // If everything is disclosed yet sums to noticeably under 100%, surface the
  // gap as an explicit "other / unlisted" slice instead of silently inflating
  // the named ingredients up to 100%.
  const hasUnknown = ingredients.some(
    (i) => i.isProprietary || i.min === null || i.max === null,
  );
  const namedMidpointTotal = ingredients.reduce(
    (s, i) => s + (i.min !== null && i.max !== null ? (i.min + i.max) / 2 : 0),
    0,
  );
  if (!hasUnknown && namedMidpointTotal < 99.5) {
    ingredients.push({
      name: 'Other / unlisted ingredients',
      cas: '',
      concentrationRaw: 'Not stated',
      min: null,
      max: null,
      isProprietary: false,
      estimatedPct: 0,
    });
  }

  const withPct = estimatePercentages(ingredients);
  const disclosedMidpointTotal = withPct.reduce(
    (s, i) => s + (i.min !== null && i.max !== null ? (i.min + i.max) / 2 : 0),
    0,
  );

  return {
    ingredients: withPct,
    disclosedMidpointTotal: Math.round(disclosedMidpointTotal * 100) / 100,
    found: true,
  };
}
