import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    {
      suggested_canonical_name: 'drometrizole trisiloxane',
      aliases: ['mexoryl xl'],
      risk_level: 'low',
      function_tags: ['uv_filter']
    },
    {
      suggested_canonical_name: 'bis-ethylhexyloxyphenol methoxyphenyl triazine',
      aliases: ['tinosorb s'],
      risk_level: 'low',
      function_tags: ['uv_filter']
    },
    {
      suggested_canonical_name: 'methylene bis-benzotriazolyl tetramethylbutylphenol',
      aliases: ['tinosorb m'],
      risk_level: 'low',
      function_tags: ['uv_filter']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('UV_FILTER_BATCH_V5_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('UV_FILTER_BATCH_V5_ERROR');
    console.error(err);
    process.exit(1);
  });
}
