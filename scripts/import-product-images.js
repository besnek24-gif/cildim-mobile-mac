#!/usr/bin/env node
/**
 * CiltBakımım — Ürün Görsel Toplu Import Scripti
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * KULLANIM:
 *   node scripts/import-product-images.js <json-dosyasi> [api-url]
 *
 * ÖRNEKLER:
 *   node scripts/import-product-images.js scripts/example-product-images.json
 *   node scripts/import-product-images.js urunler.json https://api.ciltbakim.com
 *   node scripts/import-product-images.js urunler.csv
 *
 * JSON FORMATI (düz dizi):
 *   [
 *     {
 *       "barcode": "3337875797597",
 *       "name": "La Roche-Posay Anthelios SPF50+",
 *       "brand": "La Roche-Posay",
 *       "image_url": "https://cdn.example.com/products/3337875797597.jpg",
 *       "thumbnail_url": "https://cdn.example.com/products/thumbs/3337875797597.jpg"
 *     }
 *   ]
 *
 * CSV FORMATI (ilk satır başlık):
 *   barcode,name,brand,image_url,thumbnail_url
 *
 * EŞLEŞTİRME SIRASI:
 *   1. Barkod (kesin eşleşme)
 *   2. Ürün adı normalize edilmiş tam eşleşme (barkod yoksa)
 *
 * RAPOR ÇIKTISI:
 *   - Eşleşen ve güncellenen ürün sayısı
 *   - Eşleşmeyen ürün listesi
 *   - Barkodu eksik kayıtlar
 *   - Başarısız kayıtlar
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ─── Storage config (opsiyonel; URL otomatik üretmek için) ─────────────────── //
let storageConfig = null;
try {
  storageConfig = require("../storage.config.js");
} catch (_) {}

// ─── Yapılandırma ─────────────────────────────────────────────────────────── //
const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:8000";
const IMPORT_ENDPOINT = "/api/v2/products/images/import";
const CATALOG_ENDPOINT = "/api/v2/products/liste?per_page=500&page=";
const BATCH_SIZE = 100;

// ─── Argümanlar ───────────────────────────────────────────────────────────── //
const [, , inputFile, apiUrl] = process.argv;
const API_URL = (apiUrl || DEFAULT_API_URL).replace(/\/$/, "");

if (!inputFile) {
  console.error("HATA: Dosya yolu belirtilmedi.");
  console.error("Kullanım: node scripts/import-product-images.js <dosya.json> [api-url]");
  process.exit(1);
}

const filePath = path.resolve(inputFile);
if (!fs.existsSync(filePath)) {
  console.error(`HATA: Dosya bulunamadı: ${filePath}`);
  process.exit(1);
}

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────── //

/** Ürün adını normalize eder: küçük harf, boşluk/özel karakter temizle */
function normalizeName(name = "") {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** CSV satırını virgülle böl (tırnaklı alanları düzgün işle) */
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = parseCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ""; });
      return obj;
    });
}

function readInputFile(fp) {
  const content = fs.readFileSync(fp, "utf-8");
  const ext = path.extname(fp).toLowerCase();
  if (ext === ".csv") return parseCsv(content);
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) return parsed;
  return parsed.images || [];
}

// ─── Katalog çekme (barcode + name lookup tabloları) ─────────────────────── //

async function fetchCatalog() {
  const barcodeMap = new Map(); // barcode → product_id
  const nameMap    = new Map(); // normalized_name → product_id
  let page = 1;
  let total = Infinity;
  let fetched = 0;

  process.stdout.write("  Ürün kataloğu indiriliyor");

  while (fetched < total) {
    const url = `${API_URL}${CATALOG_ENDPOINT}${page}`;
    let data;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      data = await res.json();
    } catch {
      break;
    }

    const products = data["ürünler"] || data.products || [];
    if (page === 1) total = data["toplam"] || data.total || products.length;
    if (products.length === 0) break;

    for (const p of products) {
      const id = p.id;
      if (!id) continue;
      if (p.barcode) barcodeMap.set(String(p.barcode).trim(), id);
      const nm = normalizeName(p.name || p.isim || "");
      if (nm) nameMap.set(nm, id);
    }

    fetched += products.length;
    page++;
    process.stdout.write(".");
    if (products.length < 50) break;
  }

  console.log(` ${barcodeMap.size} barkod, ${nameMap.size} isim eşleme yüklendi.`);
  return { barcodeMap, nameMap };
}

