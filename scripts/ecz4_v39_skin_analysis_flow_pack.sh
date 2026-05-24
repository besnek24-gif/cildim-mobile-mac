#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_skin_analysis_flow_pack_v39_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v39 local_demo_data

cp app/index.tsx "backups/ecz4_v39/index_before_v39_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v39/layout_before_v39_$STAMP.tsx"
cp local_demo_data/products_v37.ts "backups/ecz4_v39/products_v37_before_v39_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/decision_v38.ts "backups/ecz4_v39/decision_v38_before_v39_$STAMP.ts" 2>/dev/null || true

cat > local_demo_data/analysis_v39.ts <<'TS'
import { type Concern, type LocalProduct } from "./products_v37";
import { getBestProductsForConcern, getRoutineBlocksV38 } from "./decision_v38";

export type SkinFeel = "Kuru" | "Hassas" | "Parlama" | "Donuk";
export type RoutineLevel = "Sade" | "Dengeli" | "Geniş";

export type AnalysisResultV39 = {
  title: string;
  summary: string;
  priorities: string[];
  products: LocalProduct[];
  routineTitle: string;
  routineLines: string[];
};

export const SKIN_FEELS: SkinFeel[] = ["Kuru", "Hassas", "Parlama", "Donuk"];
export const ROUTINE_LEVELS: RoutineLevel[] = ["Sade", "Dengeli", "Geniş"];

export function buildAnalysisResultV39(params: {
  concern: Concern;
  feel: SkinFeel;
  level: RoutineLevel;
}): AnalysisResultV39 {
  const products = getBestProductsForConcern(params.concern).slice(0, params.level === "Sade" ? 3 : params.level === "Dengeli" ? 4 : 5);
  const routine = getRoutineBlocksV38(params.concern);

  const title = `${params.concern} odaklı demo analiz`;
  const summary = getSummary(params.concern, params.feel, params.level);
  const priorities = getPriorities(params.concern, params.feel, params.level);
  const routineLines = routine.flatMap((block) =>
    block.products.slice(0, params.level === "Sade" ? 2 : 3).map((product) => `${block.title}: ${product.routineStep} — ${product.name}`),
  );

  return {
    title,
    summary,
    priorities,
    products,
    routineTitle: `${params.level} bakım planı`,
    routineLines,
  };
}

function getSummary(concern: Concern, feel: SkinFeel, level: RoutineLevel) {
  if (concern === "Kuruluk") {
    return `${feel} hissiyle birlikte kuruluk öne çıkıyor. ${level} akışta bariyer ve nem dili sade kurulmalı.`;
  }

  if (concern === "Hassasiyet") {
    return `${feel} hissi hassasiyet anlatımını güçlendiriyor. Önce kısa, sakin ve anlaşılır bakım dili seçilmeli.`;
  }

  if (concern === "Leke") {
    return `${feel} görünümde leke odağı varsa gündüz koruma adımı merkezde tutulmalı.`;
  }

  return `${feel} hissiyle birlikte akne eğilimi okunuyorsa temizlik, hafif nem ve denge odağı birlikte kurulmalı.`;
}

function getPriorities(concern: Concern, feel: SkinFeel, level: RoutineLevel) {
  const base = [`Ana endişe: ${concern}`, `Cilt hissi: ${feel}`, `Rutin seviyesi: ${level}`];

  if (concern === "Kuruluk") return [...base, "Bariyer desteği", "Akşam konforu"];
  if (concern === "Hassasiyet") return [...base, "Sade içerik dili", "Kısa rutin"];
  if (concern === "Leke") return [...base, "Gündüz koruma", "Düzenli kullanım"];
  return [...base, "Nazik temizlik", "Hafif nem"];
}
TS

cat > app/index.tsx <<'TSX'
import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import {
  CONCERNS,
  LOCAL_PRODUCTS,
  PRODUCT_CATEGORIES,
  type Concern,
  type ProductCategory,
  type LocalProduct,
  filterProducts,
  getProductById,
} from "../local_demo_data/products_v37";
import {
  buildAnalysisText,
  compareProductsV38,
  getRoutineBlocksV38,
  getBestProductsForConcern,
} from "../local_demo_data/decision_v38";
import {
  ROUTINE_LEVELS,
  SKIN_FEELS,
  type RoutineLevel,
  type SkinFeel,
  buildAnalysisResultV39,
} from "../local_demo_data/analysis_v39";

