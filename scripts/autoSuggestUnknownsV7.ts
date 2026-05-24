import { createLeanSupabase } from '@/lib/admin/nodeResolver';

function guessFunctionTags(name: string): string[] {
  const n = name.toLowerCase();

  if (n.includes('glycol')) return ['humectant', 'solvent'];
  if (n.includes('extract')) return ['skin_conditioning'];
  if (n.includes('cera') || n.includes('wax')) return ['emollient', 'film_forming'];
  if (n.includes('lecithin')) return ['emollient', 'emulsifier'];
  if (n.includes('simethicone')) return ['antifoaming', 'skin_protecting'];
  if (n.includes('starch')) return ['absorbent', 'bulking'];
  if (n.includes('glutamate')) return ['emulsifier', 'skin_conditioning'];
  if (n.includes('malate')) return ['emollient'];
  if (n.includes('carrageenan')) return ['thickener', 'stabilizer'];
  if (n.includes('carnitine')) return ['skin_conditioning'];
  if (n.includes('water') || n.includes('aqua')) return ['solvent'];

  return ['unknown'];
}

function guessRiskLevel(name: string): 'low' | 'medium' {
  const n = name.toLowerCase();

  if (n.includes('phenoxy') || n.includes('alcohol')) return 'medium';
  if (n.includes('carrageenan')) return 'medium';

  return 'low';
}

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

  const suggestions = (data || []).map((item) => ({
    name: item.normalized_name,
    frequency: item.seen_count,
    suggested_function_tags: guessFunctionTags(item.normalized_name),
    suggested_risk_level: guessRiskLevel(item.normalized_name)
  }));

  console.log('AUTO_SUGGEST_V7_PREVIEW');
  console.log(JSON.stringify(suggestions, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('AUTO_SUGGEST_V7_ERROR');
    console.error(err);
    process.exit(1);
  });
}
