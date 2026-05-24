import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    {
      suggested_canonical_name: 'phenoxyethanol',
      aliases: [],
      risk_level: 'low',
      function_tags: ['preservative']
    },
    {
      suggested_canonical_name: 'ethylhexylglycerin',
      aliases: [],
      risk_level: 'low',
      function_tags: ['preservative', 'skin_conditioning']
    },
    {
      suggested_canonical_name: 'caprylyl glycol',
      aliases: [],
      risk_level: 'low',
      function_tags: ['humectant', 'preservative']
    },
    {
      suggested_canonical_name: 'sodium benzoate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['preservative']
    },
    {
      suggested_canonical_name: 'potassium sorbate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['preservative']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('HIGH_IMPACT_BATCH_V5_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('HIGH_IMPACT_BATCH_V5_ERROR');
    console.error(err);
    process.exit(1);
  });
}