type ScreenKey = "home" | "products" | "routine" | "analysis" | "compare" | "profile";

export default function Index() {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Tümü" | ProductCategory>("Tümü");
  const [concern, setConcern] = useState<Concern>("Kuruluk");
  const [skinFeel, setSkinFeel] = useState<SkinFeel>("Kuru");
  const [routineLevel, setRoutineLevel] = useState<RoutineLevel>("Dengeli");
  const [selectedProductId, setSelectedProductId] = useState(LOCAL_PRODUCTS[0].id);
  const [compareLeft, setCompareLeft] = useState(LOCAL_PRODUCTS[0].id);
  const [compareRight, setCompareRight] = useState(LOCAL_PRODUCTS[1].id);

  const filteredProducts = useMemo(
    () => filterProducts({ query, category, concern }),
    [query, category, concern],
  );

  const selectedProduct = getProductById(selectedProductId);
  const leftProduct = getProductById(compareLeft);
  const rightProduct = getProductById(compareRight);
  const routineBlocks = useMemo(() => getRoutineBlocksV38(concern), [concern]);
  const decision = compareProductsV38(leftProduct, rightProduct);
  const bestProducts = getBestProductsForConcern(concern);
  const analysis = useMemo(
    () => buildAnalysisResultV39({ concern, feel: skinFeel, level: routineLevel }),
    [concern, skinFeel, routineLevel],
  );

  const go = (target: ScreenKey) => setScreen(target);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Text style={styles.logo}>C</Text>
          </View>

          <Text style={styles.title}>Cildim</Text>
          <Text style={styles.subtitle}>Analiz akışı paketi</Text>
          <Text style={styles.note}>
            Analiz, ürün, rutin ve karar alanları yerel motorla birlikte çalışıyor.
          </Text>

          <View style={styles.markerBox}>
            <Text style={styles.marker}>ECZ4_SKIN_ANALYSIS_FLOW_PACK_V39</Text>
          </View>
        </View>

        <View style={styles.bottomNav}>
          <NavButton label="Ana" active={screen === "home"} onPress={() => go("home")} />
          <NavButton label="Ürün" active={screen === "products"} onPress={() => go("products")} />
          <NavButton label="Rutin" active={screen === "routine"} onPress={() => go("routine")} />
          <NavButton label="Analiz" active={screen === "analysis"} onPress={() => go("analysis")} />
          <NavButton label="Profil" active={screen === "profile"} onPress={() => go("profile")} />
        </View>

        {screen === "home" && (
          <>
            <Text style={styles.sectionTitle}>Bugünkü özet</Text>

            <View style={styles.statusGrid}>
              <StatusCard value={String(LOCAL_PRODUCTS.length)} label="Yerel ürün" />
              <StatusCard value={String(CONCERNS.length)} label="Endişe" />
              <StatusCard value="V39" label="Analiz akışı" />
            </View>

            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>V39 durumu</Text>
              <Text style={styles.highlightTitle}>Analiz artık ürün ve rutine bağlanıyor.</Text>
              <Text style={styles.highlightText}>
                Seçilen endişe, cilt hissi ve rutin seviyesi; analiz sonucunu, ürünleri ve bakım planını etkiler.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Hızlı giriş</Text>

            <View style={styles.grid}>
              <ModuleCard title="Cilt Analizi" text="Endişe, his ve rutin seviyesiyle demo analiz." onPress={() => go("analysis")} />
              <ModuleCard title="Ürün Önerileri" text="Analiz seçimine göre ürün listesi." onPress={() => go("products")} />
              <ModuleCard title="Rutinim" text="Seçilen endişeye göre ürünlü rutin." onPress={() => go("routine")} />
              <ModuleCard title="Karar Rehberi" text="Ürünleri skor, segment ve kategoriyle kıyasla." onPress={() => go("compare")} />
              <ModuleCard title="Profil" text="Misafir ve üyelik hazırlık alanı." onPress={() => go("profile")} />
            </View>
          </>
        )}

        {screen === "analysis" && (
          <View style={styles.detailCard}>
            <Header title="Cilt Analizi" badge="V39" />
            <Text style={styles.detailSubtitle}>
              Bu akış gerçek ölçüm almadan analiz ekranı, sonuç dili ve yönlendirme davranışını test eder.
            </Text>

            <Text style={styles.smallLabel}>Ana endişe</Text>
            <View style={styles.chipRow}>
              {CONCERNS.map((item) => (
                <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
              ))}
            </View>

            <Text style={styles.smallLabel}>Cilt hissi</Text>
            <View style={styles.chipRow}>
              {SKIN_FEELS.map((item) => (
                <Chip key={item} label={item} active={skinFeel === item} onPress={() => setSkinFeel(item)} />
              ))}
            </View>

            <Text style={styles.smallLabel}>Rutin seviyesi</Text>
            <View style={styles.chipRow}>
              {ROUTINE_LEVELS.map((item) => (
                <Chip key={item} label={item} active={routineLevel === item} onPress={() => setRoutineLevel(item)} />
              ))}
            </View>

            <View style={styles.analysisResultBox}>
              <Text style={styles.resultTitle}>{analysis.title}</Text>
              <Text style={styles.resultSummary}>{analysis.summary}</Text>
            </View>

            <View style={styles.analysisBox}>
              <Metric label="Uygun ürün" value={String(analysis.products.length)} />
              <Metric label="İlk öneri" value={analysis.products[0]?.name ?? "-"} />
              <Metric label="En yüksek skor" value={String(analysis.products[0]?.score ?? "-")} />
              <Metric label="Plan" value={analysis.routineTitle} />
            </View>

            <Text style={styles.smallLabel}>Öncelikler</Text>
            <View style={styles.priorityBox}>
              {analysis.priorities.map((item) => (
                <Text key={item} style={styles.priorityText}>• {item}</Text>
              ))}
            </View>

            <Text style={styles.smallLabel}>Önerilen ürünler</Text>
            <View style={styles.productList}>
              {analysis.products.slice(0, 3).map((product) => (
                <LocalProductTile
                  key={product.id}
                  product={product}
                  selected={product.id === selectedProductId}
                  onPress={() => {
                    setSelectedProductId(product.id);
                    go("products");
                  }}
                />
              ))}
            </View>

            <Text style={styles.smallLabel}>Önerilen rutin</Text>
            <View style={styles.priorityBox}>
              {analysis.routineLines.slice(0, 5).map((line) => (
                <Text key={line} style={styles.priorityText}>• {line}</Text>
              ))}
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.primaryButton} onPress={() => go("products")}>
                <Text style={styles.primaryButtonText}>Ürünleri gör</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => go("routine")}>
                <Text style={styles.secondaryButtonText}>Rutini gör</Text>
              </Pressable>
            </View>
          </View>
        )}

        {screen === "products" && (
          <View style={styles.detailCard}>
            <Header title="Ürün Önerileri" badge="V39" />
            <Text style={styles.detailSubtitle}>
              Ürün listesi analiz seçimi, endişe, kategori ve arama metnine göre şekillenir.
            </Text>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ürün, marka veya endişe ara"
              placeholderTextColor="#8C9489"
              style={styles.searchInput}
            />

            <Text style={styles.smallLabel}>Endişe</Text>
            <View style={styles.chipRow}>
              {CONCERNS.map((item) => (
                <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
              ))}
            </View>

            <Text style={styles.smallLabel}>Kategori</Text>
            <View style={styles.chipRow}>
              {PRODUCT_CATEGORIES.map((item) => (
                <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />
              ))}
            </View>

            <Text style={styles.resultText}>{filteredProducts.length} ürün listeleniyor</Text>

            <View style={styles.productList}>
              {filteredProducts.map((product) => (
                <LocalProductTile
                  key={product.id}
                  product={product}
                  selected={product.id === selectedProductId}
                  onPress={() => setSelectedProductId(product.id)}
                />
              ))}
            </View>

            <InfoBox title={selectedProduct.name} text={`${selectedProduct.detail} ${selectedProduct.usage}`} />
          </View>
        )}

        {screen === "routine" && (
          <View style={styles.detailCard}>
            <Header title="Rutinim" badge="V39" />
            <Text style={styles.detailSubtitle}>Rutin seçilen analiz endişesine göre ürünlü bloklar halinde kurulur.</Text>

            <View style={styles.chipRow}>
              {CONCERNS.map((item) => (
                <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
              ))}
            </View>

            {routineBlocks.map((block) => (
              <View key={block.title} style={styles.routineBlock}>
                <Text style={styles.routineTime}>{block.title}</Text>
                <Text style={styles.routinePurpose}>{block.purpose}</Text>

                {block.products.map((product, index) => (
                  <View key={`${block.title}-${product.id}`} style={styles.stepRow}>
                    <View style={styles.stepDot}>
                      <Text style={styles.stepDotText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stepTextBox}>
                      <Text style={styles.stepText}>{product.routineStep}: {product.name}</Text>
                      <Text style={styles.stepMiniText}>{product.shortBenefit}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <InfoBox title="Rutin notu" text={`${concern} odağında rutin önce sade anlatılır, sonra ürün detayı açılır.`} />
          </View>
        )}

        {screen === "compare" && (
          <View style={styles.detailCard}>
            <Header title="Karar Rehberi" badge="V39" />
            <Text style={styles.detailSubtitle}>Karar rehberi skor, kategori, segment ve fayda metnini birlikte okur.</Text>

            <Text style={styles.smallLabel}>Sol ürün</Text>
            <View style={styles.chipRow}>
              {LOCAL_PRODUCTS.slice(0, 8).map((item) => (
                <Chip
                  key={`left-${item.id}`}
                  label={item.name.split(" ")[0]}
                  active={compareLeft === item.id}
                  onPress={() => setCompareLeft(item.id)}
                />
              ))}
            </View>

            <Text style={styles.smallLabel}>Sağ ürün</Text>
            <View style={styles.chipRow}>
              {LOCAL_PRODUCTS.slice(0, 8).map((item) => (
                <Chip
                  key={`right-${item.id}`}
                  label={item.name.split(" ")[0]}
                  active={compareRight === item.id}
                  onPress={() => setCompareRight(item.id)}
                />
              ))}
            </View>

            <View style={styles.compareBox}>
              <CompareColumn product={leftProduct} />
              <View style={styles.compareDivider}>
                <Text style={styles.compareVs}>VS</Text>
              </View>
              <CompareColumn product={rightProduct} />
            </View>

            <View style={styles.decisionBox}>
              <Text style={styles.decisionTitle}>Karar cümlesi</Text>
              <Text style={styles.decisionText}>{decision.sentence}</Text>
              {decision.reasons.map((reason) => (
                <Text key={reason} style={styles.reasonText}>• {reason}</Text>
              ))}
            </View>
          </View>
        )}

        {screen === "profile" && (
          <View style={styles.detailCard}>
            <Header title="Profil" badge="Misafir" />
            <Text style={styles.detailSubtitle}>Kişisel alan bu aşamada güvenli misafir görünümündedir.</Text>

            <View style={styles.profileBox}>
              <ProfileLine label="Durum" value="Misafir görünümü" />
              <ProfileLine label="Ürün motoru" value="Yerel demo" />
              <ProfileLine label="Analiz akışı" value="Aktif demo" />
              <ProfileLine label="Karar rehberi" value="Aktif demo" />
            </View>

            <View style={styles.membershipCard}>
              <Text style={styles.membershipTitle}>Seçkin üyelik hazırlığı</Text>
              <Text style={styles.membershipText}>
                Gelişmiş analiz, ayrıntılı ürün açıklamaları ve rutin takibi sonraki paketlerde bağlanacak.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Güvenli ilerleme</Text>
          <Text style={styles.footerText}>
            Bu sürüm gerçek veri, görsel alma, giriş ve eski ağır bileşenleri içermez. Analiz akışı yerel ve izoledir.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.navButton, active && styles.navButtonActive]} onPress={onPress}>
      <Text style={[styles.navButtonText, active && styles.navButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ModuleCard({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <Pressable style={styles.moduleCard} onPress={onPress}>
      <Text style={styles.moduleTitle}>{title}</Text>
      <Text style={styles.moduleSubtitle}>{text}</Text>
      <Text style={styles.openText}>Aç</Text>
    </Pressable>
  );
}

function StatusCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

function Header({ title, badge }: { title: string; badge: string }) {
  return (
    <View style={styles.moduleTop}>
      <Text style={styles.detailTitle}>{title}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LocalProductTile({ product, selected, onPress }: { product: LocalProduct; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.productCard, selected && styles.productCardActive]} onPress={onPress}>
      <View style={styles.productTop}>
        <View style={styles.productNameBox}>
          <Text style={styles.productBrand}>{product.brand}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productTag}>{product.category} • {product.routineStep}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>{product.score}</Text>
        </View>
      </View>

      <Text style={styles.productNote}>{product.shortBenefit}</Text>

      <View style={styles.productBottom}>
        <View style={styles.segmentPill}>
          <Text style={styles.segmentText}>{product.segment}</Text>
        </View>
        <Text style={styles.productHint}>{selected ? "Seçildi" : "Detay için dokun"}</Text>
      </View>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InfoBox({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function CompareColumn({ product }: { product: LocalProduct }) {
  return (
    <View style={styles.compareCol}>
      <Text style={styles.compareTitle}>{product.name}</Text>
      <Text style={styles.compareText}>{product.shortBenefit}</Text>
      <Text style={styles.compareScore}>Skor {product.score} • {product.segment} • {product.category}</Text>
    </View>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileLineRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#E8ECE4" },
  content: { padding: 22, paddingTop: 54, paddingBottom: 36 },
  hero: {
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    padding: 26,
    alignItems: "center",
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  logoBox: { width: 70, height: 70, borderRadius: 24, backgroundColor: "#6B7A6A", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logo: { color: "#FFF8EF", fontSize: 34, fontWeight: "900" },
  title: { fontSize: 34, fontWeight: "900", color: "#26342A", textAlign: "center" },
  subtitle: { fontSize: 18, fontWeight: "800", color: "#B07A3A", marginTop: 6, textAlign: "center" },
  note: { fontSize: 15, lineHeight: 23, textAlign: "center", color: "#6F746C", marginTop: 16 },
  markerBox: { marginTop: 18, borderRadius: 999, backgroundColor: "#2F3A31", paddingVertical: 10, paddingHorizontal: 16 },
  marker: { color: "#B8C0B7", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  bottomNav: { flexDirection: "row", gap: 7, marginBottom: 18, flexWrap: "wrap" },
  navButton: { borderRadius: 999, backgroundColor: "#FFFFFF", paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(107,122,106,0.15)" },
  navButtonActive: { backgroundColor: "#2F3A31" },
  navButtonText: { fontSize: 12, fontWeight: "900", color: "#516052" },
  navButtonTextActive: { color: "#FFFFFF" },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#26342A", marginBottom: 12, marginLeft: 4 },
  statusGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statusCard: { flex: 1, borderRadius: 20, backgroundColor: "#FFFFFF", padding: 14, alignItems: "center" },
  statusValue: { fontSize: 19, fontWeight: "900", color: "#26342A" },
  statusLabel: { marginTop: 4, fontSize: 11, fontWeight: "800", color: "#6F746C", textAlign: "center" },
  highlightCard: { borderRadius: 24, backgroundColor: "#2F3A31", padding: 18, marginBottom: 22 },
  highlightLabel: { color: "#B8C0B7", fontSize: 12, fontWeight: "900", marginBottom: 6 },
  highlightTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginBottom: 6 },
  highlightText: { color: "#DCE3DB", fontSize: 14, lineHeight: 20 },
  grid: { gap: 12 },
  moduleCard: { borderRadius: 22, backgroundColor: "#FFFFFF", padding: 18, borderWidth: 1, borderColor: "rgba(107,122,106,0.16)" },
  moduleTitle: { flex: 1, fontSize: 18, fontWeight: "900", color: "#26342A" },
  moduleSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: "#6F746C" },
  openText: { marginTop: 12, fontSize: 13, fontWeight: "900", color: "#B07A3A" },
  detailCard: { borderRadius: 26, backgroundColor: "#FFFFFF", padding: 22, borderWidth: 1, borderColor: "rgba(107,122,106,0.16)" },
  moduleTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailTitle: { flex: 1, fontSize: 24, fontWeight: "900", color: "#26342A" },
  badge: { borderRadius: 999, backgroundColor: "#F4E9D8", paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "900", color: "#9A642C" },
  detailSubtitle: { marginTop: 10, fontSize: 15, lineHeight: 22, color: "#6F746C" },
  searchInput: { marginTop: 16, borderRadius: 18, backgroundColor: "#F8FAF7", borderWidth: 1, borderColor: "rgba(107,122,106,0.18)", paddingHorizontal: 14, paddingVertical: 12, color: "#26342A", fontSize: 14, fontWeight: "700" },
  smallLabel: { marginTop: 15, marginLeft: 2, fontSize: 12, fontWeight: "900", color: "#6F746C" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, backgroundColor: "#F8FAF7", paddingVertical: 9, paddingHorizontal: 12 },
  chipActive: { backgroundColor: "#2F3A31" },
  chipText: { fontSize: 12, fontWeight: "900", color: "#516052" },
  chipTextActive: { color: "#FFFFFF" },
  resultText: { marginTop: 14, fontSize: 12, fontWeight: "900", color: "#9A642C" },
  productList: { marginTop: 12, gap: 12 },
  productCard: { borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, borderWidth: 1, borderColor: "transparent" },
  productCardActive: { borderColor: "#B07A3A", backgroundColor: "#FFFDF8" },
  productTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  productNameBox: { flex: 1 },
  productBrand: { fontSize: 11, fontWeight: "900", color: "#9A642C", marginBottom: 3 },
  productName: { fontSize: 16, fontWeight: "900", color: "#26342A" },
  productTag: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#B07A3A" },
  scoreBox: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#2F3A31", alignItems: "center", justifyContent: "center" },
  scoreText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  productNote: { marginTop: 10, fontSize: 13, lineHeight: 19, color: "#5D665C" },
  productBottom: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  segmentPill: { borderRadius: 999, backgroundColor: "#F4E9D8", paddingHorizontal: 10, paddingVertical: 5 },
  segmentText: { fontSize: 11, fontWeight: "900", color: "#9A642C" },
  productHint: { flex: 1, textAlign: "right", fontSize: 11, fontWeight: "800", color: "#8C9489" },
  analysisResultBox: { marginTop: 18, borderRadius: 22, backgroundColor: "#F4E9D8", padding: 16 },
  resultTitle: { fontSize: 18, fontWeight: "900", color: "#26342A", marginBottom: 6 },
  resultSummary: { fontSize: 13, lineHeight: 19, color: "#5D665C" },
  analysisBox: { marginTop: 18, gap: 10 },
  metricCard: { borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },
  metricLabel: { fontSize: 12, fontWeight: "800", color: "#6F746C" },
  metricValue: { marginTop: 4, fontSize: 18, fontWeight: "900", color: "#26342A" },
  priorityBox: { marginTop: 10, borderRadius: 18, backgroundColor: "#F8FAF7", padding: 14 },
  priorityText: { fontSize: 13, lineHeight: 19, color: "#5D665C", fontWeight: "700" },
  infoBox: { marginTop: 16, borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },
  infoTitle: { fontSize: 14, fontWeight: "900", color: "#26342A", marginBottom: 5 },
  infoText: { fontSize: 13, lineHeight: 19, color: "#5D665C" },
  routineBlock: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 10 },
  routineTime: { fontSize: 17, fontWeight: "900", color: "#26342A" },
  routinePurpose: { fontSize: 12, lineHeight: 18, fontWeight: "800", color: "#9A642C" },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#E8ECE4", alignItems: "center", justifyContent: "center" },
  stepDotText: { fontSize: 12, fontWeight: "900", color: "#2F3A31" },
  stepTextBox: { flex: 1 },
  stepText: { fontSize: 14, lineHeight: 20, color: "#4E574E", fontWeight: "800" },
  stepMiniText: { marginTop: 2, fontSize: 12, lineHeight: 17, color: "#6F746C" },
  compareBox: { marginTop: 18, flexDirection: "row", gap: 10, alignItems: "stretch" },
  compareCol: { flex: 1, borderRadius: 18, backgroundColor: "#F8FAF7", padding: 14 },
  compareDivider: { width: 44, alignItems: "center", justifyContent: "center" },
  compareVs: { fontSize: 13, fontWeight: "900", color: "#B07A3A" },
  compareTitle: { fontSize: 14, fontWeight: "900", color: "#26342A", marginBottom: 6 },
  compareText: { fontSize: 12, lineHeight: 18, color: "#5D665C" },
  compareScore: { marginTop: 8, fontSize: 11, fontWeight: "900", color: "#9A642C" },
  decisionBox: { marginTop: 16, borderRadius: 20, backgroundColor: "#F4E9D8", padding: 16 },
  decisionTitle: { fontSize: 15, fontWeight: "900", color: "#26342A", marginBottom: 6 },
  decisionText: { fontSize: 13, lineHeight: 19, fontWeight: "800", color: "#5D665C", marginBottom: 8 },
  reasonText: { fontSize: 12, lineHeight: 18, color: "#5D665C" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  primaryButton: { flex: 1, borderRadius: 999, backgroundColor: "#2F3A31", paddingVertical: 13, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  secondaryButton: { flex: 1, borderRadius: 999, backgroundColor: "#F4E9D8", paddingVertical: 13, alignItems: "center" },
  secondaryButtonText: { color: "#9A642C", fontWeight: "900", fontSize: 14 },
  profileBox: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 10 },
  profileLineRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  profileLabel: { fontSize: 13, fontWeight: "900", color: "#6F746C" },
  profileValue: { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "900", color: "#26342A" },
  membershipCard: { marginTop: 16, borderRadius: 20, backgroundColor: "#F4E9D8", padding: 16 },
  membershipTitle: { fontSize: 15, fontWeight: "900", color: "#26342A", marginBottom: 6 },
  membershipText: { fontSize: 13, lineHeight: 19, color: "#5D665C" },
  footer: { marginTop: 18, borderRadius: 22, backgroundColor: "#2F3A31", padding: 18 },
  footerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", marginBottom: 6 },
  footerText: { color: "#DCE3DB", fontSize: 13, lineHeight: 19 },
});
TSX

{
echo "=== V39 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_SKIN_ANALYSIS_FLOW_PACK_V39" app local_demo_data

echo ""
echo "=== OLD APP TRACE CHECK ==="
if grep -RInE "AuthProvider|UserPreferencesProvider|react-native-keyboard-controller|premium-skin-scan-v2|skin-intelligence|ProductCard|@supabase|Supabase|Feather|Ionicons|expo-camera|AsyncStorage|zustand" app local_demo_data --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "FAIL: Source içinde eski app token bulundu."
  exit 1
else
  echo "PASS: Source içinde eski app token yok."
fi

echo ""
echo "=== EXPO DOCTOR ==="
npx -y expo-doctor@latest

echo ""
echo "=== IOS EXPORT ==="
rm -rf "dist/ecz4_skin_analysis_flow_pack_v39_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_skin_analysis_flow_pack_v39_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_skin_analysis_flow_pack_v39_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_SKIN_ANALYSIS_FLOW_PACK_V39" "$BUNDLE"
echo "PASS: V39 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_SKIN_ANALYSIS_FLOW_PACK_V39_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 skin analysis flow pack v39 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_SKIN_ANALYSIS_FLOW_PACK_V39_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
