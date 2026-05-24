import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    {
      suggested_canonical_name: 'ethyl linoleate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient', 'skin_conditioning']
    },
    {
      suggested_canonical_name: 'disodium phenyl dibenzimidazole tetrasulfonate',
      aliases: ['neo heliopan ap'],
      risk_level: 'low',
      function_tags: ['uv_filter']
    },
    {
      suggested_canonical_name: 'methylpropanediol',
      aliases: [],
      risk_level: 'low',
      function_tags: ['humectant', 'solvent']
    },
    {
      suggested_canonical_name: 'polypodium leucotomos leaf extract',
      aliases: [],
      risk_level: 'low',
      function_tags: ['skin_conditioning', 'antioxidant']
    },
    {
      suggested_canonical_name: 'myristyl glucoside',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emulsifier', 'surfactant']
    },

    // 🔧 hyphen fix (alias ile kilitle)
    {
      suggested_canonical_name: 'alpha-isomethyl ionone',
      aliases: ['alphaisomethyl ionone'],
      risk_level: 'medium',
      function_tags: ['fragrance']
    },
    {
      suggested_canonical_name: 'nylon-12',
      aliases: ['nylon12'],
      risk_level: 'low',
      function_tags: ['bulking', 'texturizing']
    },
    {
      suggested_canonical_name: 'c14-22 alcohols',
      aliases: ['c1422 alcohols'],
      risk_level: 'low',
      function_tags: ['emollient', 'emulsifier']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('TOP_UNKNOWN_BATCH_V8_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('TOP_UNKNOWN_BATCH_V8_ERROR');
    console.error(err);
    process.exit(1);
  });
}
