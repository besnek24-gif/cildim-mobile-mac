#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="reports/ecz4_routine_screen_polish_pack_v45_$STAMP"
mkdir -p "$REPORT_DIR" stable_snapshots backups/ecz4_v45 local_demo_data

cp app/index.tsx "backups/ecz4_v45/index_before_v45_$STAMP.tsx"
cp app/_layout.tsx "backups/ecz4_v45/layout_before_v45_$STAMP.tsx"
cp local_demo_data/products_v37.ts "backups/ecz4_v45/products_v37_before_v45_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/decision_v38.ts "backups/ecz4_v45/decision_v38_before_v45_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/analysis_v39.ts "backups/ecz4_v45/analysis_v39_before_v45_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/scan_v40.ts "backups/ecz4_v45/scan_v40_before_v45_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/ux_guard_v41.ts "backups/ecz4_v45/ux_guard_v41_before_v45_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/test_readiness_v42.ts "backups/ecz4_v45/test_readiness_v42_before_v45_$STAMP.ts" 2>/dev/null || true
cp local_demo_data/product_detail_v44.ts "backups/ecz4_v45/product_detail_v44_before_v45_$STAMP.ts" 2>/dev/null || true

cat > local_demo_data/routine_plan_v45.ts <<'TS'
import { type Concern, type LocalProduct } from "./products_v37";
import { getRoutineBlocksV38 } from "./decision_v38";

export type RoutinePlanBlockV45 = {
  title: "Sabah" | "Akşam";
  purpose: string;
  products: LocalProduct[];
  tips: string[];
};

export type RoutinePlanV45 = {
  concern: Concern;
  headline: string;
  summary: string;
  blocks: RoutinePlanBlockV45[];
  totalProducts: number;
  totalSteps: number;
};

export function buildRoutinePlanV45(concern: Concern): RoutinePlanV45 {
  const rawBlocks = getRoutineBlocksV38(concern);

  const blocks: RoutinePlanBlockV45[] = rawBlocks.map((block) => ({
    title: block.title,
    purpose: block.purpose,
    products: block.products,
    tips: buildTips(concern, block.title),
  }));

  const totalProducts = blocks.reduce((sum, block) => sum + block.products.length, 0);

  return {
    concern,
    headline: `${concern} için sabah-akşam bakım planı`,
    summary: buildSummary(concern),
    blocks,
    totalProducts,
    totalSteps: totalProducts,
  };
}

function buildSummary(concern: Concern) {
  if (concern === "Kuruluk") {
    return "Kuruluk odağında rutin; nazik temizlik, bariyer desteği ve düzenli nem anlatımıyla kurulmalı.";
  }

  if (concern === "Hassasiyet") {
    return "Hassasiyet odağında rutin kısa tutulur; fazla ürün yerine anlaşılır ve sakin adımlar öne çıkar.";
  }

  if (concern === "Leke") {
    return "Leke görünümünde gündüz koruma adımı rutinin merkezinde tutulur; akşam destek adımı sade anlatılır.";
  }

  return "Akne eğiliminde temizlik, hafif nem ve dengeleyici destek beraber düşünülür; ağır his oluşturmayan anlatım seçilir.";
}

function buildTips(concern: Concern, title: "Sabah" | "Akşam") {
  if (title === "Sabah") {
    if (concern === "Leke") return ["Koruma adımı atlanmaz.", "Ürün dili gündüz düzenine bağlanır."];
    if (concern === "Akne") return ["Hafif yapı vurgulanır.", "Temizlik sertleştirilmez."];
    return ["Rutin kısa tutulur.", "Koruma ve nem dengesi anlatılır."];
  }

  if (concern === "Kuruluk") return ["Akşam konforu öne alınır.", "Bariyer desteği sade anlatılır."];
  if (concern === "Hassasiyet") return ["Az ürün, net kullanım.", "Yatıştırıcı dil tercih edilir."];
  return ["Akşam destek adımı abartılmaz.", "Düzenli kullanım vurgulanır."];
}
TS

