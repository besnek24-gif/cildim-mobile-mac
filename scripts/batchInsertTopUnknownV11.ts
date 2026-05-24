import { applyUnknownResolutionCandidates } from '@/lib/admin/batchResolverNodeSafe';
import { createLeanSupabase } from '@/lib/admin/nodeResolver';

async function main() {
  const sb = createLeanSupabase();

  const candidates = [
    // ── 4 triglycerides — chemically distinct, separate canonicals ─────────────
    {
      suggested_canonical_name: 'tristearin',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'triolein',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'trilinolein',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'trilinolenin',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient']
    },

    // ── Merged pairs — spelling/hyphen/UK-US variants only ─────────────────────
    {
      suggested_canonical_name: 'aluminum starch octenylsuccinate',
      aliases: ['aluminium starch octenylsuccinate'],
      risk_level: 'low',
      function_tags: ['absorbent']
    },
    {
      suggested_canonical_name: 'polyglyceryl-2-dipolyhydroxystearate',
      aliases: ['polyglyceryl2 dipolyhydroxystearate'],
      risk_level: 'low',
      function_tags: ['emulsifier']
    },
    {
      suggested_canonical_name: 'oleth-10',
      aliases: ['oleth10'],
      risk_level: 'low',
      function_tags: ['surfactant', 'emulsifier']
    },
    {
      suggested_canonical_name: 'laureth-7',
      aliases: ['laureth7'],
      risk_level: 'low',
      function_tags: ['surfactant', 'emulsifier']
    },

    // ── Singletons — truly missing individual canonicals ───────────────────────
    {
      suggested_canonical_name: 'hydrogenated vegetable oil',
      aliases: [],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'sodium carboxymethyl betaglucan',
      aliases: [],
      risk_level: 'low',
      function_tags: ['humectant', 'skin_conditioning']
    },
    {
      suggested_canonical_name: 'c9-12 alkane',
      aliases: ['c912 alkane'],
      risk_level: 'low',
      function_tags: ['emollient']
    },
    {
      suggested_canonical_name: 'carnosine',
      aliases: [],
      risk_level: 'low',
      function_tags: ['antioxidant']
    },
    {
      suggested_canonical_name: 'acrylates/vinyl isodecanoate crosspolymer',
      aliases: ['acrylatesvinyl isodecanoate crosspolymer'],
      risk_level: 'low',
      function_tags: ['film_forming']
    },
    {
      suggested_canonical_name: 'isodeceth-6',
      aliases: ['isodeceth6'],
      risk_level: 'low',
      function_tags: ['emulsifier', 'surfactant']
    },
    {
      suggested_canonical_name: 'poloxamer 338',
      aliases: [],
      risk_level: 'low',
      function_tags: ['surfactant']
    },
    {
      suggested_canonical_name: 'phenylethyl resorcinol',
      aliases: [],
      risk_level: 'low',
      function_tags: ['active']
    },
    {
      suggested_canonical_name: 'mannitol',
      aliases: [],
      risk_level: 'low',
      function_tags: ['humectant']
    },
    {
      suggested_canonical_name: 'triacontanyl pvp',
      aliases: [],
      risk_level: 'low',
      function_tags: ['film_forming']
    }
  ];

  const res = await applyUnknownResolutionCandidates(candidates, sb);

  console.log('TOP_UNKNOWN_BATCH_V11_RESULT');
  console.log(JSON.stringify(res, null, 2));

  console.log('\nSummary:');
  console.log(`  Canonical inserted : ${res.inserted_master_count}`);
  console.log(`  Canonical reused   : ${res.reused_master_count}`);
  console.log(`  Aliases inserted   : ${res.inserted_alias_count}`);
  console.log(`  Aliases skipped    : ${res.skipped_alias_count}`);
  console.log(`  Errors             : ${res.errors.length}`);
  if (res.errors.length > 0) console.log('  Error detail:', res.errors);
}

main().catch(err => {
  console.error('TOP_UNKNOWN_BATCH_V11_ERROR', err);
  process.exit(1);
});
