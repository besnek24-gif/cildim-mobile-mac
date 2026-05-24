import { createLeanSupabase } from '@/lib/admin/nodeResolver';
import { resolveIngredient } from '@/lib/ingredients/ingredientResolver';

async function main() {
  const sb = createLeanSupabase();

  const { data: products, error } = await sb
    .from('products')
    .select('id, name, ingredients');

  if (error) {
    console.error('FETCH_PRODUCTS_ERROR', error);
    process.exit(1);
  }

  let totalFound = 0;
  let totalMissed = 0;

  for (const product of products || []) {
    // ingredients is a comma-separated string, not an array
    const raw = typeof product.ingredients === 'string'
      ? product.ingredients
      : '';

    const rawList = raw
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    const resolved = [];

    for (const ing of rawList) {
      const r = await resolveIngredient(ing, sb);
      resolved.push(r);
      if (r.found) totalFound++;
      else totalMissed++;
    }

    const foundCount = resolved.filter(r => r.found).length;
    const pct = rawList.length > 0
      ? Math.round((foundCount / rawList.length) * 100)
      : 0;

    console.log(`[${pct}%] ${product.name} — ${foundCount}/${rawList.length} resolved`);
  }

  console.log('\nREPROCESS_SUMMARY');
  console.log({
    products: (products || []).length,
    totalFound,
    totalMissed,
    overallPct: Math.round((totalFound / (totalFound + totalMissed)) * 100) + '%'
  });

  console.log('\nNOTE: "ingredients_resolved" column does not exist in products table.');
  console.log('Run in Supabase SQL Editor to enable writes:');
  console.log('  ALTER TABLE products ADD COLUMN ingredients_resolved jsonb;');
}

if (require.main === module) {
  main().catch(err => {
    console.error('REPROCESS_ERROR');
    console.error(err);
    process.exit(1);
  });
}