python3 - <<'PY'
from pathlib import Path
import re

p = Path("app/index.tsx")
s = p.read_text()

if "ECZ4_PRODUCT_DETAIL_POLISH_PACK_V44" not in s:
    print("V44 marker bulunamadı. Önce V44 aktif olmalı.")
    raise SystemExit(1)

s = s.replace("ECZ4_PRODUCT_DETAIL_POLISH_PACK_V44", "ECZ4_ROUTINE_SCREEN_POLISH_PACK_V45")
s = s.replace("Ürün detay parlatma paketi", "Rutin ekranı parlatma paketi")
s = s.replace(
    "Ürün detayları, neden önerildiği ve rutin rolü daha okunur hale getirildi.",
    "Sabah-akşam rutin planı daha okunur, kartlı ve yönlendirici hale getirildi."
)
s = s.replace('<StatusCard value="V44" label="Ürün detay" />', '<StatusCard value="V45" label="Rutin ekranı" />')
s = s.replace("V44 durumu", "V45 durumu")
s = s.replace(
    "Ürün seçimi artık daha net detay ve öneri gerekçesi gösterir.",
    "Rutin ekranı artık sabah-akşam plan, ipucu ve ürün adımlarıyla daha belirgin."
)
s = s.replace(
    "Ürün ekranında seçili ürünün kullanım dili, rutin rolü ve neden önerildiği ayrı ayrı görünür.",
    "Rutin ekranında seçili endişeye göre amaç, ürünler, ipuçları ve adım özeti birlikte görünür."
)

if 'from "../local_demo_data/routine_plan_v45"' not in s:
    s = s.replace(
        'import {\n  buildProductDetailV44,\n  getScoreLabelV44,\n} from "../local_demo_data/product_detail_v44";',
        'import {\n  buildProductDetailV44,\n  getScoreLabelV44,\n} from "../local_demo_data/product_detail_v44";\nimport {\n  buildRoutinePlanV45,\n} from "../local_demo_data/routine_plan_v45";'
    )

# Add selected routine state
if 'const [selectedRoutineBlock, setSelectedRoutineBlock]' not in s:
    s = s.replace(
        'const [routineLevel, setRoutineLevel] = useState<RoutineLevel>("Dengeli");',
        'const [routineLevel, setRoutineLevel] = useState<RoutineLevel>("Dengeli");\n  const [selectedRoutineBlock, setSelectedRoutineBlock] = useState<"Sabah" | "Akşam">("Sabah");'
    )

# Add routine plan memo after routineBlocks
if "const routinePlan = useMemo(" not in s:
    s = s.replace(
        'const routineBlocks = useMemo(() => getRoutineBlocksV38(concern), [concern]);',
        'const routineBlocks = useMemo(() => getRoutineBlocksV38(concern), [concern]);\n  const routinePlan = useMemo(() => buildRoutinePlanV45(concern), [concern]);'
    )

