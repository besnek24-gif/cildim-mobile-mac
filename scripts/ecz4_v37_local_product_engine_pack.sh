#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_local_product_engine_pack_v37_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v37 local_demo_data

cp app/index.tsx "backups/ecz4_v37/index_before_v37_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v37/layout_before_v37_$STAMP.tsx"

cat > local_demo_data/products_v37.ts <<'TS'
export type Segment = "EKO" | "PRO" | "SEC";
export type ProductCategory = "Nem" | "Koruma" | "Temizleme" | "Onarım" | "Serum" | "Göz";
export type Concern = "Kuruluk" | "Hassasiyet" | "Leke" | "Akne";

export type LocalProduct = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  segment: Segment;
  score: number;
  concern: Concern[];
  routineStep: string;
  shortBenefit: string;
  detail: string;
  usage: string;
};

export const PRODUCT_CATEGORIES: Array<"Tümü" | ProductCategory> = [
  "Tümü",
  "Nem",
  "Koruma",
  "Temizleme",
  "Onarım",
  "Serum",
  "Göz",
];

export const CONCERNS: Concern[] = ["Kuruluk", "Hassasiyet", "Leke", "Akne"];

export const LOCAL_PRODUCTS: LocalProduct[] = [
  {
    id: "barrier-cream",
    name: "Nem Bariyer Kremi",
    brand: "Demo Derm",
    category: "Nem",
    segment: "PRO",
    score: 88,
    concern: ["Kuruluk", "Hassasiyet"],
    routineStep: "Nemlendir",
    shortBenefit: "Kuru ve hassas görünümde bariyer desteği.",
    detail: "Bariyer hissini güçlendiren sade nem adımı olarak konumlanır.",
    usage: "Sabah ve akşam temiz cilde ince tabaka halinde anlatılır.",
  },
  {
    id: "spf-fluid",
    name: "Güneş Koruma Fluidi",
    brand: "Demo SPF",
    category: "Koruma",
    segment: "SEC",
    score: 91,
    concern: ["Leke", "Hassasiyet", "Akne"],
    routineStep: "Koruma",
    shortBenefit: "Gündüz rutini için hafif koruma adımı.",
    detail: "Koruma adımı özellikle leke görünümü ve gündüz maruziyetinde öne alınır.",
    usage: "Sabah rutininin son adımı olarak anlatılır.",
  },
  {
    id: "clean-gel",
    name: "Arındırıcı Jel",
    brand: "Demo Clean",
    category: "Temizleme",
    segment: "EKO",
    score: 84,
    concern: ["Akne", "Kuruluk"],
    routineStep: "Temizle",
    shortBenefit: "Sabah-akşam sade temizlik adımı.",
    detail: "Rutinin başlangıç adımıdır; karmaşık anlatıma gerek bırakmaz.",
    usage: "Sabah ve akşam kısa süreli masajla uygulanır, durulanır.",
  },
  {
    id: "repair-balm",
    name: "Onarıcı Bakım Balmı",
    brand: "Demo Repair",
    category: "Onarım",
    segment: "PRO",
    score: 86,
    concern: ["Kuruluk", "Hassasiyet"],
    routineStep: "Onar",
    shortBenefit: "Gece bakımında konfor ve destek hissi.",
    detail: "Akşam rutininde bariyer konforu anlatımı için güçlü demo seçenektir.",
    usage: "Akşam nem adımından sonra veya yerine öneri diliyle anlatılır.",
  },
  {
    id: "spot-serum",
    name: "Leke Görünümü Serumu",
    brand: "Demo Tone",
    category: "Serum",
    segment: "SEC",
    score: 82,
    concern: ["Leke"],
    routineStep: "Ton desteği",
    shortBenefit: "Leke görünümü için destekleyici bakım adımı.",
    detail: "Gündüz korumayla birlikte düşünülmesi gereken serum örneğidir.",
    usage: "Akşam rutininde düşük yoğunluklu başlangıç anlatımıyla konumlanır.",
  },
  {
    id: "calm-cream",
    name: "Yatıştırıcı Bakım Kremi",
    brand: "Demo Calm",
    category: "Nem",
    segment: "PRO",
    score: 89,
    concern: ["Hassasiyet", "Kuruluk"],
    routineStep: "Yatıştır",
    shortBenefit: "Hassas görünümde sade konfor desteği.",
    detail: "Kızarıklık/hassasiyet dili abartılmadan, konfor odağıyla anlatılır.",
    usage: "Gün içinde ihtiyaç halinde kısa ve sade kullanım diliyle önerilir.",
  },
  {
    id: "light-moist",
    name: "Hafif Nem Losyonu",
    brand: "Demo Light",
    category: "Nem",
    segment: "EKO",
    score: 80,
    concern: ["Akne", "Hassasiyet"],
    routineStep: "Hafif nem",
    shortBenefit: "Yağlı his istemeyenler için hafif nem desteği.",
    detail: "Akne eğilimli görünümde ağır his oluşturmayan demo nem adımıdır.",
    usage: "Temizlik sonrası az miktarda uygulanır.",
  },
  {
    id: "eye-gel",
    name: "Göz Çevresi Jeli",
    brand: "Demo Eye",
    category: "Göz",
    segment: "PRO",
    score: 83,
    concern: ["Hassasiyet"],
    routineStep: "Göz çevresi",
    shortBenefit: "Göz çevresinde hafif bakım hissi.",
    detail: "Rutin genişlediğinde göz çevresi adımının nasıl anlatılacağını gösterir.",
    usage: "Göz çevresine çok az miktarda, nazik uygulama diliyle anlatılır.",
  },
  {
    id: "night-cream",
    name: "Gece Nem Kremi",
    brand: "Demo Night",
    category: "Onarım",
    segment: "PRO",
    score: 87,
    concern: ["Kuruluk"],
    routineStep: "Gece nem",
    shortBenefit: "Akşam rutini için yoğun nem desteği.",
    detail: "Kuruluk baskınsa akşam rutininde ana ürün olarak öne çıkar.",
    usage: "Akşam temizlik sonrası nem adımı olarak anlatılır.",
  },
  {
    id: "daily-spf",
    name: "Günlük Koruma Kremi",
    brand: "Demo Daily",
    category: "Koruma",
    segment: "EKO",
    score: 79,
    concern: ["Leke", "Hassasiyet"],
    routineStep: "Gündüz koruma",
    shortBenefit: "Günlük kullanım için pratik koruma adımı.",
    detail: "Temel koruma ihtiyacını sade ve ekonomik dille temsil eder.",
    usage: "Sabah son adım olarak anlatılır.",
  },
  {
    id: "balance-serum",
    name: "Dengeleyici Serum",
    brand: "Demo Balance",
    category: "Serum",
    segment: "PRO",
    score: 85,
    concern: ["Akne"],
    routineStep: "Dengele",
    shortBenefit: "Akne eğilimli görünümde denge desteği.",
    detail: "Temizleme ve hafif nemle birlikte anlatılan destekleyici serum örneğidir.",
    usage: "Akşam rutininde yavaş başlangıç diliyle gösterilir.",
  },
  {
    id: "soft-cleanser",
    name: "Nazik Temizleme Sütü",
    brand: "Demo Soft",
    category: "Temizleme",
    segment: "SEC",
    score: 90,
    concern: ["Kuruluk", "Hassasiyet"],
    routineStep: "Nazik temizle",
    shortBenefit: "Kuruluk hissinde yumuşak temizlik seçeneği.",
    detail: "Bariyer hassasiyeti olan senaryolarda sert temizlik dilinden uzak durur.",
    usage: "Sabah veya akşam nazik temizleme adımı olarak anlatılır.",
  },
];

