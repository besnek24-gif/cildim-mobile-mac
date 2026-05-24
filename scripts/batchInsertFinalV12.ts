import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    {
      suggested_canonical_name: 'tripalmitin',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'glycine soja (soybean) germ extract',
      aliases: ['soybean germ extract'],
      risk_level: 'low',
      function_tags: ['skin_conditioning']
    },
    {
      suggested_canonical_name: 'zea mays starch',
      aliases: [
        'zea mays (corn) starch',
        'zea mays starch'
      ],
      risk_level: 'low',
      function_tags: ['absorbent', 'bulking']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('FINAL_BATCH_V12_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('FINAL_BATCH_V12_ERROR');
    console.error(err);
    process.exit(1);
  });
}
