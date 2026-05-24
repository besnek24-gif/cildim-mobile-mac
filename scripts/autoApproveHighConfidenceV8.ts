import { createLeanSupabase } from '@/lib/admin/nodeResolver';
import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';

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

  const { data } = await sb
    .from('ingredient_unknown_queue')
    .select('normalized_name, seen_count')
    .gte('seen_count', 3);

  const candidates = (data || [])
    .filter(item => item.normalized_name.length > 5)
    .map(item => ({
      suggested_canonical_name: item.normalized_name.toLowerCase(),
      aliases: [],
      risk_level: guessRiskLevel(item.normalized_name),
      function_tags: guessFunctionTags(item.normalized_name)
    }))
    .filter(c => !c.function_tags.includes('unknown'));

  if (candidates.length === 0) {
    console.log('NO_AUTO_APPROVE_CANDIDATES');
    return;
  }

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('AUTO_APPROVE_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('AUTO_APPROVE_ERROR');
    console.error(err);
    process.exit(1);
  });
}