// ─── Eşleştirme ───────────────────────────────────────────────────────────── //

function matchEntries(rawEntries, barcodeMap, nameMap) {
  const matched       = [];   // { product_id, barcode, image_url, thumbnail_url, _source }
  const unmatched     = [];   // { entry, reason }
  const missingBarcode = [];  // sadece isim bazlı eşleşenler

  for (const entry of rawEntries) {
    const barcode = entry.barcode ? String(entry.barcode).trim() : "";
    const name    = entry.name || "";
    const imageUrl = entry.image_url || entry.imageUrl || "";
    const thumbUrl = entry.thumbnail_url || entry.thumbnailUrl || imageUrl;

    if (!imageUrl) {
      unmatched.push({ entry, reason: "image_url eksik" });
      continue;
    }

    // 1. Barkod eşleştir
    if (barcode && barcodeMap.has(barcode)) {
      matched.push({
        product_id   : barcodeMap.get(barcode),
        barcode,
        image_url    : imageUrl,
        thumbnail_url: thumbUrl,
        _source      : "barcode",
        _name        : name,
      });
      continue;
    }

    // Barkod yoktu ama ürün adı var — isim eşleştir
    if (barcode === "") missingBarcode.push(entry);

    if (name) {
      const normalized = normalizeName(name);
      if (nameMap.has(normalized)) {
        matched.push({
          product_id   : nameMap.get(normalized),
          barcode      : barcode || null,
          image_url    : imageUrl,
          thumbnail_url: thumbUrl,
          _source      : "name",
          _name        : name,
        });
        continue;
      }
    }

    // Hiçbiri eşleşmedi
    unmatched.push({
      entry,
      reason: barcode
        ? `Barkod bulunamadı: ${barcode}`
        : name
        ? `İsim bulunamadı: "${name}"`
        : "Barkod ve isim eksik",
    });
  }

  return { matched, unmatched, missingBarcode };
}

// ─── API'ye gönderme ──────────────────────────────────────────────────────── //

