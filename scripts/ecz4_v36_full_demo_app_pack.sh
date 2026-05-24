#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_full_demo_app_pack_v36_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v36

cp app/index.tsx "backups/ecz4_v36/index_before_v36_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v36/layout_before_v36_$STAMP.tsx"

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

type ScreenKey = "home" | "products" | "routine" | "analysis" | "compare" | "profile";
type CategoryKey = "Tümü" | "Nem" | "Koruma" | "Temizleme" | "Onarım";
type ConcernKey = "Kuruluk" | "Hassasiyet" | "Leke" | "Akne";

type DemoProduct = {
  id: string;
  name: string;
  brand: string;
  category: CategoryKey;
  segment: "EKO" | "PRO" | "SEÇ";
  score: number;
  benefit: string;
  detail: string;
  routineStep: string;
};

const PRODUCTS: DemoProduct[] = [
  {
    id: "barrier-cream",
    name: "Nem Bariyer Kremi",
    brand: "Demo Derm",
    category: "Nem",
    segment: "PRO",
    score: 88,
    benefit: "Kuru ve hassas görünümde bariyer desteği.",
    detail: "Kuru görünümde sade bir nem adımı olarak anlatılır. Yoğun bakım dili sonraki sürümde gerçek ürün bilgisiyle genişletilir.",
    routineStep: "Nemlendir",
  },
  {
    id: "spf-fluid",
    name: "Güneş Koruma Fluidi",
    brand: "Demo SPF",
    category: "Koruma",
    segment: "SEÇ",
    score: 91,
    benefit: "Gündüz rutininde hafif koruma hissi.",
    detail: "Gündüz kullanımında koruma adımını temsil eder. Gerçek ürün verisi bağlanınca içerik ve uygunluk alanları genişler.",
    routineStep: "Koruma",
  },
  {
    id: "clean-gel",
    name: "Arındırıcı Jel",
    brand: "Demo Clean",
    category: "Temizleme",
    segment: "EKO",
    score: 84,
    benefit: "Sabah-akşam sade temizlik adımı.",
    detail: "Rutinin başlangıç adımı için güvenli demo üründür. Köpürme, hassasiyet ve kullanım notları sonra gerçek veriden gelir.",
    routineStep: "Temizle",
  },
  {
    id: "repair-balm",
    name: "Onarıcı Bakım Balmı",
    brand: "Demo Repair",
    category: "Onarım",
    segment: "PRO",
    score: 86,
    benefit: "Gece bakımında destekleyici onarım hissi.",
    detail: "Akşam bakımında bariyer konforu anlatımı için kullanılır. Gerçek kayıt ve ürün geçmişi henüz bağlı değildir.",
    routineStep: "Onar",
  },
];

const CATEGORIES: CategoryKey[] = ["Tümü", "Nem", "Koruma", "Temizleme", "Onarım"];
const CONCERNS: ConcernKey[] = ["Kuruluk", "Hassasiyet", "Leke", "Akne"];

const ROUTINES: Record<ConcernKey, { title: string; morning: string[]; evening: string[] }> = {
  Kuruluk: {
    title: "Kuruluk odaklı sade rutin",
    morning: ["Nazik temizleme", "Nem bariyeri", "Güneş koruma"],
    evening: ["Temizlik", "Onarıcı bakım", "Yoğun nem"],
  },
  Hassasiyet: {
    title: "Hassasiyet için sakin rutin",
    morning: ["Sade temizlik", "Yatıştırıcı nem", "Koruma"],
    evening: ["Nazik temizlik", "Bariyer desteği", "Kısa rutin"],
  },
  Leke: {
    title: "Leke görünümü için gündüz öncelikli rutin",
    morning: ["Temizleme", "Destekleyici bakım", "Yüksek koruma"],
    evening: ["Temizlik", "Leke görünümü desteği", "Nem"],
  },
  Akne: {
    title: "Akne eğilimi için dengeli rutin",
    morning: ["Arındırıcı temizlik", "Hafif nem", "Koruma"],
    evening: ["Temizlik", "Dengeleyici bakım", "Nem"],
  },
};

