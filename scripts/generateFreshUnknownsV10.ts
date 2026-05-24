import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const { data, error } = await sb
    .from('ingredient_unknown_queue')
    .select('normalized_name, seen_count')
    .order('seen_count', { ascending: false })
    .limit(20);

  if (error) {
    console.error('FETCH_ERROR', error.message);
    process.exit(1);
  }

  console.log('TOP_UNKNOWNS_V10');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error('ERROR', err);
  process.exit(1);
});