# Replace routine screen block robustly from routine start to next analysis/scan/compare/profile
routine_block = '''        {screen === "routine" && (
          <View style={styles.detailCard}>
            <Header title="Rutinim" badge="V45" />
            <Text style={styles.detailSubtitle}>
              Rutin seçilen endişeye göre sabah-akşam plan, ürün adımları ve mini ipuçlarıyla gösterilir.
            </Text>

            <View style={styles.routineHeroBox}>
              <Text style={styles.routineHeroLabel}>Seçili rutin</Text>
              <Text style={styles.routineHeroTitle}>{routinePlan.headline}</Text>
              <Text style={styles.routineHeroText}>{routinePlan.summary}</Text>

              <View style={styles.routineStatsRow}>
                <View style={styles.routineStatCard}>
                  <Text style={styles.routineStatValue}>{routinePlan.totalSteps}</Text>
                  <Text style={styles.routineStatLabel}>Adım</Text>
                </View>
                <View style={styles.routineStatCard}>
                  <Text style={styles.routineStatValue}>{routinePlan.blocks.length}</Text>
                  <Text style={styles.routineStatLabel}>Zaman</Text>
                </View>
                <View style={styles.routineStatCard}>
                  <Text style={styles.routineStatValue}>{concern}</Text>
                  <Text style={styles.routineStatLabel}>Odak</Text>
                </View>
              </View>
            </View>

            <Text style={styles.smallLabel}>Endişe seç</Text>
            <View style={styles.chipRow}>
              {CONCERNS.map((item) => (
                <Chip key={item} label={item} active={concern === item} onPress={() => setConcern(item)} />
              ))}
            </View>

            <Text style={styles.smallLabel}>Rutin zamanı</Text>
            <View style={styles.chipRow}>
              {routinePlan.blocks.map((block) => (
                <Chip
                  key={block.title}
                  label={block.title}
                  active={selectedRoutineBlock === block.title}
                  onPress={() => setSelectedRoutineBlock(block.title)}
                />
              ))}
            </View>

            {routinePlan.blocks.map((block) => {
              const activeBlock = selectedRoutineBlock === block.title;
              return (
                <Pressable
                  key={block.title}
                  style={[styles.routineBlock, activeBlock && styles.routineBlockActive]}
                  onPress={() => setSelectedRoutineBlock(block.title)}
                >
                  <View style={styles.routineBlockHeader}>
                    <Text style={styles.routineTime}>{block.title}</Text>
                    <Text style={styles.routinePurpose}>{block.purpose}</Text>
                  </View>

                  {block.products.map((product, index) => (
                    <Pressable
                      key={`${block.title}-${product.id}`}
                      style={styles.routineProductRow}
                      onPress={() => {
                        setSelectedProductId(product.id);
                        setQuery("");
                        setCategory("Tümü");
                        go("products");
                      }}
                    >
                      <View style={styles.stepDot}>
                        <Text style={styles.stepDotText}>{index + 1}</Text>
                      </View>
                      <View style={styles.stepTextBox}>
                        <Text style={styles.stepText}>{product.routineStep}: {product.name}</Text>
                        <Text style={styles.stepMiniText}>{product.shortBenefit}</Text>
                      </View>
                      <Text style={styles.routineGoText}>Ürün</Text>
                    </Pressable>
                  ))}

                  <View style={styles.routineTipsBox}>
                    <Text style={styles.routineTipsTitle}>Mini ipuçları</Text>
                    {block.tips.map((tip) => (
                      <Text key={tip} style={styles.routineTipText}>• {tip}</Text>
                    ))}
                  </View>
                </Pressable>
              );
            })}

            <InfoBox title="Rutin notu" text={`${concern} odağında rutin önce sade anlatılır, sonra ürün detayı açılır.`} />
          </View>
        )}

'''

pattern = re.compile(r'        \{screen === "routine" && \(\n.*?\n        \)}\n\n(?=        \{screen === "(analysis|scan|compare|profile)" && \()', re.DOTALL)
s2, count = pattern.subn(routine_block, s, count=1)
if count != 1:
    print("Rutin ekran bloğu bulunamadı.")
    for i, line in enumerate(s.splitlines(), start=1):
        if 'screen === "routine"' in line:
            for n, l in enumerate(s.splitlines()[max(0,i-5):i+120], start=max(1,i-4)):
                print(f"{n}: {l}")
            break
    raise SystemExit(1)
s = s2