async function importBatch(images) {
  const payload = images.map(({ product_id, barcode, image_url, thumbnail_url }) => ({
    product_id, barcode, image_url, thumbnail_url,
  }));
  const res = await fetch(`${API_URL}${IMPORT_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: payload }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────── //

async function main() {
  const LINE = "═".repeat(54);
  const line = "─".repeat(54);

  console.log(`\n${LINE}`);
  console.log(" CiltBakımım — Ürün Görsel Toplu Import");
  console.log(LINE);
  console.log(` Dosya  : ${path.basename(filePath)}`);
  console.log(` API    : ${API_URL}`);
  if (storageConfig) {
    const info = storageConfig.getProviderInfo();
    console.log(` Storage: ${info.provider}${info.configured ? ` (${info.baseUrl})` : " (yapılandırılmadı)"}`);
  }
  console.log(LINE);

  // 1. Girdi dosyasını oku
  let rawEntries;
  try {
    rawEntries = readInputFile(filePath);
  } catch (err) {
    console.error(`\nDosya okuma hatası: ${err.message}`);
    process.exit(1);
  }
  console.log(`\n Girdi   : ${rawEntries.length} kayıt okundu`);

  // 2. Katalog indir
  console.log("\n Katalog indiriliyor...");
  const { barcodeMap, nameMap } = await fetchCatalog();

  // 3. Eşleştir
  const { matched, unmatched, missingBarcode } = matchEntries(rawEntries, barcodeMap, nameMap);

  console.log(`\n${line}`);
  console.log(" EŞLEŞTİRME SONUCU");
  console.log(line);
  console.log(` Eşleşen         : ${matched.length}`);
  console.log(`   → Barkod ile  : ${matched.filter((m) => m._source === "barcode").length}`);
  console.log(`   → İsim ile    : ${matched.filter((m) => m._source === "name").length}`);
  console.log(` Barkodu eksik   : ${missingBarcode.length}`);
  console.log(` Eşleşmeyen      : ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log(`\n EŞLEŞMEYEN KAYITLAR (${unmatched.length}):`);
    unmatched.forEach(({ entry, reason }, i) => {
      const label = entry.barcode
        ? `barkod=${entry.barcode}`
        : entry.name
        ? `isim="${entry.name}"`
        : `[${i}]`;
      console.log(`   ✗ ${label} — ${reason}`);
    });
  }

  if (matched.length === 0) {
    console.log("\n İçe aktarılacak eşleşme yok. İşlem sonlandı.");
    return;
  }

  // 4. API'ye gönder
  console.log(`\n${line}`);
  console.log(` API'YE GÖNDERİLİYOR (${matched.length} kayıt, ${BATCH_SIZE}'lik gruplar)`);
  console.log(line);

  let totalImported = 0;
  let totalSkipped  = 0;
  const failed      = [];

  for (let i = 0; i < matched.length; i += BATCH_SIZE) {
    const batch     = matched.slice(i, i + BATCH_SIZE);
    const batchNum  = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(matched.length / BATCH_SIZE);
    process.stdout.write(` Batch ${batchNum}/${totalBatches} (${batch.length} kayıt)... `);
    try {
      const result  = await importBatch(batch);
      totalImported += result.imported || 0;
      totalSkipped  += result.skipped  || 0;
      console.log(`✓ ${result.imported} import, ${result.skipped} atlandı`);
    } catch (err) {
      console.log(`✗ HATA: ${err.message}`);
      failed.push(...batch.map((b) => ({ product_id: b.product_id, error: err.message })));
    }
  }

  // 5. Özet rapor
  console.log(`\n${LINE}`);
  console.log(" ÖZET RAPOR");
  console.log(LINE);
  console.log(` Toplam giriş    : ${rawEntries.length}`);
  console.log(` Eşleşen         : ${matched.length}`);
  console.log(` İçe aktarılan   : ${totalImported}`);
  console.log(` Atlandı (dup)   : ${totalSkipped}`);
  console.log(` Eşleşmeyen      : ${unmatched.length}`);
  console.log(` Barkodu eksik   : ${missingBarcode.length}`);
  console.log(` API hatası      : ${failed.length}`);

  if (failed.length > 0) {
    console.log(`\n API HATALARI:`);
    failed.forEach((f) => console.log(`   ✗ ${f.product_id}: ${f.error}`));
  }

  // 6. Sonuç raporu dosyaya yaz
  const reportPath = path.join(
    path.dirname(filePath),
    `import-report-${new Date().toISOString().slice(0, 10)}.json`
  );
  const report = {
    date          : new Date().toISOString(),
    input_file    : filePath,
    total_input   : rawEntries.length,
    matched       : matched.length,
    imported      : totalImported,
    skipped       : totalSkipped,
    unmatched_count: unmatched.length,
    missing_barcode: missingBarcode.length,
    api_errors    : failed.length,
    unmatched_records: unmatched.map((u) => ({
      barcode : u.entry.barcode || null,
      name    : u.entry.name    || null,
      reason  : u.reason,
    })),
    failed_records: failed,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n Rapor kaydedildi: ${path.basename(reportPath)}`);
  console.log(`${LINE}\n`);
}

main().catch((err) => {
  console.error(`\nKritik hata: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
