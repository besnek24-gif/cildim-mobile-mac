#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_demo_product_routine_shell_v33_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v33

cp app/index.tsx "backups/ecz4_v33/index_before_v33_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v33/layout_before_v33_$STAMP.tsx"

cat > app/index.tsx <<'TSX'
import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";

type SectionKey = "home" | "analysis" | "products" | "routine" | "profile";

const PRODUCTS = [
  {
    name: "Nem Bariyer Kremi",
    tag: "Kuruluk",
    score: "88",
    note: "Hassas ve kuru cilt görünümünde bariyer desteği için örnek öneri.",
  },
  {
    name: "Güneş Koruma Fluidi",
    tag: "SPF",
    score: "91",
    note: "Gündüz rutininde hafif yapı ve koruma odaklı örnek seçenek.",
  },
  {
    name: "Arındırıcı Jel",
    tag: "Temizleme",
    score: "84",
    note: "Sabah-akşam sade temizlik adımı için örnek ürün alanı.",
  },
];

const ROUTINE = [
  { time: "Sabah", steps: ["Temizle", "Nemlendir", "Koruma uygula"] },
  { time: "Akşam", steps: ["Temizle", "Onarıcı bakım", "Nem desteği"] },
];

const MODULES = [
  {
    key: "analysis" as const,
    title: "Cilt Analizi",
    badge: "Demo",
    subtitle: "Analiz sonucu ekranı şimdilik örnek verilerle gösteriliyor.",
  },
  {
    key: "products" as const,
    title: "Ürün Önerileri",
    badge: "Demo",
    subtitle: "Ürün alanı gerçek veri bağlantısı olmadan güvenli şekilde gösteriliyor.",
  },
  {
    key: "routine" as const,
    title: "Rutinim",
    badge: "Demo",
    subtitle: "Sabah-akşam rutin akışı örnek adımlarla hazırlanıyor.",
  },
  {
    key: "profile" as const,
    title: "Profil",
    badge: "Hazır değil",
    subtitle: "Giriş ve kişisel ayarlar daha sonra kontrollü bağlanacak.",
  },
];

