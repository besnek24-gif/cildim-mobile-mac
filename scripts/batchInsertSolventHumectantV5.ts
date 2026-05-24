import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    {
      suggested_canonical_name: 'butylene glycol',
      aliases: [],
      risk_level: 'low',
      function_tags: ['humectant', 'solvent']
    },
    {
      suggested_canonical_name: 'pentylene glycol',
      aliases: [],
      risk_level: 'low',
      function_tags: ['humectant', 'solvent']
    },
    {
      suggested_canonical_name: 'propanediol',
      aliases: ['1,3-propanediol'],
      risk_level: 'low',
      function_tags: ['humectant', 'solvent']
    },
    {
      suggested_canonical_name: 'hexylene glycol',
      aliases: [],
      risk_level: 'low',
      function_tags: ['solvent']
    },
    {
      suggested_canonical_name: 'propylene glycol',
      aliases: [],
      risk_level: 'medium',
      function_tags: ['humectant', 'solvent']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('SOLVENT_HUMECTANT_BATCH_V5_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('SOLVENT_HUMECTANT_BATCH_V5_ERROR');
    console.error(err);
    process.exit(1);
  });
}
