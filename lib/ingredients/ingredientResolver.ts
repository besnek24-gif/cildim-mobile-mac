import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeForLookup } from '@/lib/admin/nodeResolver';

export interface ResolvedIngredient {
  raw: string;
  normalized: string;
  found: boolean;
  canonical_name?: string;
  risk_level?: string;
  function_tags?: string[];
}

export async function resolveIngredient(
  raw: string,
  sb: SupabaseClient
): Promise<ResolvedIngredient> {
  const normalized = normalizeForLookup(raw);

  if (!normalized) {
    return { raw, normalized: '', found: false };
  }

  // 1. alias tablosunda ara
  const { data: aliasRows } = await sb
    .from('ingredient_aliases')
    .select('ingredient_id, alias_name')
    .ilike('alias_name', normalized)
    .limit(1);

  if (aliasRows && aliasRows.length > 0) {
    const { data: master } = await sb
      .from('ingredients_master')
      .select('canonical_name, risk_level, function_tags')
      .eq('id', aliasRows[0].ingredient_id)
      .single();

    if (master) {
      return {
        raw,
        normalized,
        found: true,
        canonical_name: master.canonical_name,
        risk_level: master.risk_level,
        function_tags: master.function_tags ?? []
      };
    }
  }

  // 2. canonical_name ile direkt ara
  const { data: masterRows } = await sb
    .from('ingredients_master')
    .select('canonical_name, risk_level, function_tags')
    .ilike('canonical_name', normalized)
    .limit(1);

  if (masterRows && masterRows.length > 0) {
    return {
      raw,
      normalized,
      found: true,
      canonical_name: masterRows[0].canonical_name,
      risk_level: masterRows[0].risk_level,
      function_tags: masterRows[0].function_tags ?? []
    };
  }

  return { raw, normalized, found: false };
}
