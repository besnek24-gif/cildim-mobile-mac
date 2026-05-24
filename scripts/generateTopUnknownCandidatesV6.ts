import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const { data, error } = await sb
    .from('ingredient_unknown_queue')
    .select('normalized_name, seen_count')
    .order('seen_count', { ascending: false })
    .limit(10);

  if (error) {
    console.error('FETCH_ERROR', error);
    process.exit(1);
  }

  const candidates = (data || []).map((item) => ({
    suggested_canonical_name: item.normalized_name.toLowerCase(),
    aliases: [],
    risk_level: 'low',
    function_tags: ['unknown'],
    frequency: item.seen_count
  }));

  console.log('TOP_UNKNOWN_PREVIEW');
  console.log(JSON.stringify(candidates, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('SCRIPT_ERROR');
    console.error(err);
    process.exit(1);
  });
}
