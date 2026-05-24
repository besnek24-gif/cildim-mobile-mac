/**
 * Seçkin Üyelik — paywall bileşenleri
 *
 * Dışarıya iki şey verir:
 *   GateCard   — ekran içi yumuşak kilitli kart (inline)
 *   SeckinModal — tam faydalar + CTA modalı
 *
 * KURALLAR:
 * · Backdrop: TouchableWithoutFeedback → absoluteFillObject
 * · Easing kullanma
 * · Hiç emoji yoksa Ionicons/Feather kullan
 * · Dil: sakin, güvenilir Türkçe
 */

import { router }             from "expo-router";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

// ─── Renkler ──────────────────────────────────────────────────────────────────

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";
const CREAM  = "#F5F1EB";
const INK    = "#1C1C1E";
const MUTED  = "#6B6B6B";
const WHITE  = "#FFFFFF";

// ─── Faydalar ─────────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: "◈",
    title: "Derin Analiz",
    desc: "Bulgular rafine yorumlanır, öneriler daha isabetli olur.",
  },
  {
    icon: "◉",
    title: "Akıllı Rutin",
    desc: "Rutin dinamik olarak güncellenir; gereksiz adımlar ayıklanır.",
  },
  {
    icon: "◐",
    title: "İlerleme Takibi",
    desc: "Bağlılık analizi, karşılaştırma içgörüleri ve ilerleme yorumu.",
  },
  {
    icon: "✦",
    title: "Akıllı Uyarılar",
    desc: "Alerjen, çakışan içerik ve hassasiyet uyarıları.",
  },
];

// ─── GateCard ─────────────────────────────────────────────────────────────────

export interface GateCardProps {
  title:      string;
  description: string;
  onUpgrade:  () => void;
}

export function GateCard({ title, description, onUpgrade }: GateCardProps) {
  return (
    <View style={gc.wrap}>
      <View style={gc.left}>
        <View style={gc.accent} />
        <View style={gc.body}>
          <Text style={gc.lock}>✦ Seçkin Üyelik</Text>
          <Text style={gc.title}>{title}</Text>
          <Text style={gc.desc}>{description}</Text>
        </View>
      </View>
      <TouchableOpacity style={gc.btn} onPress={onUpgrade} activeOpacity={0.82}>
        <Text style={gc.btnTxt}>Aç →</Text>
      </TouchableOpacity>
    </View>
  );
}

const gc = StyleSheet.create({
  wrap:  {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             12,
    backgroundColor: `${COPPER}0C`,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     `${COPPER}28`,
    overflow:        "hidden",
    marginVertical:  4,
    paddingRight:    14,
    paddingVertical: 14,
  },
  left:  { flexDirection: "row", flex: 1, alignItems: "stretch" },
  accent:{ width: 3, backgroundColor: COPPER, borderRadius: 2, marginLeft: 14, marginRight: 12 },
  body:  { flex: 1, gap: 3 },
  lock:  { fontSize: 10, fontWeight: "700", color: COPPER, letterSpacing: 0.6 },
  title: { fontSize: 14, fontWeight: "700", color: INK },
  desc:  { fontSize: 12, color: MUTED, lineHeight: 17 },
  btn:   { backgroundColor: COPPER, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  btnTxt:{ fontSize: 13, fontWeight: "700", color: WHITE },
});

// ─── SeckinModal ──────────────────────────────────────────────────────────────

export interface SeckinModalProps {
  visible:  boolean;
  onClose:  () => void;
}

export function SeckinModal({ visible, onClose }: SeckinModalProps) {
  function goUpgrade() {
    onClose();
    router.push("/uyelik" as any);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={m.overlay}>

        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>

        {/* Sayfa */}
        <View style={m.sheet}>
          <View style={m.handle} />

          {/* Başlık */}
          <View style={m.header}>
            <Text style={m.badge}>SEÇKİN ÜYELİK</Text>
            <Text style={m.title}>Daha derin destek.</Text>
            <Text style={m.subtitle}>
              Cilt bakım profilinden rutine, ilerleme takibine kadar her adımda daha isabetli yönlendirme.
            </Text>
          </View>

          {/* Fayda kartları */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={m.benefitList}
          >
            {BENEFITS.map((b) => (
              <View key={b.title} style={m.card}>
                <Text style={m.cardIcon}>{b.icon}</Text>
                <View style={m.cardBody}>
                  <Text style={m.cardTitle}>{b.title}</Text>
                  <Text style={m.cardDesc}>{b.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* CTA'lar */}
          <TouchableOpacity style={m.primary} onPress={goUpgrade} activeOpacity={0.85}>
            <Text style={m.primaryTxt}>Seçkin Üyeliği Aç</Text>
          </TouchableOpacity>

          <TouchableOpacity style={m.secondary} onPress={onClose} activeOpacity={0.7}>
            <Text style={m.secondaryTxt}>Şimdilik devam et</Text>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.38)" },
  sheet:       {
    backgroundColor:      WHITE,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    padding:              24,
    paddingBottom:        36,
    gap:                  0,
  },
  handle:      { width: 36, height: 4, backgroundColor: "#DDD", borderRadius: 2, alignSelf: "center", marginBottom: 20 },

  header:      { gap: 6, marginBottom: 18 },
  badge:       { fontSize: 10, fontWeight: "700", color: COPPER, letterSpacing: 0.8 },
  title:       { fontSize: 22, fontWeight: "800", color: INK, letterSpacing: -0.4 },
  subtitle:    { fontSize: 14, color: MUTED, lineHeight: 20 },

  benefitList: { gap: 12, paddingBottom: 20 },
  card:        {
    flexDirection:   "row",
    alignItems:      "flex-start",
    gap:             14,
    backgroundColor: CREAM,
    borderRadius:    14,
    padding:         14,
    borderWidth:     1,
    borderColor:     "#E8E3DC",
  },
  cardIcon:    { fontSize: 20, color: SAGE, width: 24, textAlign: "center", marginTop: 1 },
  cardBody:    { flex: 1, gap: 3 },
  cardTitle:   { fontSize: 15, fontWeight: "700", color: INK },
  cardDesc:    { fontSize: 13, color: MUTED, lineHeight: 18 },

  primary:     {
    backgroundColor: SAGE,
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      "center",
    marginTop:       4,
  },
  primaryTxt:  { fontSize: 16, fontWeight: "800", color: WHITE, letterSpacing: -0.2 },

  secondary:   {
    borderRadius:    16,
    paddingVertical: 13,
    alignItems:      "center",
    marginTop:       8,
  },
  secondaryTxt:{ fontSize: 14, color: MUTED, fontWeight: "500" },
});
