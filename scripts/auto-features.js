#!/usr/bin/env node
/**
 * auto-features.js — Otomatik İçerik Özellik Tespiti
 * ─────────────────────────────────────────────────────────────────────────────
 * Ürünlerin ingredients alanını okur, kural tabanlı analiz ile
 * features JSON objesini otomatik oluşturur ve Supabase'e yazar.
 *
 * Kullanım:
 *   node scripts/auto-features.js             # tüm ürünleri güncelle
 *   node scripts/auto-features.js --dry-run   # yazmadan önce önizle
 *   node scripts/auto-features.js --id 42     # tek ürünü güncelle
 *
 * Gerekli .env değişkenleri:
 *   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<Supabase → Ayarlar → API → service_role>
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── .env yükleyici ────────────────────────────────────────────────────────────
function loadDotenv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

function resolveEnvFile() {
  const candidates = [
    join(__dir, "../.env"),
    join(__dir, "../../.env"),
    resolve(process.cwd(), ".env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

const envPath = resolveEnvFile();
if (envPath) {
  loadDotenv(envPath);
  console.log(`✔  .env yüklendi: ${envPath}`);
} else {
  console.warn("⚠  .env dosyası bulunamadı — mevcut ortam değişkenleri kullanılıyor.");
}

// ── CLI bayrakları ────────────────────────────────────────────────────────────
const DRY_RUN   = process.argv.includes("--dry-run");
const targetId  = (() => {
  const idx = process.argv.indexOf("--id");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

if (DRY_RUN)   console.log("🔍  DRY-RUN modu — veritabanına yazılmayacak.\n");
if (targetId)  console.log(`🎯  Tek ürün modu — id: ${targetId}\n`);

// ── Supabase bağlantısı ───────────────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "✘  Eksik ortam değişkeni.\n" +
    "   .env dosyasına ekleyin:\n" +
    "   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\n" +
    "   SUPABASE_SERVICE_ROLE_KEY=<service_role key>"
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "⚠  SUPABASE_SERVICE_ROLE_KEY bulunamadı — anon key ile devam.\n" +
    "   RLS aktifse UPDATE başarısız olabilir.\n"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── İçerik normalleştirici ────────────────────────────────────────────────────
/**
 * ingredients alanını düz metin dizisine çevirir.
 * Desteklenen formatlar: string, string[], JSON array string
 */
function normalizeIngredients(raw) {
  if (!raw) return [];

  // Dizi ise düzleştir
  if (Array.isArray(raw)) {
    return raw.map((i) => (typeof i === "string" ? i : JSON.stringify(i))).join(", ").toLowerCase();
  }

  // String ise olduğu gibi kullan
  if (typeof raw === "string") {
    // JSON array string mi? ["a","b",...] gibi
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.join(", ").toLowerCase();
        }
      } catch {
        // JSON parse başarısız — düz metin olarak devam
      }
    }
    return raw.toLowerCase();
  }

  return "";
}

// ── Kural motoru ──────────────────────────────────────────────────────────────
/**
 * İçerik metnini tarayarak features nesnesi üretir.
 * @param {string} ingredientsText - normalizeIngredients() çıktısı (lowercase)
 * @param {object|null} existingFeatures - Supabase'deki mevcut features
 */
function detectFeatures(ingredientsText, existingFeatures = null) {
  const t = ingredientsText; // zaten lowercase

  const paraben   = /paraben/.test(t);

  const sulfate   = /sulfate/.test(t)
    || /sodium laureth sulfate/.test(t)
    || /sodium lauryl sulfate/.test(t);

  const fragrance = /\bparfum\b/.test(t)
    || /\bfragrance\b/.test(t);

  const alcohol   = /alcohol denat/.test(t)
    || /denatured alcohol/.test(t)
    || /\bethanol\b/.test(t)
    || /\balcohol\b/.test(t);

  const silicone  = /dimethicone/.test(t)
    || /cyclopentasiloxane/.test(t)
    || /amodimethicone/.test(t)
    || /siloxane/.test(t)
    || /\w+cone\b/.test(t);

  // vegan: manuel onay korunur, yoksa false
  const veganExisting = existingFeatures?.vegan;
  const vegan = veganExisting === true ? true : false;

  return { vegan, paraben, sulfate, fragrance, alcohol, silicone };
}

