#!/usr/bin/env node
/**
 * Supabase Product Bulk Import
 * ─────────────────────────────────────────────────────────────────────────────
 * Desteklenen formatlar: JSON ve CSV
 *
 * Kullanım:
 *   node scripts/supabase-import.js                        # product-import.json
 *   node scripts/supabase-import.js urunler.json           # JSON dosyası
 *   node scripts/supabase-import.js urunler.csv            # CSV dosyası
 *   node scripts/supabase-import.js urunler.json --dry-run       # test modu — DB'ye yazılmaz
 *   node scripts/supabase-import.js urunler.json --safe-import  # yalnızca tam kaliteli ürünler
 *
 * Deduplication (tekrar önleme):
 *   • barcode varsa  → barcode ile upsert (en hızlı)
 *   • barcode yoksa  → name + brand çifti ile kontrol (büyük/küçük harf duyarsız)
 *
 * Zorunlu alanlar: name, brand
 * barcode artık zorunlu DEĞİL — ama varsa deduplication daha güvenilir olur.
 *
 * Badge sistemi:
 *   • Supabase'deki badges[] alanı manuel girişi depolar
 *   • features[] string dizisi, endişeler, içerik vb. client-side badge engine
 *     tarafından okunur — DB'ye badge hesaplamak GEREKMEZ
 *   • --dry-run modunda hangi badgelerin türetileceği önizlenir
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));

function loadDotenv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
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

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const envPath = resolveEnvFile();
if (envPath) {
  loadDotenv(envPath);
  console.log(`✔  .env yüklendi: ${envPath}`);
} else {
  console.warn(
    "⚠  .env dosyası bulunamadı — mevcut ortam değişkenleri kullanılıyor.",
  );
}

const DRY_RUN = process.argv.includes("--dry-run");
const SAFE_IMPORT = process.argv.includes("--safe-import");

if (DRY_RUN) console.log("🔍  DRY-RUN modu — veritabanına yazılmayacak.\n");
if (SAFE_IMPORT)
  console.log(
    "🛡️  SAFE-IMPORT modu — yalnızca tam kaliteli ürünler yüklenir.\n",
  );

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "✘  Eksik ortam değişkeni.\n" +
      "   .env dosyasına şunları ekleyin:\n" +
      "   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\n" +
      "   SUPABASE_SERVICE_ROLE_KEY=<Supabase → Ayarlar → API → service_role>",
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "⚠  SUPABASE_SERVICE_ROLE_KEY bulunamadı — anon key ile devam ediliyor.\n" +
      "   Tabloda RLS varsa INSERT/UPDATE başarısız olabilir.\n",
  );
}

// ── Image ingestion (download → Supabase Storage → DB pointer update) ────────
// Idempotent: rows with storage_image_url already set are skipped.
// Upload errors NEVER fail the DB write — logged as warnings only.

const IMAGE_BUCKET = "product-images";
const IMAGE_EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

function extFromUrl(u) {
  try {
    const path = new URL(u).pathname.toLowerCase();
    const m = path.match(/\.(jpg|jpeg|png|webp)(?:$|[?#])/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

let imgUploaded = 0;
let imgSkipped = 0;
let imgFailed = 0;

async function ingestProductImage(productId, sourceUrl, label) {
  if (!productId || !sourceUrl) {
    imgSkipped++;
    return;
  }

  // Idempotency guard: re-check DB state in case storage_image_url was just written
  const { data: cur, error: curErr } = await supabase
    .from("products")
    .select("storage_image_url")
    .eq("id", productId)
    .maybeSingle();
  if (curErr) {
    console.warn(`         ⚠  görsel: DB okuma hatası — ${curErr.message}`);
    imgFailed++;
    return;
  }
  if (cur?.storage_image_url) {
    imgSkipped++;
    return;
  }

  // Download
  let resp;
  try {
    resp = await fetch(sourceUrl, { redirect: "follow" });
  } catch (e) {
    console.warn(`         ⚠  görsel: indirme hatası — ${e.message}`);
    imgFailed++;
    return;
  }
  if (!resp.ok) {
    console.warn(`         ⚠  görsel: HTTP ${resp.status} — ${sourceUrl}`);
    imgFailed++;
    return;
  }

  const mime = (resp.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  let ext = IMAGE_EXT_BY_MIME[mime] || extFromUrl(sourceUrl);
  if (!ext) ext = "jpg";
  if (ext === "jpeg") ext = "jpg";
  if (!ALLOWED_EXTS.has(ext)) {
    console.warn(`         ⚠  görsel: desteklenmeyen format (${mime || ext})`);
    imgFailed++;
    return;
  }

  let buf;
  try {
    buf = Buffer.from(await resp.arrayBuffer());
  } catch (e) {
    console.warn(`         ⚠  görsel: buffer hatası — ${e.message}`);
    imgFailed++;
    return;
  }
  if (!buf || buf.length === 0) {
    console.warn(`         ⚠  görsel: boş gövde`);
    imgFailed++;
    return;
  }

  const contentType =
    mime && Object.keys(IMAGE_EXT_BY_MIME).includes(mime)
      ? mime
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

  const storagePath = `products/${productId}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(storagePath, buf, { contentType, upsert: true });

  if (upErr) {
    console.warn(`         ⚠  görsel: yükleme hatası — ${upErr.message}`);
    imgFailed++;
    return;
  }

  const { data: pub } = supabase.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(storagePath);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) {
    console.warn(`         ⚠  görsel: public URL alınamadı`);
    imgFailed++;
    return;
  }

  const { error: ptrErr } = await supabase
    .from("products")
    .update({
      storage_image_path: storagePath,
      storage_image_url: publicUrl,
    })
    .eq("id", productId);

  if (ptrErr) {
    console.warn(`         ⚠  görsel: pointer güncelleme hatası — ${ptrErr.message}`);
    imgFailed++;
    return;
  }

  console.log(`         📷  görsel yüklendi → ${storagePath}`);
  imgUploaded++;
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^["']|["']$/g, ""));
  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => {
      const v = (values[i] ?? "").replace(/^["']|["']$/g, "").trim();
      if (v !== "") obj[h] = v;
    });
    return obj;
  });
}

// ── Load File (JSON or CSV) ───────────────────────────────────────────────────

const fileArg = process.argv.find(
  (a) => !a.startsWith("-") && (a.endsWith(".json") || a.endsWith(".csv")),
);
const filePath = fileArg
  ? resolve(process.cwd(), fileArg)
  : join(__dir, "product-import.json");

if (!existsSync(filePath)) {
  console.error(`✘  Dosya bulunamadı: ${filePath}`);
  process.exit(1);
}

const isCsv = filePath.endsWith(".csv");
let products;
try {
  const raw = readFileSync(filePath, "utf8");
  products = isCsv ? parseCsv(raw) : JSON.parse(raw);
} catch (err) {
  console.error(`✘  Dosya ayrıştırma hatası: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(products)) {
  console.error("✘  Dosya bir dizi (array) olmalı.");
  process.exit(1);
}

console.log(`📋  Format: ${isCsv ? "CSV" : "JSON"}`);
console.log(`\n📦  ${products.length} ürün okundu: ${filePath}\n`);

// ── Field definitions ─────────────────────────────────────────────────────────

const TEXT_FIELDS = [
  "name",
  "brand",
  "barcode",
  "category",
  "subcategory",
  "segment", // ürün segmenti: "ekonomik" | "orta" | "profesyonel" | "lüks"
  "short_description",
  "full_description",
  "ingredients",
  "usage_instructions",
  "warnings",
  "pregnancy_use",
  "breastfeeding_use",
  "allergy_info",
  "disclaimer",
  "age_group",
  "size",
  "form",
  "stock_status",
  "image_url",
  "thumbnail_url",
  "source_image_url",
  "storage_image_url",
  "storage_image_path",
];

const NUM_FIELDS = ["rating", "review_count"];

const BOOL_FIELDS = [
  "featured",
  "badges_manual", // true → mevcut badges[] korunur, güncelleme sırasında override edilmez
];

// JSONB / array alanlar — tümü dizi ya da nesne olarak geçilir
const JSONB_FIELDS = [
  "benefits",
  "skin_types",
  "tags",
  "badges", // manuel badge listesi (string[]) — boşsa engine devreye girer
  "features", // string[] — badge engine ve auto-features.js tarafından okunur
  "concerns", // string[] — badge engine input
  "active_ingredients", // string[] — badge engine input
  "editor_tags", // string[] — editör etiketleri, badge sisteminden bağımsız
];

// Zorunlu alanlar: name + brand + category + subcategory
const REQUIRED = ["name", "brand", "category", "subcategory"];

// ── Inline Badge Önizleyici (dry-run için) ────────────────────────────────────
//
// featureBadges.ts mantığını (TS→JS) düşük-bağımlılıkla burada tekrarlıyoruz.
// Bu kısım sadece --dry-run önizlemesi içindir; gerçek badge üretimi uygulama
// içinde (client-side) TypeScript engine tarafından yapılır.

// 26 standart feature key → kısa Türkçe rozet (öncelik sırasıyla)
const BADGE_KEYWORD_MAP = [
  // priority 1 — ana fayda
  { kw: ["high_protection"], badge: "Yüksek Koruma", grp: "sun" },
  {
    kw: ["anti_aging", "anti-aging", "anti aging"],
    badge: "Yaşlanma Karşıtı",
    grp: "antiage",
  },
  {
    kw: ["hair_loss_support", "anti_hair_loss"],
    badge: "Dökülme Karşıtı",
    grp: "hair",
  },

  // priority 2 — hedef cilt/ihtiyaç
  {
    kw: ["hydrating", "moisturizing", "deep_moisture"],
    badge: "Yoğun Nem",
    grp: "hydration",
  },
  {
    kw: ["oil_control", "shine_control", "sebum_control"],
    badge: "Yağ Kontrolü",
    grp: "oil",
  },
  {
    kw: ["spot_care", "dark_spot", "spot_correction"],
    badge: "Leke Bakımı",
    grp: "bright",
  },
  { kw: ["tone_evening"], badge: "Ten Eşitleme", grp: "bright" },
  { kw: ["brightening", "whitening"], badge: "Aydınlatıcı", grp: "bright" },
  {
    kw: ["barrier_support", "barrier_repair", "skin_barrier"],
    badge: "Bariyer Güçlendirici",
    grp: "barrier",
  },
  { kw: ["repair_care", "restorative"], badge: "Onarıcı Bakım", grp: "repair" },
  {
    kw: ["acne_prone_friendly", "anti_acne", "acne_prone"],
    badge: "Akne Dostu",
    grp: "acne",
  },
  {
    kw: ["sensitive_skin_friendly", "for_sensitive"],
    badge: "Hassas Cilt Dostu",
    grp: "sensitive",
  },
  { kw: ["redness_support"], badge: "Kızarıklık Karşıtı", grp: "sensitive" },
  { kw: ["soothing", "calming"], badge: "Yatıştırıcı", grp: "sensitive" },
  { kw: ["pore_care"], badge: "Gözenek Bakımı", grp: "pore" },
  { kw: ["gentle_cleanse"], badge: "Nazik Temizlik", grp: "cleanse" },
  { kw: ["deep_cleanse"], badge: "Derin Temizlik", grp: "cleanse" },
  { kw: ["baby_friendly"], badge: "Bebek Dostu", grp: "gentle" },

  // priority 3 — kullanım desteği
  {
    kw: ["strengthening", "fortifying"],
    badge: "Güçlendirici",
    grp: "strengthen",
  },
  { kw: ["matte_finish", "mattifying"], badge: "Mat Görünüm", grp: "finish" },
  {
    kw: ["non_comedogenic", "non comedogenic"],
    badge: "Gözenek Tıkamaz",
    grp: "pore",
  },
  {
    kw: ["water_resistant", "waterproof"],
    badge: "Su Geçirmez",
    grp: "function",
  },
  { kw: ["tinted_finish"], badge: "Renkli Formül", grp: "tint" },

  // priority 4 — temiz formül / doku
  {
    kw: ["fragrance_free", "fragrance-free", "no fragrance"],
    badge: "Parfümsüz",
    grp: "clean",
  },
  {
    kw: ["light_texture", "lightweight", "gel_texture", "non_greasy"],
    badge: "Hafif Doku",
    grp: "texture",
  },

  // priority 5 — genel kullanım
  { kw: ["daily_use"], badge: "Günlük Kullanım", grp: "usage" },

  // ── Geniş keyword'ler (ingredients, tags, description taraması için) ────────
  {
    kw: ["spf", "güneş", "uva", "uvb", "sunscreen", "sun_protection", "solar"],
    badge: "Yüksek Koruma",
    grp: "sun",
  },
  {
    kw: ["mineral", "zinc oxide", "titanium dioxide"],
    badge: "Mineral Filtre",
    grp: "filter",
  },
  {
    kw: ["seramid", "ceramide", "bariyer", "barrier"],
    badge: "Bariyer Güçlendirici",
    grp: "barrier",
  },
  {
    kw: ["niacinamide", "niasinamid", "gözenek"],
    badge: "Gözenek Bakımı",
    grp: "pore",
  },
  {
    kw: ["aha", "bha", "peeling", "salicylic", "glikolik"],
    badge: "Yenileyici Peeling",
    grp: "exfol",
  },
  {
    kw: ["leke", "hiperpig", "vitamin c", "askorbik"],
    badge: "Leke Bakımı",
    grp: "bright",
  },
  {
    kw: ["nemlendirici", "hyaluronik", "glycerin"],
    badge: "Yoğun Nem",
    grp: "hydration",
  },
  {
    kw: ["yaşlanma", "kırışık", "retinol", "peptid"],
    badge: "Yaşlanma Karşıtı",
    grp: "antiage",
  },
  {
    kw: ["hassas", "sensitive", "rosacea", "tahriş"],
    badge: "Hassas Cilt Dostu",
    grp: "sensitive",
  },
  { kw: ["akne", "sivilce", "acne"], badge: "Akne Dostu", grp: "acne" },
  { kw: ["parfümsüz", "kokusuz"], badge: "Parfümsüz", grp: "clean" },
  { kw: ["vegan"], badge: "Vegan", grp: "ethical" },
];

function previewBadges(row) {
  // Tüm kaynak metinleri birleştir
  const sources = [
    row.name ?? "",
    row.category ?? "",
    row.subcategory ?? "",
    row.short_description ?? "",
    row.ingredients ?? "",
    ...(Array.isArray(row.features) ? row.features : []),
    ...(Array.isArray(row.concerns) ? row.concerns : []),
    ...(Array.isArray(row.skin_types) ? row.skin_types : []),
    ...(Array.isArray(row.active_ingredients) ? row.active_ingredients : []),
    ...(Array.isArray(row.tags) ? row.tags : []),
  ]
    .join(" ")
    .toLowerCase();

  const seen = new Set();
  const badges = [];
  for (const { kw, badge, grp } of BADGE_KEYWORD_MAP) {
    if (badges.length >= 2) break;
    if (seen.has(grp)) continue;
    if (kw.some((k) => sources.includes(k))) {
      badges.push(badge);
      seen.add(grp);
    }
  }

  // Manuel badges varsa önce onları kullan
  if (Array.isArray(row.badges) && row.badges.length > 0) {
    return { source: "manuel", badges: row.badges.slice(0, 2) };
  }
  return { source: badges.length > 0 ? "engine" : "—", badges };
}

// ── Auto-enrichment pipeline ──────────────────────────────────────────────────
//
// Çalışma sırası:
//   1. features eksik/zayıfsa → category/name/description'dan çıkar
//   2. short_benefit yoksa    → features + category + description'dan üret
//   3. badges yoksa ve badges_manual=false → previewBadges engine devreye girer
//   4. editor_tags / badges_manual → zaten yukarıda güvenli varsayılan atandı

// ── İzin verilen 26 feature key (sabit sözlük) ───────────────────────────────
const VALID_FEATURE_KEYS = new Set([
  "high_protection",
  "light_texture",
  "daily_use",
  "oil_control",
  "matte_finish",
  "hydrating",
  "sensitive_skin_friendly",
  "spot_care",
  "brightening",
  "anti_aging",
  "barrier_support",
  "repair_care",
  "acne_prone_friendly",
  "fragrance_free",
  "hair_loss_support",
  "strengthening",
  "gentle_cleanse",
  "deep_cleanse",
  "tinted_finish",
  "pore_care",
  "soothing",
  "non_comedogenic",
  "water_resistant",
  "tone_evening",
  "redness_support",
  "baby_friendly",
]);

// ── Kategori adı → varsayılan feature seti (yalnızca VALID_FEATURE_KEYS) ──────
const CAT_FEATURE_MAP = {
  // Güneş
  "güneş koruyucu": ["high_protection", "light_texture", "daily_use"],
  "güneş kremi": ["high_protection", "daily_use"],
  güneş: ["high_protection", "daily_use"],
  sunscreen: ["high_protection", "daily_use"],
  spf: ["high_protection", "daily_use"],
  // Nemlendirici / krem
  nemlendirici: ["hydrating", "daily_use"],
  moisturizer: ["hydrating", "daily_use"],
  krem: ["hydrating", "daily_use"],
  losyon: ["hydrating", "daily_use"],
  // Serum
  serum: ["anti_aging", "barrier_support"],
  // Temizleyici
  temizleyici: ["gentle_cleanse", "daily_use"],
  cleanser: ["gentle_cleanse", "daily_use"],
  "yüz yıkama": ["gentle_cleanse", "daily_use"],
  "yüz temizleme": ["gentle_cleanse", "daily_use"],
  misel: ["gentle_cleanse", "sensitive_skin_friendly"],
  // Toner
  toner: ["barrier_support", "hydrating"],
  tonik: ["barrier_support", "hydrating"],
  // Göz
  "göz kremi": ["anti_aging", "hydrating"],
  "eye cream": ["anti_aging", "hydrating"],
  // Maske
  maske: ["deep_cleanse", "hydrating"],
  mask: ["deep_cleanse", "hydrating"],
  // Peeling / Eksfolyan
  peeling: ["brightening", "spot_care"],
  exfoliator: ["brightening", "pore_care"],
  eksfolyan: ["brightening", "spot_care"],
  scrub: ["deep_cleanse", "brightening"],
  // Saç
  şampuan: ["hair_loss_support", "daily_use"],
  shampoo: ["hair_loss_support", "daily_use"],
  "saç kremi": ["strengthening", "hydrating"],
  "saç serumu": ["hair_loss_support", "strengthening"],
  saç: ["hair_loss_support", "strengthening"],
  // Beden
  "vücut losyonu": ["hydrating", "daily_use"],
  "vücut kremi": ["hydrating", "daily_use"],
  vücut: ["hydrating", "daily_use"],
  // BB/CC
  "bb cream": ["tinted_finish", "hydrating", "daily_use"],
  "cc cream": ["tinted_finish", "tone_evening", "daily_use"],
};

// ── Metin içi keyword → feature (yalnızca VALID_FEATURE_KEYS) ────────────────
// Her kural deterministik: belirli kelime → belirli feature(lar).
// Sıra önemli: daha spesifik kurallar önce gelir.
const KW_FEATURE_MAP = [
  // Güneş koruma
  {
    kw: [
      "spf",
      "güneş koruyucu",
      "sunscreen",
      "uva",
      "uvb",
      "solar",
      "sun protect",
    ],
    feat: ["high_protection"],
  },
  // Hafif doku
  {
    kw: [
      "hafif doku",
      "light texture",
      "lightweight",
      "jel kıvam",
      "gel texture",
      "non-greasy",
      "yağlı hissettirmez",
    ],
    feat: ["light_texture"],
  },
  // Yağ kontrolü
  {
    kw: ["yağ kontrolü", "oil control", "sebum", "shine control", "yağlanma"],
    feat: ["oil_control"],
  },
  // Mat görünüm
  {
    kw: ["mat görünüm", "mat bitişi", "matte finish", "mattifying", "mat etki"],
    feat: ["matte_finish"],
  },
  // Nemlendirici
  {
    kw: [
      "hyaluron",
      "hyaluronic",
      "glycerin",
      "gliserin",
      "nemlendirici",
      "moistur",
      "nem sağl",
    ],
    feat: ["hydrating"],
  },
  // Hassas cilt
  {
    kw: [
      "hassas cilt",
      "sensitive skin",
      "for sensitive",
      "tahriş etmez",
      "hypoallerjenik",
    ],
    feat: ["sensitive_skin_friendly"],
  },
  // Leke
  {
    kw: [
      "leke",
      "dark spot",
      "hiperpigmentasyon",
      "spot correction",
      "spot care",
    ],
    feat: ["spot_care"],
  },
  // Ten eşitleme
  {
    kw: [
      "ten eşitleme",
      "ten rengi",
      "tone evening",
      "renk eşitleme",
      "pigmentasyon",
    ],
    feat: ["tone_evening"],
  },
  // Aydınlatıcı
  {
    kw: ["aydınlatıcı", "brightening", "vitamin c", "askorbik", "glow"],
    feat: ["brightening"],
  },
  // Yaşlanma karşıtı
  {
    kw: [
      "retinol",
      "peptid",
      "peptide",
      "kırışık",
      "yaşlanma karşıtı",
      "anti-aging",
      "anti aging",
      "fine line",
    ],
    feat: ["anti_aging"],
  },
  // Bariyer
  {
    kw: [
      "seramid",
      "ceramide",
      "bariyer güçlendirici",
      "skin barrier",
      "barrier support",
    ],
    feat: ["barrier_support"],
  },
  // Onarıcı
  {
    kw: ["onarıcı", "repair", "restorative", "yenileyici bakım", "resurfacing"],
    feat: ["repair_care"],
  },
  // Akne
  {
    kw: ["akne", "sivilce", "acne", "anti-acne", "blemish"],
    feat: ["acne_prone_friendly"],
  },
  // Parfümsüz
  {
    kw: ["parfümsüz", "fragrance-free", "koku yok", "kokusuz", "unscented"],
    feat: ["fragrance_free"],
  },
  // Saç dökülmesi
  {
    kw: ["saç dökülmesi", "hair loss", "dökülme karşıtı", "anti hair loss"],
    feat: ["hair_loss_support"],
  },
  // Güçlendirici
  {
    kw: ["güçlendirici", "strengthening", "fortifying", "keratin", "protein"],
    feat: ["strengthening"],
  },
  // Nazik temizlik
  {
    kw: [
      "nazik temizlik",
      "gentle cleanse",
      "gentle clean",
      "yumuşak temizlik",
    ],
    feat: ["gentle_cleanse"],
  },
  // Derin temizlik
  {
    kw: ["derin temizlik", "deep cleanse", "gözenek temizleme", "pore cleanse"],
    feat: ["deep_cleanse"],
  },
  // Renkli formül
  {
    kw: ["renkli formül", "tinted", "tint", "renkli nemlendirici", "bb", "cc"],
    feat: ["tinted_finish"],
  },
  // Gözenek bakımı
  {
    kw: [
      "niacinamide",
      "niasinamid",
      "gözenek",
      "pore minimiz",
      "gözenek sıkılaştır",
    ],
    feat: ["pore_care"],
  },
  // Yatıştırıcı
  {
    kw: [
      "yatıştırıcı",
      "soothing",
      "calming",
      "sakinleştirici",
      "aloe vera",
      "panthenol",
    ],
    feat: ["soothing"],
  },
  // Kızarıklık
  {
    kw: ["kızarıklık", "redness", "rozasea", "rosacea", "eritem"],
    feat: ["redness_support"],
  },
  // Gözenek tıkamaz
  {
    kw: [
      "gözenek tıkamaz",
      "non-comedogenic",
      "non comedogenic",
      "komedojenik değil",
    ],
    feat: ["non_comedogenic"],
  },
  // Su geçirmez
  {
    kw: ["su geçirmez", "waterproof", "water resistant", "suya dayanıklı"],
    feat: ["water_resistant"],
  },
  // Günlük kullanım
  {
    kw: ["günlük kullanım", "her gün", "daily use", "everyday"],
    feat: ["daily_use"],
  },
  // Bebek
  { kw: ["bebek", "baby", "çocuk", "0-3 yaş"], feat: ["baby_friendly"] },
];

// ── Feature key → kısa fayda cümlesi (tüm 26 key) ────────────────────────────
const FEATURE_BENEFIT = {
  high_protection: "Cildi UVA/UVB ışınlarına karşı etkili biçimde korur.",
  light_texture: "Hafif ve yağsız dokusu ile cilde rahatsızlık vermez.",
  daily_use: "Günlük cilt bakım rutinine kolayca eklenebilir.",
  oil_control: "Aşırı yağlanmayı kontrol eder, cildi dengede tutar.",
  matte_finish: "Mat bir görünüm sağlar ve parlamayı önler.",
  hydrating: "Cilde yoğun nem sağlar ve nem dengesini uzun süre korur.",
  sensitive_skin_friendly:
    "Hassas ciltlere nazik, tahriş etmeyen bir bakım sağlar.",
  spot_care: "Leke görünümünü azaltır ve ten rengini dengeler.",
  brightening: "Ten rengini eşitler ve cilde aydınlık görünüm kazandırır.",
  anti_aging: "Kırışıklık ve yaşlanma belirtilerini azaltmaya yardımcı olur.",
  barrier_support: "Cilt bariyerini güçlendirir ve dış etkenlere karşı korur.",
  repair_care: "Hasarlı cilt dokusunu onarır ve yeniler.",
  acne_prone_friendly:
    "Akne eğilimli ciltler için özel olarak formüle edilmiştir.",
  fragrance_free:
    "Parfümsüz formülü ile hassas ciltlere güvenle uygulanabilir.",
  hair_loss_support:
    "Saç dökülmesini azaltmaya yardımcı olur ve kökü güçlendirir.",
  strengthening: "Cilt veya saçı besler, direncini artırır ve güçlendirir.",
  gentle_cleanse: "Cildi tahriş etmeden nazikçe temizler.",
  deep_cleanse: "Gözeneklere derinlemesine nüfuz ederek yoğun temizlik yapar.",
  tinted_finish:
    "Hafif renkli formülü ile teni eşitler ve maskesiz doğal görünüm sağlar.",
  pore_care: "Gözenekleri sıkılaştırır ve cilt dokusunu düzenler.",
  soothing: "Cilt tahrişini yatıştırır ve rahatlama hissi sağlar.",
  non_comedogenic: "Gözenekleri tıkamayan formülü ile akne oluşumunu önler.",
  water_resistant: "Su geçirmez formülü sayesinde uzun süre koruma sağlar.",
  tone_evening:
    "Ten rengindeki eşitsizlikleri giderir ve homojen görünüm sağlar.",
  redness_support: "Kızarıklığı ve hassasiyeti azaltır, cildi sakinleştirir.",
  baby_friendly: "Bebek ve çocuk ciltlerine uygun nazik bir formüle sahiptir.",
};

// ── Kategori → varsayılan fayda cümlesi (features bulunamazsa) ───────────────
const CAT_BENEFIT = {
  "güneş koruyucu": "Cildi güneşin zararlı ışınlarından korur.",
  nemlendirici: "Cilde derin nem sağlar ve esnekliğini artırır.",
  serum: "Hedefe yönelik yoğunlaştırılmış aktif içerikler sunar.",
  temizleyici: "Cildi nazikçe temizler ve tazelenmiş hissettirir.",
  toner: "Cilt pH'ını dengeler ve sonraki bakım ürünlerini hazırlar.",
  "göz kremi": "Göz çevresini besler ve ince çizgileri azaltır.",
  maske: "Yoğunlaştırılmış bakım ile cildi arındırır ve besler.",
  peeling: "Ölü hücreleri arındırır ve cilde parlaklık kazandırır.",
  şampuan: "Saçı temizler ve kök sağlığını destekler.",
  vücut: "Vücut cildini nemlendirir ve esnekliğini korur.",
};

/**
 * features[] zayıf veya boşsa category/subcategory/name/description'dan çıkar.
 * Çıktı kesinlikle VALID_FEATURE_KEYS kümesinden gelir — dışarıdan geçersiz
 * key girilmişse süzülür. Mevcut geçerli features korunur.
 */