export function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

export function filterProducts(params: {
  query: string;
  category: "Tümü" | ProductCategory;
  concern: Concern;
}) {
  const q = normalizeText(params.query.trim());

  return LOCAL_PRODUCTS.filter((product) => {
    const categoryOk = params.category === "Tümü" || product.category === params.category;
    const concernOk = product.concern.includes(params.concern);
    const queryOk =
      q.length === 0 ||
      normalizeText(product.name).includes(q) ||
      normalizeText(product.brand).includes(q) ||
      normalizeText(product.shortBenefit).includes(q) ||
      normalizeText(product.category).includes(q);

    return categoryOk && concernOk && queryOk;
  }).sort((a, b) => b.score - a.score);
}

export function getRoutineForConcern(concern: Concern) {
  const pools = LOCAL_PRODUCTS.filter((product) => product.concern.includes(concern)).sort((a, b) => b.score - a.score);
  const morning = pools.filter((product) => product.category === "Temizleme" || product.category === "Nem" || product.category === "Koruma").slice(0, 3);
  const evening = pools.filter((product) => product.category === "Temizleme" || product.category === "Onarım" || product.category === "Serum" || product.category === "Nem").slice(0, 3);

  return {
    title: `${concern} odaklı demo rutin`,
    morning,
    evening,
  };
}

