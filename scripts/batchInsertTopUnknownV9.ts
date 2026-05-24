import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    // ✅ gerçek yeni
    {
      suggested_canonical_name: 'oleyl alcohol',
      aliases: [],
      risk_level: 'medium',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'panthenyl triacetate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['skin_conditioning']
    },
    {
      suggested_canonical_name: 'hydrolyzed wheat protein pvp crosspolymer',
      aliases: [],
      risk_level: 'low',
      function_tags: ['film_forming']
    },
    {
      suggested_canonical_name: 'caffeic acid',
      aliases: [],
      risk_level: 'low',
      function_tags: ['antioxidant']
    },
    {
      suggested_canonical_name: 'oxothiazolidine',
      aliases: [],
      risk_level: 'medium',
      function_tags: ['preservative']
    },
    {
      suggested_canonical_name: 'melanin',
      aliases: [],
      risk_level: 'low',
      function_tags: ['pigment']
    },
    {
      suggested_canonical_name: 'ethyl lauroyl arginate hcl',
      aliases: ['ethyl lauroyl arginate'],
      risk_level: 'low',
      function_tags: ['preservative', 'antimicrobial']
    },

    // 🔧 hyphen fixes
    {
      suggested_canonical_name: 'c12-20 alkyl glucoside',
      aliases: ['c1220 alkyl glucoside'],
      risk_level: 'low',
      function_tags: ['surfactant', 'emulsifier']
    },
    {
      suggested_canonical_name: 'ppg-15 stearyl ether benzoate',
      aliases: ['ppg15 stearyl ether benzoate'],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'disodium ethylene dicocamide peg-15 disulfate',
      aliases: ['disodium ethylene dicocamide peg15 disulfate'],
      risk_level: 'low',
      function_tags: ['surfactant']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('TOP_UNKNOWN_BATCH_V9_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('TOP_UNKNOWN_BATCH_V9_ERROR');
    console.error(err);
    process.exit(1);
  });
}
