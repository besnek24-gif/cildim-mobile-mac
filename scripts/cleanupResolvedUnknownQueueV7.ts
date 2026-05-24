import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const { data: unknowns } = await sb
    .from('ingredient_unknown_queue')
    .select('id, normalized_name');

  let cleaned = 0;

  for (const item of unknowns || []) {
    const name = item.normalized_name.toLowerCase().trim();

    // canonical_name kontrolü
    const { data: masterFound } = await sb
      .from('ingredients_master')
      .select('id')
      .ilike('canonical_name', name)
      .limit(1);

    if (masterFound && masterFound.length > 0) {
      await sb.from('ingredient_unknown_queue').delete().eq('id', item.id);
      cleaned++;
      continue;
    }

    // alias kontrolü (tire-bozuk adlar dahil)
    const { data: aliasFound } = await sb
      .from('ingredient_aliases')
      .select('id')
      .ilike('alias_name', name)
      .limit(1);

    if (aliasFound && aliasFound.length > 0) {
      await sb.from('ingredient_unknown_queue').delete().eq('id', item.id);
      cleaned++;
    }
  }

  console.log('QUEUE_CLEANUP_DONE');
  console.log({ cleaned });
}

if (require.main === module) {
  main().catch(err => {
    console.error('CLEANUP_ERROR');
    console.error(err);
    process.exit(1);
  });
}
