import { parseSds } from '../src/lib/sds';

// Simulated extracted lines from a few different SDS layouts.
const samples: Record<string, string[]> = {
  'ranges + proprietary': [
    'SECTION 2: Hazards identification',
    'Danger. Flammable liquid.',
    'SECTION 3: Composition / Information on Ingredients',
    'Chemical Name CAS-No. Concentration',
    'Acetone 67-64-1 30 - 60 %',
    'Toluene 108-88-3 10 - 30 %',
    'Proprietary surfactant blend 0000-00-0 Trade Secret',
    'SECTION 4: First-aid measures',
    'Get medical attention.',
  ],
  'comparators + single': [
    'Section 3 - Composition/Information on Ingredients',
    'Substance Name CAS Number Weight %',
    'N,N-Diethyl-meta-toluamide (DEET) 134-62-3 98.11%',
    'Other ingredients 1.89%',
    'Section 4 First Aid Measures',
  ],
  'wrapped concentration': [
    '3. COMPOSITION/INFORMATION ON INGREDIENTS',
    'Ingredient CAS # %',
    'Distillates, petroleum, hydrotreated light 64742-47-8',
    '>= 60',
    'Naphtha 64742-48-9 < 10 %',
    '4. FIRST AID MEASURES',
  ],
};

for (const [name, lines] of Object.entries(samples)) {
  console.log(`\n=== ${name} ===`);
  const comp = parseSds(lines);
  console.log('found:', comp.found, '| disclosed midpoint total:', comp.disclosedMidpointTotal);
  let sum = 0;
  for (const i of comp.ingredients) {
    sum += i.estimatedPct;
    console.log(
      `  ${i.name.padEnd(45)} CAS ${i.cas.padEnd(12)} range=${(i.min ?? '?')}-${(i.max ?? '?')} prop=${i.isProprietary} est=${i.estimatedPct}%`,
    );
  }
  console.log('  estimated total:', Math.round(sum * 100) / 100, '%');
}
