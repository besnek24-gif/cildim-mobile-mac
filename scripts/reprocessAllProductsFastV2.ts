import { createLeanSupabase } from '@/lib/admin/nodeResolver';

function normalizeName(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[-–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const sb = createLeanSupabase();

  const { data: products, error: productsError } = await sb
    .from('products')
    .select('id, name, ingredients');

  if (productsError) {
    console.error('FETCH_PRODUCTS_ERROR', productsError);
    process.exit(1);
  }

  const { data: masters, error: mastersError } = await sb
    .from('ingredients_master')
    .select('id, canonical_name, risk_level, function_tags');

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

  const masterById = new Map();
  const lookup = new Map();

  for (const m of masters || []) {
    masterById.set(m.id, m);
    lookup.set(normalizeName(m.canonical_name), m);
  }

  for (const a of aliases || []) {
    const master = masterById.get(a.ingredient_id);
    if (master) {
      lookup.set(normalizeName(a.alias_name), master);
    }
  }

  let updated = 0;

  for (const product of products || []) {
    const rawIngredients = Array.isArray(product.ingredients)
      ? product.ingredients
      : typeof product.ingredients === 'string'
        ? product.ingredients.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const resolved = rawIngredients.map((raw: any) => {
      const original = String(raw || '').trim();
      const normalized = normalizeName(original);
      const found = lookup.get(normalized);

      if (found) {
        return {
          original_name: original,
          canonical_name: found.canonical_name,
          risk_level: found.risk_level || 'medium',
          function_tags: found.function_tags || [],
          is_unknown: false
        };
      }

      return {
        original_name: original,
        canonical_name: normalized,
        risk_level: 'medium',
        function_tags: ['unknown'],
        is_unknown: true
      };
    });

    const unknown_count = resolved.filter((x: any) => x.is_unknown).length;
    const total_count = resolved.length;
    const pct = total_count ? Math.round((unknown_count / total_count) * 100) : 0;

    const { error: updateError } = await sb
      .from('products')
      .update({
        ingredients_resolved: resolved,
        unknown_ingredient_count: unknown_count
      })
      .eq('id', product.id);

    if (updateError) {
      console.error('UPDATE_ERROR', product.name, updateError.message);
      continue;
    }

    console.log(`[%${pct} unknown]  ${product.name}  ${unknown_count}/${total_count}`);

    updated++;
  }

  console.log('REPROCESS_FAST_DONE');
  console.log({ updated });
}

if (require.main === module) {
  main().catch(err => {
    console.error('REPROCESS_FAST_ERROR');
    console.error(err);
    process.exit(1);
  });
}