export function getProductById(id: string) {
  return LOCAL_PRODUCTS.find((product) => product.id === id) ?? LOCAL_PRODUCTS[0];
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
  filterProducts,
  getProductById,
  getRoutineForConcern,
} from "../local_demo_data/products_v37";

type ScreenKey = "home" | "products" | "routine" | "analysis" | "compare" | "profile";

export default function Index() {
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"Tümü" | ProductCategory>("Tümü");
  const [concern, setConcern] = useState<Concern>("Kuruluk");
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
  const routine = getRoutineForConcern(concern);

  const go = (target: ScreenKey) => setScreen(target);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Text style={styles.logo}>C</Text>
          </View>
          <Text style={styles.title}>Cildim</Text>
          <Text style={styles.subtitle}>Yerel ürün motoru</Text>
          <Text style={styles.note}>
            Ürün, rutin, analiz ve karar alanları yerel demo ürün motoruyla çalışıyor.
          </Text>
          <View style={styles.markerBox}>
            <Text style={styles.marker}>ECZ4_LOCAL_PRODUCT_ENGINE_PACK_V37</Text>
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
              <StatusCard value={String(PRODUCT_CATEGORIES.length - 1)} label="Kategori" />
              <StatusCard value={String(CONCERNS.length)} label="Endişe" />
            </View>

            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>Motor durumu</Text>
              <Text style={styles.highlightTitle}>Ürün önerisi artık tek listeden besleniyor.</Text>
              <Text style={styles.highlightText}>
                Arama, filtre, rutin ve karar rehberi aynı yerel ürün motorunu kullanır.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Hızlı giriş</Text>
            <View style={styles.grid}>
              <ModuleCard title="Ürün Önerileri" text="Arama, kategori, endişe ve skor sıralama." onPress={() => go("products")} />
              <ModuleCard title="Rutinim" text="Seçilen endişeye göre ürünlü rutin." onPress={() => go("routine")} />
              <ModuleCard title="Cilt Analizi" text="Endişe seçimiyle öneri yönlendirme." onPress={() => go("analysis")} />
              <ModuleCard title="Karar Rehberi" text="Aynı ürün motorundan iki ürünü kıyasla." onPress={() => go("compare")} />
              <ModuleCard title="Profil" text="Misafir ve üyelik hazırlık alanı." onPress={() => go("profile")} />
            </View>
          </>
        )}

        {screen === "products" && (
          <View style={styles.detailCard}>
            <Header title="Ürün Önerileri" badge="V37" />
            <Text style={styles.detailSubtitle}>
              Yerel ürün motoru arama, kategori ve endişeye göre sonuç üretir.
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
              })}
            </View>

            <InfoBox title={selectedProduct.name} text={`${selectedProduct.detail} ${selectedProduct.usage}`} />
          </View>
        )}

        {screen === "routine" && (
          <View style={styles.detailCard}>
            <Header title="Rutinim" badge="V37" />
            <Text style={styles.detailSubtitle}>Rutin artık yerel ürün motorundaki ürünlerden oluşur.</Text>

            <View style={styles.chipRow}>
              {CONCERNS.map((item) => (
                <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
              ))}
            </View>

            <InfoBox title={routine.title} text="Sabah ve akşam ürünleri seçilen endişeye göre sıralanır." />
            <RoutineProducts title="Sabah" products={routine.morning} />
            <RoutineProducts title="Akşam" products={routine.evening} />
          </View>
        )}

        {screen === "analysis" && (
          <View style={styles.detailCard}>
            <Header title="Cilt Analizi" badge="V37" />
            <Text style={styles.detailSubtitle}>Analiz demo sonucu seçilen endişeye göre ürün motorunu yönlendirir.</Text>

            <View style={styles.chipRow}>
              {CONCERNS.map((item) => (
                <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
              ))}
            </View>

            <View style={styles.analysisBox}>
              <Metric label="Seçili endişe" value={concern} />
              <Metric label="Uygun ürün" value={String(filteredProducts.length)} />
              <Metric label="En yüksek skor" value={String(filteredProducts[0]?.score ?? "-")} />
              <Metric label="Rutin dili" value="Sade" />
            </View>

            <InfoBox
              title="Analiz yorumu"
              text={`${concern} odağıyla önce rutin dili sadeleştirilir, sonra ürün önerisi ürün motorundan seçilir.`}
            />

            <Pressable style={styles.primaryButton} onPress={() => go("products")}>
              <Text style={styles.primaryButtonText}>Öneri ürünleri gör</Text>
            </Pressable>
          </View>
        )}

        {screen === "compare" && (
          <View style={styles.detailCard}>
            <Header title="Karar Rehberi" badge="V37" />
            <Text style={styles.detailSubtitle}>Karşılaştırma aynı yerel ürün listesinden beslenir.</Text>

            <Text style={styles.smallLabel}>Sol ürün</Text>
            <View style={styles.chipRow}>
              {LOCAL_PRODUCTS.slice(0, 6).map((item) => (
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
              {LOCAL_PRODUCTS.slice(0, 6).map((item) => (
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

            <InfoBox
              title="Karar cümlesi"
              text={`${leftProduct.category} ihtiyacı baskınsa ${leftProduct.name}; ${rightProduct.category} önceliği varsa ${rightProduct.name} anlatılır.`}
            />
          </View>
        )}

        {screen === "profile" && (
          <View style={styles.detailCard}>
            <Header title="Profil" badge="Misafir" />
            <Text style={styles.detailSubtitle}>Kişisel alan bu aşamada güvenli misafir görünümündedir.</Text>

            <View style={styles.profileBox}>
              <ProfileLine label="Durum" value="Misafir görünümü" />
              <ProfileLine label="Ürün motoru" value="Yerel demo" />
              <ProfileLine label="Rutin" value="Endişeye göre" />
              <ProfileLine label="Üyelik" value="Hazırlık alanı" />
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
            Bu sürüm gerçek veri, kamera, giriş ve eski ağır bileşenleri içermez. Ürün motoru yerel ve izoledir.
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

function RoutineProducts({ title, products }: { title: string; products: typeof LOCAL_PRODUCTS }) {
  return (
    <View style={styles.routineBlock}>
      <Text style={styles.routineTime}>{title}</Text>
      {products.map((product, index) => (
        <View key={`${title}-${product.id}`} style={styles.stepRow}>
          <View style={styles.stepDot}>
            <Text style={styles.stepDotText}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{product.routineStep}: {product.name}</Text>
        </View>
      ))}
    </View>
  );
}

function CompareColumn({ product }: { product: typeof LOCAL_PRODUCTS[number] }) {
  return (
    <View style={styles.compareCol}>
      <Text style={styles.compareTitle}>{product.name}</Text>
      <Text style={styles.compareText}>{product.shortBenefit}</Text>
      <Text style={styles.compareScore}>Skor {product.score} • {product.segment}</Text>
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
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#E8ECE4", alignItems: "center", justifyContent: "center" },
  stepDotText: { fontSize: 12, fontWeight: "900", color: "#2F3A31" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: "#4E574E" },
  compareBox: { marginTop: 18, flexDirection: "row", gap: 10, alignItems: "stretch" },
  compareCol: { flex: 1, borderRadius: 18, backgroundColor: "#F8FAF7", padding: 14 },
  compareDivider: { width: 44, alignItems: "center", justifyContent: "center" },
  compareVs: { fontSize: 13, fontWeight: "900", color: "#B07A3A" },
  compareTitle: { fontSize: 14, fontWeight: "900", color: "#26342A", marginBottom: 6 },
  compareText: { fontSize: 12, lineHeight: 18, color: "#5D665C" },
  compareScore: { marginTop: 8, fontSize: 11, fontWeight: "900", color: "#9A642C" },
  primaryButton: { marginTop: 18, borderRadius: 999, backgroundColor: "#2F3A31", paddingVertical: 13, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
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
echo "=== V37 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_LOCAL_PRODUCT_ENGINE_PACK_V37" app local_demo_data

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
rm -rf "dist/ecz4_local_product_engine_pack_v37_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_local_product_engine_pack_v37_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_local_product_engine_pack_v37_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_LOCAL_PRODUCT_ENGINE_PACK_V37" "$BUNDLE"
echo "PASS: V37 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_LOCAL_PRODUCT_ENGINE_PACK_V37_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 local product engine pack v37 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_LOCAL_PRODUCT_ENGINE_PACK_V37_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
