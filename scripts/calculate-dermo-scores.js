#!/usr/bin/env node
/**
 * Dermatolojik Güvenlik Puanı — Toplu Hesaplama
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase'deki tüm ürünlere dermo_score ve dermo_label hesaplayıp yazar.
 *
 * Kullanım:
 *   node scripts/calculate-dermo-scores.js           # Tüm ürünler
 *   node scripts/calculate-dermo-scores.js --missing  # Sadece puanı olmayanlar
 *   node scripts/calculate-dermo-scores.js --dry-run  # Test modu (DB'ye yazmaz)
 *
 * Gerekli .env değişkenleri:
 *   SUPABASE_SERVICE_ROLE_KEY=<Supabase → Ayarlar → API → service_role>
 *   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { calcDermoScoreForProduct } from "./dermo-score-engine.js";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── .env yükle ────────────────────────────────────────────────────────────────
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

const candidates = [
  join(__dir, "../.env"),
  join(__dir, "../../.env"),
  resolve(process.cwd(), ".env"),
];
for (const p of candidates) {
  if (existsSync(p)) { loadDotenv(p); break; }
}

const DRY_RUN   = process.argv.includes("--dry-run");
const MISSING   = process.argv.includes("--missing");
const BATCH     = 100; // Her seferinde kaç ürün çekilsin

if (DRY_RUN) console.log("🔍  DRY-RUN modu — veritabanına yazılmayacak.\n");
if (MISSING)  console.log("🔎  Sadece puansız ürünler hesaplanacak.\n");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "✘  Eksik ortam değişkeni.\n" +
    "   .env dosyasına şunları ekleyin:\n" +
    "   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\n" +
    "   SUPABASE_SERVICE_ROLE_KEY=<Supabase → Ayarlar → API → service_role>"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Ürünleri sayfa sayfa çek ──────────────────────────────────────────────────
async function fetchAllProducts() {
  const all = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("products")
      .select("id, name, barcode, ingredients, dermo_score")
      .range(from, from + BATCH - 1);

    if (MISSING) {
      query = query.is("dermo_score", null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Veri çekme hatası: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

// ── Ana işlem ─────────────────────────────────────────────────────────────────
console.log("🔗  Supabase'e bağlanılıyor...\n");

let products;
try {
  products = await fetchAllProducts();
} catch (err) {
  console.error(`✘  ${err.message}`);
  process.exit(1);
}

if (products.length === 0) {
  console.log("ℹ️  Hesaplanacak ürün bulunamadı.");
  process.exit(0);
}

console.log(`📦  ${products.length} ürün işlenecek.\n`);
console.log("─".repeat(64));

let scored    = 0;
let skipped   = 0;
let failed    = 0;
let noData    = 0;

for (let i = 0; i < products.length; i++) {
  const p = products[i];
  const label = `[${i + 1}/${products.length}]`;

  const result = calcDermoScoreForProduct(p);

  if (!result) {
    console.log(`  ${label} —  VERİ YOK     ${p.name ?? p.id} (içerik listesi boş)`);
    noData++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`  ${label} 🔍  ${result.total} ${result.label.padEnd(12)} ${p.name}`);
    console.log(`         ${result.analyzed}/${result.total_ingredients} içerik tanındı`);
    scored++;
    continue;
  }

  const { error } = await supabase
    .from("products")
    .update({ dermo_score: result.total, dermo_label: result.label })
    .eq("id", p.id);

  if (error) {
    console.warn(`  ${label} ✘  HATA  ${p.name} — ${error.message}`);
    failed++;
  } else {
    console.log(`  ${label} ✔  ${result.total} ${result.label.padEnd(12)} ${p.name}`);
    scored++;
  }
}

// ── Özet ──────────────────────────────────────────────────────────────────────
console.log("─".repeat(64));
console.log(`\n📊  ÖZET`);
console.log(`   ✔  Puanlanan      : ${scored}`);
console.log(`   —  İçerik Yok    : ${noData}`);
if (failed > 0) console.log(`   ✘  Hatalı        : ${failed}`);
if (DRY_RUN)   console.log(`\n🔍  DRY-RUN — hiçbir değişiklik kaydedilmedi.\n`);
else           console.log(`\n✅  Tamamlandı! Supabase products tablosu güncellendi.\n`);

process.exit(failed > 0 ? 1 : 0);
