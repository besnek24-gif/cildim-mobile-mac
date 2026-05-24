import { createLeanSupabase } from '@/lib/admin/nodeResolver';

function normalize(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const sb = createLeanSupabase();

  const { data: masters, error: mastersError } = await sb
    .from('ingredients_master')
    .select('id, canonical_name');

  if (mastersError) {
    console.error('FETCH_MASTERS_ERROR', mastersError);
    process.exit(1);
  }

  const { data: aliases, error: aliasesError } = await sb
    .from('ingredient_aliases')
    .select('alias_name, ingredient_id');

  if (aliasesError) {
    console.error('FETCH_ALIASES_ERROR', aliasesError);
    process.exit(1);
  }

  const known = new Set<string>();

  for (const m of masters || []) {
    known.add(normalize(m.canonical_name));
  }

  for (const a of aliases || []) {
    known.add(normalize(a.alias_name));
  }

  const { data: unknowns, error: unknownsError } = await sb
    .from('ingredient_unknown_queue')
    .select('normalized_name, seen_count')
    .order('seen_count', { ascending: false })
    .limit(50);

  if (unknownsError) {
    console.error('FETCH_UNKNOWNS_ERROR', unknownsError);
    process.exit(1);
  }

  const trulyMissing = (unknowns || []).filter((x) => {
    const n = normalize(x.normalized_name);
    return !known.has(n);
  });

  console.log('TRULY_MISSING_UNKNOWNS_V11');
  console.log(JSON.stringify(trulyMissing.slice(0, 20), null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('TRULY_MISSING_UNKNOWNS_V11_ERROR');
    console.error(err);
    process.exit(1);
  });
}