function inferFeatures(row) {
  // Mevcut features — yalnızca geçerli key'leri koru
  const existing = (Array.isArray(row.features) ? row.features : []).filter(
    (f) => VALID_FEATURE_KEYS.has(f),
  );

  if (existing.length >= 3) return existing; // zaten yeterli, inference gerek yok

  const haystack = [
    row.name ?? "",
    row.category ?? "",
    row.subcategory ?? "",
    row.short_description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const inferredSet = new Set(existing);

  // 1. Category → sabit feature seti (en uzun eşleşen kategori key'i kullan)
  const catKey = Object.keys(CAT_FEATURE_MAP)
    .filter((k) => haystack.includes(k))
    .sort((a, b) => b.length - a.length)[0]; // daha spesifik key önce
  if (catKey) {
    for (const f of CAT_FEATURE_MAP[catKey]) inferredSet.add(f);
  }

  // 2. Keyword taraması — her kural tüm metin üzerinde koşulur
  for (const { kw, feat } of KW_FEATURE_MAP) {
    if (kw.some((k) => haystack.includes(k))) {
      for (const f of feat) inferredSet.add(f);
    }
  }

  // Güvence: tüm çıktı kesinlikle VALID_FEATURE_KEYS içinde
  return [...inferredSet].filter((f) => VALID_FEATURE_KEYS.has(f));
}

/**
 * short_benefit yoksa features + category + description'dan bir cümle üretir.
 */
function generateShortBenefitText(row) {
  if (row.short_benefit && String(row.short_benefit).trim().length > 5) {
    return row.short_benefit; // zaten var, dokunma
  }

  // 1. İlk eşleşen feature'dan cümle al
  const features = Array.isArray(row.features) ? row.features : [];
  for (const feat of features) {
    const sentence = FEATURE_BENEFIT[feat];
    if (sentence) return sentence;
  }

  // 2. short_description'ın ilk cümlesi (≤ 15 kelime)
  const desc = (row.short_description ?? "").trim();
  if (desc.length > 10) {
    const firstSentence = desc.split(/[.!?]/)[0].trim();
    const words = firstSentence.split(/\s+/);
    if (words.length >= 3) {
      return (
        (words.length > 15
          ? words.slice(0, 15).join(" ") + "…"
          : firstSentence) + "."
      );
    }
  }

  // 3. Kategori bazlı sabit cümle
  const haystack =
    `${row.category ?? ""} ${row.subcategory ?? ""}`.toLowerCase();
  const catKey = Object.keys(CAT_BENEFIT).find((k) => haystack.includes(k));
  if (catKey) return CAT_BENEFIT[catKey];

  return null; // üretilemedi
}

/**
 * Ana enrichment fonksiyonu — row nesnesini in-place günceller.
 * Sadece eksik alanları doldurur; mevcut değerlere dokunmaz.
 */
function enrichProduct(row) {
  // 1. features: eksik/zayıfsa çıkar
  const enrichedFeatures = inferFeatures(row);
  if (enrichedFeatures.length > 0) row.features = enrichedFeatures;

  // 2. short_benefit: yoksa üret
  const benefit = generateShortBenefitText(row);
  if (benefit && !row.short_benefit) row.short_benefit = benefit;

  // 3. editor_tags & badges_manual: zaten yukarıda varsayılan atandı
  // 4. badges: badges_manual=true ise dokunma — engine zaten client-side çalışır
}

// ── Supabase client ───────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Pre-import Preview Report ─────────────────────────────────────────────────
//
// Veritabanına tek satır yazmadan önce toplu bir kalite raporu basar.
// Sadece geçersiz ürünler atlanır; diğerleri devam eder.

async function previewReport() {
  console.log("─".repeat(68));
  console.log("📋  ÖN İZLEME RAPORU\n");

  // 1. Bulk DB prefetch — mevcut kayıtları tek sorguda çek (insert vs update için)
  const existingBarcodes = new Set(); // Set<string>
  const existingNameBrand = new Set(); // Set<"lower_name|lower_brand">

  if (!DRY_RUN) {
    const { data: bcRows } = await supabase
      .from("products")
      .select("barcode")
      .not("barcode", "is", null);
    for (const r of bcRows ?? []) {
      if (r.barcode) existingBarcodes.add(String(r.barcode).trim());
    }

    const { data: nbRows } = await supabase
      .from("products")
      .select("name, brand");
    for (const r of nbRows ?? []) {
      if (r.name && r.brand) {
        existingNameBrand.add(
          `${r.name.trim().toLowerCase()}|${r.brand.trim().toLowerCase()}`,
        );
      }
    }
  }

  // 2. Her ürün için analiz — orijinal array'e dokunma
  let pValid = 0;
  let pInvalid = 0;
  let pInsert = 0;
  let pUpdate = 0;
  let pLowQuality = 0;

  const invalidList = [];
  const lowQualityList = [];

  for (const raw of products) {
    // ── Validation ───────────────────────────────────────────────────────────
    const missing = REQUIRED.filter((k) => !raw[k]);
    if (missing.length) {
      pInvalid++;
      invalidList.push({
        name: raw.name ?? "?",
        reasons: missing.map((k) => `eksik: ${k}`),
      });
      continue;
    }

    pValid++;

    // ── Enrichment simülasyonu (shallow copy — orijinal bozulmaz) ────────────
    const sim = { ...raw };
    if (!Array.isArray(sim.features)) sim.features = [];
    if (!Array.isArray(sim.editor_tags)) sim.editor_tags = [];
    if (sim.badges_manual === undefined) sim.badges_manual = false;
    enrichProduct(sim);

    // ── Kalite kontrol nedenleri ─────────────────────────────────────────────
    const lqReasons = [];
    if (!Array.isArray(sim.features) || sim.features.length === 0) {
      lqReasons.push("features çıkarılamadı");
    }
    if (!sim.short_benefit) {
      lqReasons.push("short_benefit oluşturulamadı");
    }
    if (!raw.image_url && !raw.gorsel_url) {
      lqReasons.push("image_url eksik");
    }
    if (lqReasons.length) {
      pLowQuality++;
      lowQualityList.push({
        name: raw.name,
        brand: raw.brand,
        reasons: lqReasons,
      });
    }

    // ── Insert vs Update (yalnızca gerçek import modunda) ────────────────────
    if (!DRY_RUN) {
      const byBarcode = raw.barcode
        ? existingBarcodes.has(String(raw.barcode).trim())
        : false;
      const byNameBrand = !raw.barcode
        ? existingNameBrand.has(
            `${raw.name.trim().toLowerCase()}|${raw.brand.trim().toLowerCase()}`,
          )
        : false;

      if (byBarcode || byNameBrand) pUpdate++;
      else pInsert++;
    }
  }

  // 3. Özet tablosu
  const ln = (label, val) => console.log(`   ${label.padEnd(30)}${val}`);

  ln("Toplam girdi:", products.length);
  ln("✔  Geçerli:", pValid);
  ln("✘  Geçersiz (atlanacak):", pInvalid);
  if (!DRY_RUN) {
    ln("→  Yeni eklenecek:", pInsert);
    ln("↺  Güncellenecek (duplikat):", pUpdate);
  }
  ln("⚠  Düşük kalite:", pLowQuality);

  // 4. Geçersiz ürün detayı
  if (invalidList.length) {
    console.log("\n  Geçersiz ürünler (atlanacak):");
    for (const e of invalidList) {
      console.log(`    ✘ ${e.name}  —  ${e.reasons.join(", ")}`);
    }
  }

  // 5. Düşük kalite ürün detayı
  if (lowQualityList.length) {
    console.log(
      "\n  Düşük kalite ürünler (yine de import edilir, low_quality etiketlenir):",
    );
    for (const e of lowQualityList) {
      console.log(`    ⚠ ${e.name} (${e.brand})  —  ${e.reasons.join(", ")}`);
    }
  }

  console.log();
}

await previewReport();

// ── Import loop ───────────────────────────────────────────────────────────────

let inserted = 0;
let updated = 0;
let invalid = 0;
let lowQuality = 0;
let skippedSafe = 0; // SAFE_IMPORT modunda atlanan düşük kalite ürünler
const errors = [];
const invalids = [];

console.log("─".repeat(68));

for (let i = 0; i < products.length; i++) {
  const raw = products[i];
  const label = `[${i + 1}/${products.length}]`;

  // ── Validation: zorunlu alan kontrolü ─────────────────────────────────────
  const missing = REQUIRED.filter((k) => !raw[k]);
  if (missing.length) {
    const reason = `Geçersiz ürün — zorunlu alan eksik: ${missing.join(", ")}`;
    console.warn(`  ${label} ✘  ${raw.name ?? "?"} — ${reason}`);
    invalids.push({ index: i, name: raw.name, reason });
    invalid++;
    continue;
  }

  // Row oluştur — sadece dolu alanları ekle
  const row = {};

  for (const k of TEXT_FIELDS) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== "") row[k] = String(v);
  }

  for (const k of NUM_FIELDS) {
    const v = raw[k];
    if (v !== undefined && v !== null && !Number.isNaN(Number(v)))
      row[k] = Number(v);
  }

  for (const k of BOOL_FIELDS) {
    if (raw[k] !== undefined && raw[k] !== null) row[k] = Boolean(raw[k]);
  }

  for (const k of JSONB_FIELDS) {
    const v = raw[k];
    if (Array.isArray(v) && v.length > 0) row[k] = v;
    else if (typeof v === "object" && v !== null && !Array.isArray(v))
      row[k] = v;
  }

  // ── Eksik alanlar için güvenli varsayılanlar ────────────────────────────────
  // badges_manual: JSON'da yoksa false; varsa Boolean() zaten BOOL_FIELDS döngüsünde işlendi
  if (row.badges_manual === undefined) row.badges_manual = false;
  // editor_tags: JSON'da yoksa boş dizi — alanı her zaman yaz (null'a düşmesin)
  if (!Array.isArray(row.editor_tags)) row.editor_tags = [];

  // ── Auto-enrichment: features + short_benefit + badges ──────────────────────
  // raw nesnesindeki orijinal değerleri de enrichment'a taşı (TEXT_FIELDS dışı kalabilirler)
  if (!row.short_benefit && raw.short_benefit)
    row.short_benefit = raw.short_benefit;
  enrichProduct(row);

  // ── Kalite kontrolü: features hâlâ boşsa low_quality işaretle ───────────────
  const hasFeatures = Array.isArray(row.features) && row.features.length > 0;
  const hasShortBenefit = Boolean(row.short_benefit);
  const hasImage = Boolean(row.image_url || raw.image_url || raw.gorsel_url);
  const isLowQuality = !hasFeatures || !hasShortBenefit || !hasImage;

  if (isLowQuality) {
    lowQuality++;
    if (!row.editor_tags.includes("low_quality")) {
      row.editor_tags = [...row.editor_tags, "low_quality"];
    }
  }

  // ── SAFE-IMPORT modu: düşük kalite ürünleri atla ─────────────────────────────
  if (SAFE_IMPORT && isLowQuality) {
    const reasons = [
      !hasFeatures && "features boş",
      !hasShortBenefit && "short_benefit yok",
      !hasImage && "image_url yok",
    ]
      .filter(Boolean)
      .join(", ");
    console.log(
      `  ${label} ⏭  ATLAND (low_quality)   ${row.name} (${row.brand})  —  ${reasons}`,
    );
    skippedSafe++;
    continue;
  }

  // Dermatolojik puan
  const dermoResult = calcDermoScoreForProduct(row);
  if (dermoResult) {
    row.dermo_score = dermoResult.total;
    row.dermo_label = dermoResult.label;
  }

  // Badge önizlemesi
  const badgePreview = previewBadges(raw);

  if (DRY_RUN) {
    const dermoInfo = dermoResult
      ? `dermo=${dermoResult.total} (${dermoResult.label})`
      : "dermo=— (içerik yok)";
    const barcodeInfo = row.barcode
      ? `barkod: ${row.barcode}`
      : "barkod: YOK — name+brand ile dedup";
    const badgeInfo =
      badgePreview.badges.length > 0
        ? `rozet[${badgePreview.source}]: ${badgePreview.badges.join(", ")}`
        : "rozet: —";

    const badgesManualInfo = row.badges_manual
      ? "badges_manual: true → mevcut badges korunur"
      : "badges_manual: false → engine badge üretir";
    const editorTagsInfo =
      row.editor_tags.length > 0
        ? `editor_tags: [${row.editor_tags.join(", ")}]`
        : "editor_tags: []";

    const enrichedBenefit = row.short_benefit
      ? `short_benefit: "${row.short_benefit.slice(0, 60)}${row.short_benefit.length > 60 ? "…" : ""}"`
      : "short_benefit: —";
    const enrichedFeatures =
      Array.isArray(row.features) && row.features.length > 0
        ? `features[${row.features.length}]: ${row.features.slice(0, 3).join(", ")}${row.features.length > 3 ? ", …" : ""}`
        : "features: — ⚠ LOW_QUALITY";
    const qualityFlag = !hasFeatures
      ? "  ⚠  DÜŞÜK KALİTE — features boş, low_quality etiketi eklendi"
      : "";

    console.log(`  ${label} 🔍  ${row.name} (${row.brand})`);
    console.log(`         ${barcodeInfo}`);
    console.log(`         Alan: ${Object.keys(row).length}  |  ${dermoInfo}`);
    console.log(`         ${badgeInfo}  |  ${badgesManualInfo}`);
    console.log(`         ${editorTagsInfo}`);
    console.log(`         ${enrichedBenefit}`);
    console.log(`         ${enrichedFeatures}${qualityFlag}`);
    continue;
  }

  // ── Deduplication: barcode varsa → barcode, yoksa → name+brand ──────────────
  let existing = null;
  if (row.barcode) {
    const { data, error: selErr } = await supabase
      .from("products")
      .select("id, storage_image_url, source_image_url")
      .eq("barcode", row.barcode)
      .maybeSingle();

    if (selErr) {
      const reason = `Barkod sorgu hatası: ${selErr.message}`;
      console.warn(`  ${label} ✘  ${row.name} — ${reason}`);
      errors.push({ index: i, name: row.name, reason });
      continue;
    }
    existing = data;
  } else {
    // name + brand (büyük/küçük harf duyarsız, normalize edilmiş)
    const { data, error: selErr } = await supabase
      .from("products")
      .select("id, storage_image_url, source_image_url")
      .ilike("name", row.name.trim())
      .ilike("brand", row.brand.trim())
      .maybeSingle();

    if (selErr) {
      const reason = `Name+brand sorgu hatası: ${selErr.message}`;
      console.warn(`  ${label} ✘  ${row.name} — ${reason}`);
      errors.push({ index: i, name: row.name, reason });
      continue;
    }
    existing = data;
  }

  if (existing) {
    // ── Duplikat bulundu → UPDATE ─────────────────────────────────────────────
    // badges_manual: true → mevcut badges[] DB'de korunur, import override etmez
    const updatePayload = { ...row };
    if (updatePayload.badges_manual === true) {
      delete updatePayload.badges;
    }

    const { error: updateErr } = await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", existing.id);

    if (updateErr) {
      const reason = `Güncelleme hatası: ${updateErr.message}`;
      console.warn(`  ${label} ✘  ${row.name} — ${reason}`);
      errors.push({ index: i, name: row.name, reason });
    } else {
      const badgeStr =
        badgePreview.badges.length > 0
          ? `  [rozet: ${badgePreview.badges.join(", ")}]`
          : "";
      const qFlag = !hasFeatures ? "  ⚠ low_quality" : "";
      console.log(
        `  ${label} ↺  GÜNCELLENDİ (duplikat)   ${row.name} (${row.brand})${badgeStr}${qFlag}`,
      );
      updated++;

      // ── Görsel ingestion (DB yazımından bağımsız, hata yutulur) ───────────
      try {
        if (!existing.storage_image_url) {
          const src =
            row.source_image_url ||
            existing.source_image_url ||
            row.image_url ||
            null;
          await ingestProductImage(existing.id, src, label);
        } else {
          imgSkipped++;
        }
      } catch (e) {
        console.warn(`         ⚠  görsel: beklenmeyen hata — ${e.message}`);
        imgFailed++;
      }
    }
  } else {
    // ── Yeni kayıt → INSERT ───────────────────────────────────────────────────
    const { data: insertData, error: insertErr } = await supabase
      .from("products")
      .upsert(row, { onConflict: "barcode, name, brand" })
      .select("id, storage_image_url, source_image_url")
      .single();

    if (insertErr) {
      const reason = `Ekleme hatası: ${insertErr.message}`;
      console.warn(`  ${label} ✘  ${row.name} — ${reason}`);
      errors.push({ index: i, name: row.name, reason });
    } else {
      const badgeStr =
        badgePreview.badges.length > 0
          ? `  [rozet: ${badgePreview.badges.join(", ")}]`
          : "";
      const qFlag = !hasFeatures ? "  ⚠ low_quality" : "";
      console.log(
        `  ${label} ✔  EKLENDİ       ${row.name} (${row.brand})${badgeStr}${qFlag}`,
      );
      inserted++;

      // ── Görsel ingestion (DB yazımından bağımsız, hata yutulur) ───────────
      try {
        const newId = insertData?.id;
        if (newId && !insertData?.storage_image_url) {
          const src =
            row.source_image_url ||
            insertData?.source_image_url ||
            row.image_url ||
            null;
          await ingestProductImage(newId, src, label);
        } else {
          imgSkipped++;
        }
      } catch (e) {
        console.warn(`         ⚠  görsel: beklenmeyen hata — ${e.message}`);
        imgFailed++;
      }
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("─".repeat(68));
if (DRY_RUN) {
  console.log(
    `\n🔍  DRY-RUN tamamlandı — ${products.length} ürün okundu, hiçbiri yazılmadı.`,
  );
  console.log(`   ✘  Geçersiz (atlandı) : ${invalid}`);
  console.log(`   ⚠  Düşük Kalite        : ${lowQuality}\n`);
} else if (SAFE_IMPORT) {
  console.log(`\n🛡️  SAFE-IMPORT ÖZET`);
  console.log(`   ✔  Eklendi             : ${inserted}`);
  console.log(`   ↺  Güncellendi (dup)   : ${updated}`);
  console.log(`   ✘  Geçersiz (atlandı)  : ${invalid}`);
  console.log(`   ⏭  Düşük kal. (atlandı): ${skippedSafe}`);
  console.log(`   ─  Toplam girdi        : ${products.length}\n`);
} else {
  console.log(`\n📊  ÖZET`);
  console.log(`   ✔  Eklendi             : ${inserted}`);
  console.log(`   ↺  Güncellendi (dup)   : ${updated}`);
  console.log(`   ✘  Geçersiz ürün       : ${invalid}`);
  console.log(`   ⚠  Düşük Kalite        : ${lowQuality}`);
  console.log(`   ─  Toplam girdi        : ${products.length}`);
  console.log(`   📷  Görsel yüklendi    : ${imgUploaded}`);
  console.log(`   ⏭  Görsel atlandı     : ${imgSkipped}`);
  console.log(`   ⚠  Görsel hatası      : ${imgFailed}\n`);
}

if (invalids.length > 0) {
  console.log("Geçersiz ürünler (atlandı):");
  for (const e of invalids) {
    console.log(`  • [${e.index}] ${e.name ?? "?"} — ${e.reason}`);
  }
  console.log();
}

if (errors.length > 0) {
  console.log("DB hataları:");
  for (const e of errors) {
    console.log(`  • [${e.index}] ${e.name ?? "?"} — ${e.reason}`);
  }
  console.log();
}

process.exit(invalid > 0 || errors.length > 0 ? 1 : 0);