export default function Index() {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryKey>("Tümü");
  const [selectedProductId, setSelectedProductId] = useState(PRODUCTS[0].id);
  const [concern, setConcern] = useState<ConcernKey>("Kuruluk");
  const [compareLeft, setCompareLeft] = useState(PRODUCTS[0].id);
  const [compareRight, setCompareRight] = useState(PRODUCTS[1].id);

  const selectedProduct = useMemo(
    () => PRODUCTS.find((item) => item.id === selectedProductId) ?? PRODUCTS[0],
    [selectedProductId],
  );

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return PRODUCTS.filter((item) => {
      const categoryOk = category === "Tümü" || item.category === category;
      const queryOk =
        q.length === 0 ||
        item.name.toLocaleLowerCase("tr-TR").includes(q) ||
        item.brand.toLocaleLowerCase("tr-TR").includes(q) ||
        item.benefit.toLocaleLowerCase("tr-TR").includes(q);
      return categoryOk && queryOk;
    });
  }, [query, category]);

  const routine = ROUTINES[concern];
  const leftProduct = PRODUCTS.find((item) => item.id === compareLeft) ?? PRODUCTS[0];
  const rightProduct = PRODUCTS.find((item) => item.id === compareRight) ?? PRODUCTS[1];

  const go = (target: ScreenKey) => setScreen(target);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Text style={styles.logo}>C</Text>
          </View>
          <Text style={styles.title}>Cildim</Text>
          <Text style={styles.subtitle}>Tam demo uygulama paketi</Text>
          <Text style={styles.note}>
            Ürün, rutin, analiz, karar rehberi ve profil alanları güvenli demo veriyle çalışır.
          </Text>
          <View style={styles.markerBox}>
            <Text style={styles.marker}>ECZ4_FULL_DEMO_APP_PACK_V36</Text>
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
              <StatusCard value="4" label="Demo ürün" />
              <StatusCard value="4" label="Endişe alanı" />
              <StatusCard value="5" label="Ana modül" />
            </View>

            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>Günün bakım notu</Text>
              <Text style={styles.highlightTitle}>Önce ihtiyaç, sonra ürün.</Text>
              <Text style={styles.highlightText}>
                Cilt bakımında doğru akış; endişeyi tanımak, rutini sade kurmak ve ürünü anlaşılır
                anlatmaktır.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Hızlı giriş</Text>
            <View style={styles.grid}>
              <ModuleCard title="Ürün Önerileri" text="Katalog, arama, filtre ve detay paneli." onPress={() => go("products")} />
              <ModuleCard title="Rutinim" text="Endişeye göre sabah-akşam demo rutin." onPress={() => go("routine")} />
              <ModuleCard title="Cilt Analizi" text="Örnek sonuç kartları ve bakım önceliği." onPress={() => go("analysis")} />
              <ModuleCard title="Karar Rehberi" text="İki ürünü sade farklarla kıyasla." onPress={() => go("compare")} />
              <ModuleCard title="Profil" text="Misafir görünümü ve üyelik hazırlığı." onPress={() => go("profile")} />
            </View>
          </>
        )}

        {screen === "products" && (
          <View style={styles.detailCard}>
            <Header title="Ürün Önerileri" badge="Demo" />
            <Text style={styles.detailSubtitle}>Arama ve kategori filtresi bu sürümde güvenli demo veriyle çalışır.</Text>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ürün, marka veya endişe ara"
              placeholderTextColor="#8C9489"
              style={styles.searchInput}
            />

            <View style={styles.chipRow}>
              {CATEGORIES.map((item) => (
                <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />
              ))}
            </View>

            <View style={styles.productList}>
              {filteredProducts.map((product) => {
                const selected = product.id === selectedProductId;
                return (
                  <Pressable
                    key={product.id}
                    style={[styles.productCard, selected && styles.productCardActive]}
                    onPress={() => setSelectedProductId(product.id)}
                  >
                    <View style={styles.productTop}>
                      <View style={styles.productNameBox}>
                        <Text style={styles.productBrand}>{product.brand}</Text>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productTag}>{product.category}</Text>
                      </View>
                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreText}>{product.score}</Text>
                      </View>
                    </View>
                    <Text style={styles.productNote}>{product.benefit}</Text>
                    <View style={styles.productBottom}>
                      <View style={styles.segmentPill}>
                        <Text style={styles.segmentText}>{product.segment}</Text>
                      </View>
                      <Text style={styles.productHint}>{selected ? "Seçildi" : "Detay için dokun"}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <InfoBox title={selectedProduct.name} text={selectedProduct.detail} />
          </View>
        )}

        {screen === "routine" && (
          <View style={styles.detailCard}>
            <Header title="Rutinim" badge="Demo" />
            <Text style={styles.detailSubtitle}>Endişe seçimine göre rutin dili değişir.</Text>

            <View style={styles.chipRow}>
              {CONCERNS.map((item) => (
                <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
              ))}
            </View>

            <InfoBox title={routine.title} text="Bu rutin kalıcı kayıt olmadan örnek veriyle hazırlanır." />

            <RoutineBlock title="Sabah" steps={routine.morning} />
            <RoutineBlock title="Akşam" steps={routine.evening} />
          </View>
        )}

        {screen === "analysis" && (
          <View style={styles.detailCard}>
            <Header title="Cilt Analizi" badge="Demo" />
            <Text style={styles.detailSubtitle}>
              Gerçek ölçüm almadan örnek analiz dili ve bakım öncelikleri gösterilir.
            </Text>

            <View style={styles.analysisBox}>
              <Metric label="Nem ihtiyacı" value="Yüksek" />
              <Metric label="Hassasiyet eğilimi" value="Orta" />
              <Metric label="Gündüz önceliği" value="Koruma" />
              <Metric label="Rutin dili" value="Sade" />
            </View>

            <InfoBox
              title="Analiz yorumu"
              text="Önce bariyer desteği ve gündüz koruma anlatılır. Aktif içerik dili daha sonra gerçek analizle genişletilir."
            />

            <Pressable style={styles.primaryButton} onPress={() => go("products")}>
              <Text style={styles.primaryButtonText}>Öneri ürünleri gör</Text>
            </Pressable>
          </View>
        )}

        {screen === "compare" && (
          <View style={styles.detailCard}>
            <Header title="Karar Rehberi" badge="Demo" />
            <Text style={styles.detailSubtitle}>İki örnek ürünü sade farklarla kıyaslar.</Text>

            <View style={styles.compareSelectRow}>
              {PRODUCTS.slice(0, 3).map((item) => (
                <Chip
                  key={`left-${item.id}`}
                  label={item.name.split(" ")[0]}
                  active={compareLeft === item.id}
                  onPress={() => setCompareLeft(item.id)}
                />
              ))}
            </View>

            <View style={styles.compareBox}>
              <View style={styles.compareCol}>
                <Text style={styles.compareTitle}>{leftProduct.name}</Text>
                <Text style={styles.compareText}>{leftProduct.benefit}</Text>
              </View>

              <View style={styles.compareDivider}>
                <Text style={styles.compareVs}>VS</Text>
              </View>

              <View style={styles.compareCol}>
                <Text style={styles.compareTitle}>{rightProduct.name}</Text>
                <Text style={styles.compareText}>{rightProduct.benefit}</Text>
              </View>
            </View>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => setCompareRight(compareRight === PRODUCTS[1].id ? PRODUCTS[2].id : PRODUCTS[1].id)}
            >
              <Text style={styles.secondaryButtonText}>Sağ ürünü değiştir</Text>
            </Pressable>

            <InfoBox
              title="Karar cümlesi"
              text="Kuruluk baskınsa nem adımı; gündüz çıkışı varsa koruma adımı önce anlatılır."
            />
          </View>
        )}

        {screen === "profile" && (
          <View style={styles.detailCard}>
            <Header title="Profil" badge="Misafir" />
            <Text style={styles.detailSubtitle}>Kişisel alan bu sürümde güvenli misafir görünümündedir.</Text>

            <View style={styles.profileBox}>
              <ProfileLine label="Durum" value="Misafir görünümü" />
              <ProfileLine label="Rutin" value="Demo açık" />
              <ProfileLine label="Ürün geçmişi" value="Kapalı" />
              <ProfileLine label="Üyelik" value="Hazırlık ekranı" />
            </View>

            <View style={styles.membershipCard}>
              <Text style={styles.membershipTitle}>Seçkin üyelik hazırlığı</Text>
              <Text style={styles.membershipText}>
                Gelişmiş analiz, daha ayrıntılı ürün açıklamaları ve rutin takibi sonraki aşamalarda bağlanacak.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Güvenli ilerleme</Text>
          <Text style={styles.footerText}>
            Bu sürüm gerçek veri, kamera, giriş ve eski ağır bileşenleri içermez.
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

function RoutineBlock({ title, steps }: { title: string; steps: string[] }) {
  return (
    <View style={styles.routineBlock}>
      <Text style={styles.routineTime}>{title}</Text>
      {steps.map((step, index) => (
        <View key={step} style={styles.stepRow}>
          <View style={styles.stepDot}>
            <Text style={styles.stepDotText}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
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
  logoBox: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: "#6B7A6A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logo: { color: "#FFF8EF", fontSize: 34, fontWeight: "900" },
  title: { fontSize: 34, fontWeight: "900", color: "#26342A", textAlign: "center" },
  subtitle: { fontSize: 18, fontWeight: "800", color: "#B07A3A", marginTop: 6, textAlign: "center" },
  note: { fontSize: 15, lineHeight: 23, textAlign: "center", color: "#6F746C", marginTop: 16 },
  markerBox: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: "#2F3A31",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  marker: { color: "#B8C0B7", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  bottomNav: { flexDirection: "row", gap: 7, marginBottom: 18, flexWrap: "wrap" },
  navButton: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(107,122,106,0.15)",
  },
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
  moduleCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(107,122,106,0.16)",
  },
  moduleTitle: { flex: 1, fontSize: 18, fontWeight: "900", color: "#26342A" },
  moduleSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: "#6F746C" },
  openText: { marginTop: 12, fontSize: 13, fontWeight: "900", color: "#B07A3A" },
  detailCard: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(107,122,106,0.16)",
  },
  moduleTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  detailTitle: { flex: 1, fontSize: 24, fontWeight: "900", color: "#26342A" },
  badge: { borderRadius: 999, backgroundColor: "#F4E9D8", paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "900", color: "#9A642C" },
  detailSubtitle: { marginTop: 10, fontSize: 15, lineHeight: 22, color: "#6F746C" },
  searchInput: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#F8FAF7",
    borderWidth: 1,
    borderColor: "rgba(107,122,106,0.18)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#26342A",
    fontSize: 14,
    fontWeight: "700",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: { borderRadius: 999, backgroundColor: "#F8FAF7", paddingVertical: 9, paddingHorizontal: 12 },
  chipActive: { backgroundColor: "#2F3A31" },
  chipText: { fontSize: 12, fontWeight: "900", color: "#516052" },
  chipTextActive: { color: "#FFFFFF" },
  productList: { marginTop: 18, gap: 12 },
  productCard: { borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, borderWidth: 1, borderColor: "transparent" },
  productCardActive: { borderColor: "#B07A3A", backgroundColor: "#FFFDF8" },
  productTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  productNameBox: { flex: 1 },
  productBrand: { fontSize: 11, fontWeight: "900", color: "#9A642C", marginBottom: 3 },
  productName: { fontSize: 16, fontWeight: "900", color: "#26342A" },
  productTag: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#B07A3A" },
  scoreBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#2F3A31",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  productNote: { marginTop: 10, fontSize: 13, lineHeight: 19, color: "#5D665C" },
  productBottom: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  segmentPill: { borderRadius: 999, backgroundColor: "#F4E9D8", paddingHorizontal: 10, paddingVertical: 5 },
  segmentText: { fontSize: 11, fontWeight: "900", color: "#9A642C" },
  productHint: { flex: 1, textAlign: "right", fontSize: 11, fontWeight: "800", color: "#8C9489" },
  analysisBox: { marginTop: 18, gap: 10 },
  metricCard: { borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },
  metricLabel: { fontSize: 12, fontWeight: "800", color: "#6F746C" },
  metricValue: { marginTop: 4, fontSize: 18, fontWeight: "900", color: "#26342A" },
  infoBox: { marginTop: 16, borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },
  infoTitle: { fontSize: 14, fontWeight: "900", color: "#26342A", marginBottom: 5 },
  infoText: { fontSize: 13, lineHeight: 19, color: "#5D665C" },
  routineBlock: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 10 },
  routineTime: { fontSize: 17, fontWeight: "900", color: "#26342A", marginBottom: 2 },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E8ECE4",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { fontSize: 12, fontWeight: "900", color: "#2F3A31" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: "#4E574E" },
  compareSelectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  compareBox: { marginTop: 18, flexDirection: "row", gap: 10, alignItems: "stretch" },
  compareCol: { flex: 1, borderRadius: 18, backgroundColor: "#F8FAF7", padding: 14 },
  compareDivider: { width: 44, alignItems: "center", justifyContent: "center" },
  compareVs: { fontSize: 13, fontWeight: "900", color: "#B07A3A" },
  compareTitle: { fontSize: 14, fontWeight: "900", color: "#26342A", marginBottom: 6 },
  compareText: { fontSize: 12, lineHeight: 18, color: "#5D665C" },
  primaryButton: { marginTop: 18, borderRadius: 999, backgroundColor: "#2F3A31", paddingVertical: 13, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: "#F4E9D8",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#9A642C", fontWeight: "900", fontSize: 13 },
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
echo "=== V36 SOURCE CHECK ==="
find app -type f | sort
grep -RIn "ECZ4_FULL_DEMO_APP_PACK_V36" app

echo ""
echo "=== OLD APP TRACE CHECK ==="
if grep -RInE "AuthProvider|UserPreferencesProvider|react-native-keyboard-controller|premium-skin-scan-v2|skin-intelligence|ProductCard|@supabase|Supabase|Feather|Ionicons|expo-camera|AsyncStorage|zustand" app --include="*.ts" --include="*.tsx" 2>/dev/null; then
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
rm -rf "dist/ecz4_full_demo_app_pack_v36_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_full_demo_app_pack_v36_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_full_demo_app_pack_v36_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_FULL_DEMO_APP_PACK_V36" "$BUNDLE"
echo "PASS: V36 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_FULL_DEMO_APP_PACK_V36_PASS_$STAMP.tar.gz" app app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 full demo app pack v36 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_FULL_DEMO_APP_PACK_V36_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
