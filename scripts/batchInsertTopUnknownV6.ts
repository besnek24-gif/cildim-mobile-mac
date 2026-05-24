import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    {
      suggested_canonical_name: 'carnitine',
      aliases: ['l-carnitine'],
      risk_level: 'low',
      function_tags: ['skin_conditioning']
    },
    {
      suggested_canonical_name: 'sodium carrageenan',
      aliases: ['carrageenan'],
      risk_level: 'medium',
      function_tags: ['thickener', 'stabilizer']
    },
    {
      suggested_canonical_name: 'copernicia cerifera cera',
      aliases: ['carnauba wax'],
      risk_level: 'low',
      function_tags: ['emollient', 'film_forming']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('TOP_UNKNOWN_BATCH_V6_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('TOP_UNKNOWN_BATCH_V6_ERROR');
    console.error(err);
    process.exit(1);
  });
}
