import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    {
      suggested_canonical_name: 'sodium stearoyl glutamate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emulsifier', 'skin_conditioning']
    },
    {
      suggested_canonical_name: 'glycyrrhiza inflata root extract',
      aliases: ['licorice root extract'],
      risk_level: 'low',
      function_tags: ['skin_conditioning']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('TOP_UNKNOWN_BATCH_V7_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('TOP_UNKNOWN_BATCH_V7_ERROR');
    console.error(err);
    process.exit(1);
  });
}