// ── Fark kontrolü ─────────────────────────────────────────────────────────────
/**
 * Mevcut features ile yeni features arasında anlamlı fark var mı?
 * vegan değişmemesi dışında tüm alanlar karşılaştırılır.
 */
function hasDiff(existing, next) {
  const keys = ["paraben", "sulfate", "fragrance", "alcohol", "silicone", "vegan"];
  for (const k of keys) {
    if ((existing?.[k] ?? null) !== (next[k] ?? null)) return true;
  }
  return false;
}

// ── Özet etiketi ─────────────────────────────────────────────────────────────
function featuresLabel(f) {
  const flags = [];
  if (f.paraben)   flags.push("paraben");
  if (f.sulfate)   flags.push("sulfate");
  if (f.fragrance) flags.push("fragrance");
  if (f.alcohol)   flags.push("alcohol");
  if (f.silicone)  flags.push("silicone");
  if (f.vegan)     flags.push("vegan");
  return flags.length > 0 ? flags.join(", ") : "temiz";
}

// ── Ana işlem ────────────────────────────────────────────────────────────────
async function run() {
  console.log("─".repeat(60));
  console.log("  TENVİR — Otomatik Özellik Tespiti");
  console.log("─".repeat(60));

  // 1. Ürünleri çek
  let query = supabase
    .from("products")
    .select("id, name, ingredients, features");

  if (targetId) {
    query = query.eq("id", targetId);
  }

  const { data: products, error: fetchErr } = await query;

  if (fetchErr) {
    console.error("✘  Ürünler çekilemedi:", fetchErr.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log("ℹ  Hiç ürün bulunamadı.");
    return;
  }

  console.log(`\n📦  ${products.length} ürün çekildi.\n`);

  const stats = { total: products.length, skipped: 0, updated: 0, unchanged: 0, errors: 0 };
  const updatedList = [];

  for (const product of products) {
    const name = product.name ?? `#${product.id}`;

    // 2. İçerik kontrolü
    const ingredientsText = normalizeIngredients(product.ingredients);
    if (!ingredientsText.trim()) {
      console.log(`  ⊘  ${name} — içerik boş, atlandı`);
      stats.skipped++;
      continue;
    }

    // 3. Özellik tespiti
    const newFeatures = detectFeatures(ingredientsText, product.features);

    // 4. Değişim var mı?
    if (!hasDiff(product.features, newFeatures)) {
      console.log(`  ─  ${name} — değişiklik yok`);
      stats.unchanged++;
      continue;
    }

    // 5. Güncelle
    console.log(`  ✔  ${name}`);
    console.log(`       önceki : ${JSON.stringify(product.features ?? {})}`);
    console.log(`       yeni   : ${JSON.stringify(newFeatures)} [${featuresLabel(newFeatures)}]`);

    if (!DRY_RUN) {
      const { error: updateErr } = await supabase
        .from("products")
        .update({ features: newFeatures })
        .eq("id", product.id);

      if (updateErr) {
        console.error(`  ✘  HATA: ${name} — ${updateErr.message}`);
        stats.errors++;
        continue;
      }
    }

    updatedList.push(name);
    stats.updated++;
  }

  // 6. Özet
  console.log("\n" + "─".repeat(60));
  console.log("  ÖZET");
  console.log("─".repeat(60));
  console.log(`  Toplam    : ${stats.total}`);
  console.log(`  Güncellendi : ${stats.updated}${DRY_RUN ? " (dry-run — yazılmadı)" : ""}`);
  console.log(`  Değişmedi : ${stats.unchanged}`);
  console.log(`  İçerik yok: ${stats.skipped}`);
  if (stats.errors > 0) console.log(`  Hata      : ${stats.errors}`);
  if (updatedList.length > 0) {
    console.log("\n  Güncellenen ürünler:");
    updatedList.forEach((n) => console.log(`   • ${n}`));
  }
  console.log("─".repeat(60) + "\n");

  if (DRY_RUN) {
    console.log("ℹ  DRY-RUN tamamlandı. Gerçek güncelleme için --dry-run bayrağını kaldırın.\n");
  } else {
    console.log("✅  Tamamlandı.\n");
  }
}

run().catch((err) => {
  console.error("✘  Beklenmeyen hata:", err);
  process.exit(1);
});