export default function Index() {
  const [active, setActive] = useState<SectionKey>("home");
  const activeModule = useMemo(() => MODULES.find((item) => item.key === active), [active]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Text style={styles.logo}>C</Text>
          </View>

          <Text style={styles.title}>Cildim</Text>
          <Text style={styles.subtitle}>Demo ana iskelet</Text>

          <Text style={styles.note}>
            Uygulama açılıyor. Şimdi öneri, rutin ve analiz alanları güvenli örnek
            verilerle hazırlanıyor.
          </Text>

          <View style={styles.markerBox}>
            <Text style={styles.marker}>ECZ4_DEMO_PRODUCT_ROUTINE_SHELL_V33</Text>
          </View>
        </View>

        <View style={styles.navRow}>
          <Pressable
            style={[styles.navPill, active === "home" && styles.navPillActive]}
            onPress={() => setActive("home")}
          >
            <Text style={[styles.navText, active === "home" && styles.navTextActive]}>Ana</Text>
          </Pressable>

          {MODULES.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.navPill, active === item.key && styles.navPillActive]}
              onPress={() => setActive(item.key)}
            >
              <Text style={[styles.navText, active === item.key && styles.navTextActive]}>
                {item.title.split(" ")[0]}
              </Text>
            </Pressable>
          ))}
        </View>

        {active === "home" && (
          <>
            <Text style={styles.sectionTitle}>Bugünkü görünüm</Text>

            <View style={styles.statusGrid}>
              <View style={styles.statusCard}>
                <Text style={styles.statusValue}>3</Text>
                <Text style={styles.statusLabel}>Örnek ürün</Text>
              </View>
              <View style={styles.statusCard}>
                <Text style={styles.statusValue}>2</Text>
                <Text style={styles.statusLabel}>Rutin zamanı</Text>
              </View>
              <View style={styles.statusCard}>
                <Text style={styles.statusValue}>Açık</Text>
                <Text style={styles.statusLabel}>Test hattı</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Modüller</Text>

            <View style={styles.grid}>
              {MODULES.map((item) => (
                <Pressable key={item.key} style={styles.moduleCard} onPress={() => setActive(item.key)}>
                  <View style={styles.moduleTop}>
                    <Text style={styles.moduleTitle}>{item.title}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.moduleSubtitle}>{item.subtitle}</Text>
                  <Text style={styles.openText}>Aç</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {active === "analysis" && (
          <View style={styles.detailCard}>
            <Header title="Cilt Analizi" badge="Demo" />
            <Text style={styles.detailSubtitle}>
              Örnek analiz sonucu: cilt görünümü nem desteği ve gündüz koruma adımı istiyor.
            </Text>

            <View style={styles.analysisBox}>
              <Metric label="Nem ihtiyacı" value="Yüksek" />
              <Metric label="Koruma önceliği" value="Gündüz" />
              <Metric label="Rutin önerisi" value="Sade" />
            </View>

            <BackButton onPress={() => setActive("home")} />
          </View>
        )}

        {active === "products" && (
          <View style={styles.detailCard}>
            <Header title="Ürün Önerileri" badge="Demo" />
            <Text style={styles.detailSubtitle}>
              Gerçek ürün verisi bağlanmadan önce güvenli kart yapısı deneniyor.
            </Text>

            <View style={styles.productList}>
              {PRODUCTS.map((product) => (
                <View key={product.name} style={styles.productCard}>
                  <View style={styles.productTop}>
                    <View>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productTag}>{product.tag}</Text>
                    </View>
                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreText}>{product.score}</Text>
                    </View>
                  </View>
                  <Text style={styles.productNote}>{product.note}</Text>
                </View>
              ))}
            </View>

            <BackButton onPress={() => setActive("home")} />
          </View>
        )}

        {active === "routine" && (
          <View style={styles.detailCard}>
            <Header title="Rutinim" badge="Demo" />
            <Text style={styles.detailSubtitle}>
              Rutin alanı şimdilik kalıcı kayıt olmadan örnek adımlarla çalışıyor.
            </Text>

            {ROUTINE.map((block) => (
              <View key={block.time} style={styles.routineBlock}>
                <Text style={styles.routineTime}>{block.time}</Text>
                {block.steps.map((step, index) => (
                  <View key={step} style={styles.stepRow}>
                    <View style={styles.stepDot}>
                      <Text style={styles.stepDotText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ))}

            <BackButton onPress={() => setActive("home")} />
          </View>
        )}

        {active === "profile" && (
          <View style={styles.detailCard}>
            <Header title="Profil" badge="Kapalı" />
            <Text style={styles.detailSubtitle}>
              Giriş, tercih ve kişisel ayar katmanı güvenli testlerden sonra bağlanacak.
            </Text>

            <View style={styles.profileBox}>
              <Text style={styles.profileLine}>Durum: Misafir görünümü</Text>
              <Text style={styles.profileLine}>Kayıt: Şimdilik kapalı</Text>
              <Text style={styles.profileLine}>Amaç: Önce ana ekranı sağlamlaştırmak</Text>
            </View>

            <BackButton onPress={() => setActive("home")} />
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Güvenli ilerleme</Text>
          <Text style={styles.footerText}>
            Bu sürüm gerçek veri, kamera, giriş ve eski ağır bileşenleri içermez.
            Önce arayüz iskeleti sağlamlaştırılır.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.backButton} onPress={onPress}>
      <Text style={styles.backButtonText}>Ana ekrana dön</Text>
    </Pressable>
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
  navRow: { flexDirection: "row", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  navPill: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(107,122,106,0.15)",
  },
  navPillActive: { backgroundColor: "#2F3A31" },
  navText: { fontSize: 13, fontWeight: "900", color: "#516052" },
  navTextActive: { color: "#FFFFFF" },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#26342A", marginBottom: 12, marginLeft: 4 },
  statusGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statusCard: { flex: 1, borderRadius: 20, backgroundColor: "#FFFFFF", padding: 14, alignItems: "center" },
  statusValue: { fontSize: 19, fontWeight: "900", color: "#26342A" },
  statusLabel: { marginTop: 4, fontSize: 11, fontWeight: "800", color: "#6F746C", textAlign: "center" },
  grid: { gap: 12 },
  moduleCard: {
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(107,122,106,0.16)",
  },
  moduleTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  moduleTitle: { flex: 1, fontSize: 18, fontWeight: "900", color: "#26342A" },
  badge: { borderRadius: 999, backgroundColor: "#F4E9D8", paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "900", color: "#9A642C" },
  moduleSubtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: "#6F746C" },
  openText: { marginTop: 12, fontSize: 13, fontWeight: "900", color: "#B07A3A" },
  detailCard: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(107,122,106,0.16)",
  },
  detailTitle: { flex: 1, fontSize: 24, fontWeight: "900", color: "#26342A" },
  detailSubtitle: { marginTop: 10, fontSize: 15, lineHeight: 22, color: "#6F746C" },
  analysisBox: { marginTop: 18, gap: 10 },
  metricCard: { borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },
  metricLabel: { fontSize: 12, fontWeight: "800", color: "#6F746C" },
  metricValue: { marginTop: 4, fontSize: 18, fontWeight: "900", color: "#26342A" },
  productList: { marginTop: 18, gap: 12 },
  productCard: { borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16 },
  productTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
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
  profileBox: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 8 },
  profileLine: { fontSize: 14, lineHeight: 20, color: "#4E574E", fontWeight: "700" },
  backButton: { marginTop: 20, borderRadius: 999, backgroundColor: "#2F3A31", paddingVertical: 13, alignItems: "center" },
  backButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  footer: { marginTop: 18, borderRadius: 22, backgroundColor: "#2F3A31", padding: 18 },
  footerTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", marginBottom: 6 },
  footerText: { color: "#DCE3DB", fontSize: 13, lineHeight: 19 },
});
TSX

{
echo "=== V33 SOURCE CHECK ==="
find app -type f | sort
grep -RIn "ECZ4_DEMO_PRODUCT_ROUTINE_SHELL_V33" app

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
rm -rf "dist/ecz4_demo_product_routine_shell_v33_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_demo_product_routine_shell_v33_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_demo_product_routine_shell_v33_$STAMP" -type f -name "*.js" | head -1)
echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_DEMO_PRODUCT_ROUTINE_SHELL_V33" "$BUNDLE"
echo "PASS: V33 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_DEMO_PRODUCT_ROUTINE_SHELL_V33_PASS_$STAMP.tar.gz" app app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 demo product/routine shell v33 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_DEMO_PRODUCT_ROUTINE_SHELL_V33_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