# Styles
if "routineHeroBox" not in s:
    s = s.replace(
        'routineBlock: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 10 },',
        '''routineHeroBox: { marginTop: 16, borderRadius: 22, backgroundColor: "#FFFDF8", padding: 16, borderWidth: 1, borderColor: "#F4E9D8" },
  routineHeroLabel: { fontSize: 12, fontWeight: "900", color: "#9A642C", marginBottom: 6 },
  routineHeroTitle: { fontSize: 18, fontWeight: "900", color: "#26342A" },
  routineHeroText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: "#5D665C" },
  routineStatsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  routineStatCard: { flex: 1, borderRadius: 16, backgroundColor: "#F8FAF7", padding: 10, alignItems: "center" },
  routineStatValue: { fontSize: 14, fontWeight: "900", color: "#26342A", textAlign: "center" },
  routineStatLabel: { marginTop: 3, fontSize: 10, fontWeight: "900", color: "#6F746C" },
  routineBlock: { marginTop: 18, borderRadius: 20, backgroundColor: "#F8FAF7", padding: 16, gap: 10, borderWidth: 1, borderColor: "transparent" },
  routineBlockActive: { backgroundColor: "#FFFDF8", borderColor: "#F4E9D8" },
  routineBlockHeader: { gap: 4 },
  routineProductRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 16, backgroundColor: "#FFFFFF", padding: 12 },
  routineGoText: { fontSize: 11, fontWeight: "900", color: "#9A642C", marginTop: 4 },
  routineTipsBox: { borderRadius: 16, backgroundColor: "#F4E9D8", padding: 12, marginTop: 2 },
  routineTipsTitle: { fontSize: 12, fontWeight: "900", color: "#26342A", marginBottom: 4 },
  routineTipText: { fontSize: 12, lineHeight: 18, color: "#5D665C", fontWeight: "700" },'''
    )

p.write_text(s)
print("V45 routine screen polish patch uygulandı.")
PY

{
echo "=== V45 SOURCE CHECK ==="
find app local_demo_data -type f | sort
grep -RIn "ECZ4_ROUTINE_SCREEN_POLISH_PACK_V45" app local_demo_data

echo ""
echo "=== ROUTINE POLISH PRESENCE CHECK ==="
grep -RInE 'routine_plan_v45|buildRoutinePlanV45|routineHeroBox|routineProductRow|selectedRoutineBlock' app local_demo_data

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
rm -rf "dist/ecz4_routine_screen_polish_pack_v45_$STAMP"
npx expo export --platform ios --output-dir "dist/ecz4_routine_screen_polish_pack_v45_$STAMP" --clear

echo ""
echo "=== BUNDLE CHECK ==="
BUNDLE=$(find "dist/ecz4_routine_screen_polish_pack_v45_$STAMP" -type f -name "*.js" | head -1)

if [ -z "$BUNDLE" ] || [ ! -f "$BUNDLE" ]; then
  echo "FAIL: Bundle oluşmadı."
  exit 1
fi

echo "BUNDLE=$BUNDLE"
SIZE=$(wc -c < "$BUNDLE")
echo "BUNDLE_SIZE_BYTES=$SIZE"

grep -q "ECZ4_ROUTINE_SCREEN_POLISH_PACK_V45" "$BUNDLE"
echo "PASS: V45 marker bundle içinde var."

if grep -E "react-native-keyboard-controller|KeyboardProvider|AuthProvider|UserPreferencesProvider|premium-skin-scan-v2|skin-intelligence|ProductCard|expo-camera|app_full_crash_tree|quarantine|AsyncStorage|Supabase|@supabase" "$BUNDLE" > "$REPORT_DIR/old_app_bundle_hits.txt"; then
  echo "FAIL: Bundle içinde eski app izi var."
  head -60 "$REPORT_DIR/old_app_bundle_hits.txt"
  exit 1
else
  echo "PASS: Bundle içinde eski full app izi yok."
fi

tar -czf "stable_snapshots/ECZ4_ROUTINE_SCREEN_POLISH_PACK_V45_PASS_$STAMP.tar.gz" app local_demo_data app.json package.json .easignore quarantine "$REPORT_DIR"

echo ""
echo "=== FINAL ==="
echo "PASS: ECZ4 routine screen polish pack v45 kaynak/export/bundle temiz ve snapshot alındı."
ls -lh "stable_snapshots/ECZ4_ROUTINE_SCREEN_POLISH_PACK_V45_PASS_$STAMP.tar.gz"
} | tee "$REPORT_DIR/summary.txt"
