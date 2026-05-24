import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    {
      suggested_canonical_name: 'hydrogenated dimer dilinoleyl dimethylcarbonate copolymer',
      aliases: [],
      risk_level: 'low',
      function_tags: ['film_forming']
    },
    {
      suggested_canonical_name: 'jojoba esters',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'propylene carbonate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['solvent']
    },
    {
      suggested_canonical_name: 'aluminum stearate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['stabilizer']
    },
    {
      suggested_canonical_name: 'persea gratissima avocado fruit extract',
      aliases: ['avocado extract'],
      risk_level: 'low',
      function_tags: ['skin_conditioning']
    },
    {
      suggested_canonical_name: 'stearalkonium hectorite',
      aliases: [],
      risk_level: 'low',
      function_tags: ['thickener']
    },
    {
      suggested_canonical_name: 'glyceryl caprylate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['preservative', 'emollient']
    },
    {
      suggested_canonical_name: 'persea gratissima avocado oil',
      aliases: ['avocado oil'],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'cetyl palmitate',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'phytosphingosine hcl',
      aliases: ['phytosphingosine hydrochloride'],
      risk_level: 'low',
      function_tags: ['skin_conditioning']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('TOP_UNKNOWN_BATCH_V10_RESULT');
  console.log(JSON.stringify(res, null, 2));
}

main().catch(err => {
  console.error('TOP_UNKNOWN_BATCH_V10_ERROR', err);
  process.exit(1);
});
