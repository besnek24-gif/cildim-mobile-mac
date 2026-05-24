import { createLeanSupabase } from '@/lib/admin/nodeResolver';

function normalize(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

async function main() {
  const sb = createLeanSupabase();

  const { data } = await sb
    .from('ingredient_unknown_queue')
    .select('id, normalized_name');

  let fixed = 0;

  for (const item of data || []) {
    const normalized = normalize(item.normalized_name);

    await sb
      .from('ingredient_unknown_queue')
      .update({ normalized_name: normalized })
      .eq('id', item.id);

    fixed++;
  }

  console.log('NORMALIZE_DONE');
  console.log({ fixed });
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
