#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_rich_demo_shell_v34_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v34

cp app/index.tsx "backups/ecz4_v34/index_before_v34_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v34/layout_before_v34_$STAMP.tsx"

cat > app/index.tsx <<'TSX'
import React, { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";

type SectionKey = "home" | "analysis" | "products" | "routine" | "compare" | "profile";

const PRODUCTS = [
  {
    name: "Nem Bariyer Kremi",
    brand: "Demo Derm",
    tag: "Kuruluk",
    score: "88",
    segment: "PRO",
    note: "Kuru ve hassas görünümde bariyer desteği için örnek öneri.",
  },
  {
    name: "Güneş Koruma Fluidi",
    brand: "Demo SPF",
    tag: "Koruma",
    score: "91",
    segment: "SEÇ",
    note: "Gündüz rutininde hafif yapı ve koruma odaklı örnek seçenek.",
  },
  {
    name: "Arındırıcı Jel",
    brand: "Demo Clean",
    tag: "Temizleme",
    score: "84",
    segment: "EKO",
    note: "Sabah-akşam sade temizlik adımı için örnek ürün alanı.",
  },
];

const ROUTINE = [
  {
    time: "Sabah",
    tone: "Güne başlama",
    steps: ["Nazik temizleme", "Nem desteği", "Güneş koruma"],
  },
  {
    time: "Akşam",
    tone: "Onarım zamanı",
    steps: ["Gün sonu temizlik", "Bariyer desteği", "Yoğun nem"],
  },
];

const MODULES = [
  {
    key: "analysis" as const,
    title: "Cilt Analizi",
    badge: "Demo",
    subtitle: "Örnek analiz sonucu ve bakım öncelikleri.",
  },
  {
    key: "products" as const,
    title: "Ürün Önerileri",
    badge: "Demo",
    subtitle: "Güvenli örnek ürün kartları ve skor alanı.",
  },
  {
    key: "routine" as const,
    title: "Rutinim",
    badge: "Demo",
    subtitle: "Sabah-akşam sade rutin akışı.",
  },
  {
    key: "compare" as const,
    title: "Karar Rehberi",
    badge: "Yeni",
    subtitle: "İki ürünü sade farklarla kıyaslayan demo alan.",
  },
  {
    key: "profile" as const,
    title: "Profil",
    badge: "Hazır değil",
    subtitle: "Kişisel alan sonra güvenli şekilde açılacak.",
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
          <Text style={styles.subtitle}>Zengin demo iskelet</Text>

          <Text style={styles.note}>
            Ana ekran, ürün önerileri, rutin, analiz ve karar rehberi güvenli demo verilerle çalışıyor.
          </Text>

          <View style={styles.markerBox}>
            <Text style={styles.marker}>ECZ4_RICH_DEMO_SHELL_V34</Text>
          </View>
        </View>

        <View style={styles.navRow}>
          <NavPill label="Ana" active={active === "home"} onPress={() => setActive("home")} />
          {MODULES.map((item) => (
            <NavPill
              key={item.key}
              label={item.title.split(" ")[0]}
              active={active === item.key}
              onPress={() => setActive(item.key)}
            />
          ))}
        </View>

        {active === "home" && (
          <>
            <Text style={styles.sectionTitle}>Bugünkü özet</Text>

            <View style={styles.statusGrid}>
              <StatusCard value="3" label="Demo ürün" />
              <StatusCard value="2" label="Rutin zamanı" />
              <StatusCard value="5" label="Modül alanı" />
            </View>

            <View style={styles.highlightCard}>
              <Text style={styles.highlightLabel}>Günün bakım notu</Text>
              <Text style={styles.highlightTitle}>Nem bariyeri önce gelir.</Text>
              <Text style={styles.highlightText}>
                Cilt kuruluk hissi veriyorsa bakım rutini önce sadeleşmeli, sonra güçlenmeli.
              </Text>
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
              Örnek sonuç: cilt görünümü nem desteği, sade temizlik ve gündüz koruma adımı istiyor.
            </Text>

            <View style={styles.analysisBox}>
              <Metric label="Nem ihtiyacı" value="Yüksek" />
              <Metric label="Hassasiyet eğilimi" value="Orta" />
              <Metric label="Gündüz önceliği" value="Koruma" />
              <Metric label="Rutin dili" value="Sade" />
            </View>

            <InfoBox
              title="Eczacı notu"
              text="Bu alan ileride gerçek analiz sonucu ile beslenecek. Şimdilik güvenli demo gösterimidir."
            />

            <BackButton onPress={() => setActive("home")} />
          </View>
        )}

        {active === "products" && (
          <View style={styles.detailCard}>
            <Header title="Ürün Önerileri" badge="Demo" />
            <Text style={styles.detailSubtitle}>
              Örnek kart yapısı gerçek veri bağlantısı olmadan deneniyor.
            </Text>

            <View style={styles.productList}>
              {PRODUCTS.map((product) => (
                <View key={product.name} style={styles.productCard}>
                  <View style={styles.productTop}>
                    <View style={styles.productNameBox}>
                      <Text style={styles.productBrand}>{product.brand}</Text>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productTag}>{product.tag}</Text>
                    </View>

                    <View style={styles.scoreBox}>
                      <Text style={styles.scoreText}>{product.score}</Text>
                    </View>
                  </View>

                  <Text style={styles.productNote}>{product.note}</Text>

                  <View style={styles.productBottom}>
                    <View style={styles.segmentPill}>
                      <Text style={styles.segmentText}>{product.segment}</Text>
                    </View>
                    <Text style={styles.productHint}>Detay daha sonra açılacak</Text>
                  </View>
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
              Kalıcı kayıt olmadan sade rutin adımları gösteriliyor.
            </Text>

            {ROUTINE.map((block) => (
              <View key={block.time} style={styles.routineBlock}>
                <View style={styles.routineHeader}>
                  <Text style={styles.routineTime}>{block.time}</Text>
                  <Text style={styles.routineTone}>{block.tone}</Text>
                </View>

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

        {active === "compare" && (
          <View style={styles.detailCard}>
            <Header title="Karar Rehberi" badge="Demo" />
            <Text style={styles.detailSubtitle}>
              İki ürünü sade farklarla anlatan demo karşılaştırma alanı.
            </Text>

            <View style={styles.compareBox}>
              <View style={styles.compareCol}>
                <Text style={styles.compareTitle}>Nem Bariyer Kremi</Text>
                <Text style={styles.compareText}>Daha yoğun his, kuru görünüm için destek.</Text>
              </View>

              <View style={styles.compareDivider}>
                <Text style={styles.compareVs}>VS</Text>
              </View>

              <View style={styles.compareCol}>
                <Text style={styles.compareTitle}>Güneş Koruma Fluidi</Text>
                <Text style={styles.compareText}>Daha hafif his, gündüz koruma odağı.</Text>
              </View>
            </View>

            <InfoBox
              title="Karar cümlesi"
              text="Kuruluk baskınsa nem adımı; gündüz çıkışı varsa koruma adımı önce anlatılır."
            />

            <BackButton onPress={() => setActive("home")} />
          </View>
        )}

        {active === "profile" && (
          <View style={styles.detailCard}>
            <Header title="Profil" badge="Kapalı" />
            <Text style={styles.detailSubtitle}>
              Kişisel alan şimdilik misafir görünümünde. Giriş ve tercih katmanı sonra açılacak.
            </Text>

            <View style={styles.profileBox}>
              <Text style={styles.profileLine}>Durum: Misafir görünümü</Text>
              <Text style={styles.profileLine}>Rutin: Demo</Text>
              <Text style={styles.profileLine}>Ürün geçmişi: Kapalı</Text>
              <Text style={styles.profileLine}>Amaç: Önce ana akışı sağlamlaştırmak</Text>
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

function NavPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.navPill, active && styles.navPillActive]} onPress={onPress}>
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
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
  infoBox: { marginTop: 16, borderRadius: 18, backgroundColor: "#F7F4EE", padding: 14 },
  infoTitle: { fontSize: 14, fontWeight: "900", color: "#26342A", marginBottom: 5 },
  infoText: { fontSize: 13, lineHeight: 19, color: "#5D665C" },
  productList: { marginTop: 18, gap: 12 },
  productCard: { borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16 },
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
  routineBlock: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 10 },
  routineHeader: { marginBottom: 2 },
  routineTime: { fontSize: 17, fontWeight: "900", color: "#26342A" },
  routineTone: { marginTop: 3, fontSize: 12, fontWeight: "800", color: "#9A642C" },
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
  compareBox: { marginTop: 18, flexDirection: "row", gap: 10, alignItems: "stretch" },
  compareCol: { flex: 1, borderRadius: 18, backgroundColor: "#F8FAF7", padding: 14 },
  compareDivider: { width: 44, alignItems: "center", justifyContent: "center" },
  compareVs: { fontSize: 13, fontWeight: "900", color: "#B07A3A" },
  compareTitle: { fontSize: 14, fontWeight: "900", color: "#26342A", marginBottom: 6 },
  compareText: { fontSize: 12, lineHeight: 18, color: "#5D665C" },
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
echo "=== V34 SOURCE CHECK ==="
find app -type f | sort
grep -RIn "ECZ4_RICH_DEMO_SHELL_V34" app

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
rm -rf "dist/ecz4_rich_demo_shell_v34_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_rich_demo_shell_v34_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_rich_demo_shell_v34_$STAMP" -type f -name "*.js" | head -1)
echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_RICH_DEMO_SHELL_V34" "$BUNDLE"
echo "PASS: V34 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_RICH_DEMO_SHELL_V34_PASS_$STAMP.tar.gz" app app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 rich demo shell v34 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_RICH_DEMO_SHELL_V34_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
