/**
 * danisma.tsx — DermoAsistan
 * Geniş kapsamlı cilt danışmanlık merkezi
 *
 * Modüller:
 *  1. Ana ekran — konu kategorileri, serbest giriş, hızlı başlatıcılar
 *  2. Sohbet ekranı — streaming chat (mevcut API korundu)
 *  3. Rutin değerlendirme — adım adım form → AI analizi
 *  4. Ürün bulucu — yönlendirilmiş prompt ile mevcut flow
 */

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { safeBack } from "@/components/navigation/safeBack";
import {
  fetchChatProductsByPreference,
  findProductByName,
  getProductImageUri,
  type V2DBProduct,
} from "@/lib/premium-skin-scan-v2/v2ProductDB";
import {
  getPreferredSegment,
  recordSegmentClick,
} from "@/lib/segmentPreferenceStore";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { consumeSearchKonu } from "@/lib/searchIntentStore";
// ECZ4 Issue E: SoftProductCard hit → product detail sıcak paint için warm handoff.
// Diğer ekranlardaki (akilli-secim, profil-eslesme, mukayese-detay, similar, vb.)
// kanıtlanmış pattern: önce prefetchProductHeroImage(p), sonra setNavigationProduct(p),
// en son router.push. SoftProductCard tıklamasında image 4-5 sn geç geliyordu çünkü
// findProductByName ile DB'den taze çekilen ürünün hero görseli hiç prefetch edilmemişti.
import { setNavigationProduct } from "@/lib/productStore";
import { prefetchProductHeroImage } from "@/lib/imagePrefetch";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAuth } from "@/local_demo_data/safe_runtime_shims_v74";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { PremiumLockCard } from "@/local_demo_data/safe_runtime_shims_v74";
import { getFeatureFlag } from "@/lib/featureBadges";
import {
  clearDermoAsistanThreads,
  deleteDermoAsistanThread,
  getDermoAsistanThreads,
  makeDermoAsistanThreadId,
  saveDermoAsistanThread,
  type DermoAsistanThread,
} from "@/lib/dermoAsistanHistory";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

// ── Tipler ─────────────────────────────────────────────────────────────────────

interface Mesaj {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  hidden?: boolean;
  // ECZ4 Issue A v3: başarısız asistan baloncuğu için işaret. Geçmiş kaydı sırasında
  // sanitizer bu mesajları atar; UI ise normal asistan balonu gibi gösterir
  // (kullanıcı en azından "cevap üretemedim" mesajını görür, beyaz boşluk olmaz).
  failed?: boolean;
}

type Mod = "home" | "chat" | "rutin" | "result" | "gate" | "tree" | "tree_result";

interface ResultBlocks {
  genel: string;
  onecikar: string;
  yon: string;
  kacin: string;
  dikkat: string;
  sonraki: string;
}

// ── Konu Kategorileri ──────────────────────────────────────────────────────────

const KONULAR: {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  renk: string;
  bg: string;
  bgDark: string;
  sistemPrompt: string;
}[] = [
  {
    id: "akne",
    label: "Akne",
    icon: "alert-circle",
    renk: "#DC2626",
    bg: "#FEF2F2",
    bgDark: "#2A0A0A",
    sistemPrompt:
      "Konu: akne. 'Aknene bakalım.' de. Mikro otorite ekle: 'Aktif sivilce ile iz tamamen farklı ele alınır.' Sonra sor: aktif sivilce mi iz mi, cilt yağlı mı karma mı, hassasiyet var mı. Maks 3 soru, sonra bekle.",
  },
  {
    id: "roza",
    label: "Roza",
    icon: "droplet",
    renk: "#DB2777",
    bg: "#FDF2F8",
    bgDark: "#2A0A18",
    sistemPrompt:
      "Konu: roza / kızarıklık. 'Kızarıklığa bakalım.' de. Mikro otorite: 'Rozasea ile alerjik reaksiyon karıştırılır, ayırt etmek şart.' Sor: kalıcı mı dönemsel mi, yanma var mı, sıcakta artıyor mu. Maks 3 soru, bekle.",
  },
  {
    id: "leke",
    label: "Leke",
    icon: "sun",
    renk: "#D97706",
    bg: "#FFFBEB",
    bgDark: "#1C1200",
    sistemPrompt:
      "Konu: leke. 'Lekeye bakalım.' de. Mikro otorite: 'SPF olmadan hiçbir leke tedavisi işe yaramaz.' Sor: güneş lekesi mi akne izi mi, ne zamandır var, SPF kullanıyor mu. Maks 3 soru, bekle.",
  },
  {
    id: "hassas",
    label: "Hassas Cilt",
    icon: "heart",
    renk: "#9333EA",
    bg: "#FAF5FF",
    bgDark: "#1A0A2A",
    sistemPrompt:
      "Konu: hassas cilt. 'Hassasiyetine bakalım.' de. Mikro otorite: 'Hassas cilt çoğunlukla bozulmuş bariyer demektir, alerji değil.' Sor: yanma mı kızarıklık mı kuruluk mu, hangi ürünlerde sorun çıktı, asit veya retinol kullanıyor mu. Maks 3 soru, bekle.",
  },
  {
    id: "kuruluk",
    label: "Kuruluk",
    icon: "wind",
    renk: "#0891B2",
    bg: "#F0FDFA",
    bgDark: "#041418",
    sistemPrompt:
      "Konu: cilt kuruluğu. 'Kuruluğa bakalım.' de. Mikro otorite: 'Çekme hissi bariyer sorununa işaret eder, yalnız nem değil onarım lazım.' Sor: mevsimsel mi kronik mi, gerginlik çekme hissi var mı, ne kullanıyor. Maks 3 soru, bekle.",
  },
  {
    id: "yaglilik",
    label: "Yağlı Cilt",
    icon: "zap",
    renk: "#7A8F6B",
    bg: "#EAF1EA",
    bgDark: "#1E2D18",
    sistemPrompt:
      "Konu: yağlı cilt. 'Yağlanmaya bakalım.' de. Mikro otorite: 'Yağlı cilt de nemlendirici ister — atlarsan sebum daha çok artar.' Sor: T-bölgesi mi tüm yüz mü, akne de var mı, nemlendirici kullanıyor mu. Maks 3 soru, bekle.",
  },
  {
    id: "sac",
    label: "Saç Dökülmesi",
    icon: "scissors",
    renk: "#7C3AED",
    bg: "#F5F3FF",
    bgDark: "#0F0520",
    sistemPrompt:
      "Konu: saç dökülmesi. 'Dökülmeye bakalım.' de. Mikro otorite: 'Ani dökülme genelde hormonal veya beslenme kaynaklıdır, şampuandan değil.' Sor: ne zamandır, bölgesel mi yaygın mı, kepek veya kaşıntı var mı. Maks 3 soru, bekle.",
  },
  {
    id: "gunes",
    label: "Güneş Koruması",
    icon: "sun",
    renk: "#EA580C",
    bg: "#FFF7ED",
    bgDark: "#1C0A00",
    sistemPrompt:
      "Konu: güneş koruması. 'Güneş korumayı doğru kuralım.' de. Mikro otorite: 'SPF 30 yetmez — günlük için en az SPF 50 şart.' Sor: cilt tipi ne, kimyasal mı mineral mi, makyaj altına uyumlu olsun mu. Maks 3 soru, bekle.",
  },
  {
    id: "bariyer",
    label: "Cilt Bariyeri",
    icon: "shield",
    renk: "#0D9488",
    bg: "#F0FDFA",
    bgDark: "#041412",
    sistemPrompt:
      "Konu: cilt bariyeri. 'Bariyere bakalım.' de. Mikro otorite: 'Bariyer bozulmuşsa yeni aktif ekleme — önce onarım.' Sor: yanma mı gerginlik mi kızarıklık mı, retinol veya asit kullanıyor mu, kaç adımlı rutin var. Maks 3 soru, bekle.",
  },
  {
    id: "retinol",
    label: "Retinol Kullanımı",
    icon: "activity",
    renk: "#4F46E5",
    bg: "#EEF2FF",
    bgDark: "#0A0C20",
    sistemPrompt:
      "Konu: retinol. 'Retinola bakalım.' de. Mikro otorite: 'Retinol sabah kullanılmaz — UV fotodegredasyonu aktifi bozar.' Sor: daha önce kullandı mı, reaksiyon oldu mu, cilt hassas mı. Maks 3 soru, bekle.",
  },
  {
    id: "yaslanma",
    label: "Yaşlanma Karşıtı",
    icon: "clock",
    renk: "#7C3AED",
    bg: "#F5F3FF",
    bgDark: "#0F0520",
    sistemPrompt:
      "Konu: yaşlanma karşıtı bakım. 'Yaşlanma karşıtı rutine bakalım.' de. Mikro otorite: 'Anti-aging için en güçlü ikili: retinol + SPF — ikisi olmadan olmaz.' Sor: öncelik ne (ince çizgi / leke / sarkma), retinol deneyimi var mı, SPF düzenli mi. Maks 3 soru, bekle.",
  },
  {
    id: "hamilelik",
    label: "Hamilelikte Kullanım",
    icon: "alert-triangle",
    renk: "#B45309",
    bg: "#FFFBEB",
    bgDark: "#1C1000",
    sistemPrompt:
      "Konu: hamilelikte cilt bakımı. 'Güvenli bakıma bakalım.' de. Mikro otorite: 'Hamilelikte retinoid ve hidrokinon kesin yasak — güvenli alternatifler var.' Sor: hangi trimesterde, mevcut rutinde ne var, en çok ne sorunu var. Maks 3 soru, bekle.",
  },
  {
    id: "niacinamide",
    label: "İçerik Sorusu",
    icon: "book-open",
    renk: "#2563EB",
    bg: "#EFF6FF",
    bgDark: "#060C1A",
    sistemPrompt:
      "Konu: içerik sorusu. 'Hangi içeriği konuşalım?' diye sor. Kullanıcı söyleyince: mekanizmasını tek cümlede ver, çatıştığı içerikleri söyle, nasıl kullanılır — her biri tek cümle. Mikro otorite ekle. Uzatma.",
  },
];

// ── Hızlı Başlatıcılar ──────────────────────────────────────────────────────────

const HIZLI_BASLATICLAR = [
  "Cildim çok hassas, ne kullanmalıyım?",
  "Retinol başlangıcı için nasıl adapte olmalıyım?",
  "Akne izleri için ne yapabilirim?",
  "Niasinamid ile C vitamini birlikte kullanılır mı?",
  "Sabah ve gece rutinimde hangi sırayı izlemeliyim?",
  "Cildim yanıyor, bariyer bozulmuş olabilir mi?",
];

// ── Karar Ağacı Tipleri & Verileri ──────────────────────────────────────────

interface TreeOption { value: string; label: string; }
interface TreeQuestion { id: string; soru: string; altBilgi?: string; options: TreeOption[]; }
interface TreeProfile { severity: "düşük" | "orta" | "yüksek"; tolerance: "hassas" | "normal" | "güçlü"; priority: "onarım" | "kontrol" | "tedavi"; }
type RoutineRole = "Esas" | "Destek" | "İsteğe bağlı";
interface RoutineStep { category: string; role: RoutineRole; reason: string; icon: string; }

interface ProductCard {
  id: string; brand: string; name: string; gorsel_url?: string;
  average_price?: number; score?: number;
  active_ingredients?: string[]; contains_fragrance?: boolean; skin_types?: string[];
}
interface ProductSlot {
  slotId: string; slotLabel: string; role: RoutineRole; reason: string; products: ProductCard[];
}

interface ConcernTree {
  konuId: string;
  questions: TreeQuestion[];
  evaluate: (a: Record<string, string>) => TreeProfile & { systemContext: string };
  buildRoutine: (profile: TreeProfile, answers: Record<string, string>) => RoutineStep[];
}

const TREE_CONCERN_IDS = new Set(["akne", "leke", "hassas", "kuruluk", "yaglilik", "yaslanma"]);

// Anlık ilk mesajlar — API çağrısı olmadan gösterilir
const KONU_OPENING: Record<string, { selamlama: string; ilkSoru: string; secenekler: string[] }> = {
  roza: {
    selamlama: "Kızarıklığa birlikte bakalım.",
    ilkSoru: "Kızarıklık ne zaman en çok artıyor?",
    secenekler: ["Sürekli var", "Sıcakta artıyor", "Ürün sonrası", "Zaman zaman"],
  },
  sac: {
    selamlama: "Saç dökülmesini birlikte değerlendirelim.",
    ilkSoru: "Dökülme ne kadar süredir devam ediyor?",
    secenekler: ["1 aydan az", "1–6 ay", "6 aydan uzun", "Hep böyleydi"],
  },
  gunes: {
    selamlama: "Güneş korumayı doğru yapalım.",
    ilkSoru: "Ne tür güneş koruyucu arıyorsun?",
    secenekler: ["Hafif, iz bırakmayan", "Dış mekan / spor", "Makyaj altı uyumlu", "Hassas cilt için"],
  },
  bariyer: {
    selamlama: "Bariyeri birlikte toparlayalım.",
    ilkSoru: "Ciltte en çok hangisi var?",
    secenekler: ["Yanma / hassasiyet", "Gerginlik / çekme", "Kızarıklık", "Kuru yamalar"],
  },
  retinol: {
    selamlama: "Retinol yolculuğuna bakalım.",
    ilkSoru: "Retinol kullanım durumun nedir?",
    secenekler: ["Hiç kullanmadım", "Yeni başladım", "Reaksiyon oldu", "Düzenli kullanıyorum"],
  },
  hamilelik: {
    selamlama: "Hamilelikte güvenli bakıma bakalım.",
    ilkSoru: "Şu an hangi dönemdesin?",
    secenekler: ["1. trimester", "2. trimester", "3. trimester", "Emzirme dönemi"],
  },
  niacinamide: {
    selamlama: "İçerik hakkında konuşalım.",
    ilkSoru: "Ne hakkında bilgi almak istiyorsun?",
    secenekler: ["Aktif bileşen sorusu", "Kombinasyon uyumu", "Cilt tipime göre", "Yan etki / güvenlik"],
  },
  urunbul: {
    selamlama: "Sana uygun ürünü birlikte bulalım.",
    ilkSoru: "Cilt tipini nasıl tanımlarsın?",
    secenekler: ["Kuru", "Yağlı", "Karma", "Hassas"],
  },
};

const DECISION_TREES: Record<string, ConcernTree> = {
  // ── KURULUK ─────────────────────────────────────────────────────────────────
  kuruluk: {
    konuId: "kuruluk",
    questions: [
      { id: "ne_zaman", soru: "Çekme veya gerginliği ne zaman hissediyorsun?", options: [
        { value: "sabah", label: "Sabah uyanınca" },
        { value: "gun_ici", label: "Gün içinde giderek artar" },
        { value: "hep", label: "Hep var, sürekli" },
        { value: "mevsim", label: "Mevsimsel / Konuma bağlı" },
      ]},
      { id: "bolge", soru: "En çok hangi bölge etkileniyor?", options: [
        { value: "yanak", label: "Yanaklar" },
        { value: "goz_dudak", label: "Göz & dudak çevresi" },
        { value: "tum_yuz", label: "Tüm yüz" },
        { value: "alın", label: "Alın" },
      ]},
      { id: "tepki", soru: "Cildin bakım ürünlerine tepkisi?", options: [
        { value: "iyi", label: "Genelde iyi tolere ediyor" },
        { value: "bazen_yanar", label: "Bazen yanma / batma var" },
        { value: "reddeder", label: "Çoğu ürüne tepki veriyor" },
      ]},
      { id: "nemlendirici", soru: "Nemlendirici kullanımın nasıl?", options: [
        { value: "hic", label: "Kullanmıyorum" },
        { value: "gunde_bir", label: "Günde bir kez" },
        { value: "sabah_gece", label: "Sabah & gece" },
        { value: "cok_ama_az", label: "Sık kullanıyorum, yetmiyor" },
      ]},
      { id: "soyulma", soru: "Görünür soyulma veya pul var mı?", altBilgi: "Kuruluk şiddetini belirlememize yardımcı olur", options: [
        { value: "yok", label: "Hayır" },
        { value: "hafif", label: "Hafif (özellikle burun)" },
        { value: "belirgin", label: "Belirgin (yanak/çene)" },
        { value: "cok", label: "Ciddi, pullanıyor" },
      ]},
    ],
    evaluate(a) {
      const severe = a.soyulma === "cok" || a.tepki === "reddeder" || (a.soyulma === "belirgin" && a.nemlendirici === "hic");
      const mild = a.soyulma === "yok" && a.tepki === "iyi" && a.nemlendirici !== "hic";
      const severity = severe ? "yüksek" : mild ? "düşük" : "orta";
      const tolerance = a.tepki === "reddeder" ? "hassas" : a.tepki === "bazen_yanar" ? "normal" : "güçlü";
      const priority = a.tepki === "reddeder" ? "onarım" : a.nemlendirici === "hic" ? "kontrol" : "tedavi";
      return { severity, tolerance, priority, systemContext:
        `Kullanıcı profili (karar ağacı analizi):\n- Kuruluk zamanı: ${a.ne_zaman === "hep" ? "sürekli" : a.ne_zaman === "sabah" ? "sabah uyanınca" : a.ne_zaman === "gun_ici" ? "gün içinde artan" : "mevsimsel"}\n- Etkilenen bölge: ${a.bolge}\n- Ürün toleransı: ${tolerance}\n- Nemlendirici sıklığı: ${a.nemlendirici === "hic" ? "kullanmıyor" : a.nemlendirici}\n- Soyulma şiddeti: ${a.soyulma}\n- Sonuç: Şiddet=${severity}, Öncelik=${priority}\n\nBu profile göre klinik, pratik bir cevap ver. Ürün toleransı ${tolerance === "hassas" ? "çok düşük — bariyer onarımını önceliklendir" : "normal veya güçlü"}. Yeniden aynı soruları sormadan direkt öneri ver.` };
    },
    buildRoutine(p) {
      const steps: RoutineStep[] = [
        { category: "Yumuşak Temizleyici", role: "Esas", reason: "pH dengesini bozmadan seramidleri korur", icon: "droplet" },
        { category: "Nemlendirici / Bariyer Kremi", role: "Esas", reason: "Transepidermal su kaybını engeller, cildi yumuşatır", icon: "shield" },
        { category: "SPF 50+", role: "Esas", reason: "Güneş hasarı nem bariyerini daha da zayıflatır", icon: "sun" },
      ];
      if (p.severity !== "düşük") {
        steps.splice(1, 0, { category: "Hyalüronik Asit Serumu", role: "Destek", reason: "Derin katmanlara nem çeker ve kilitler", icon: "wind" });
      }
      if (p.severity === "yüksek") {
        steps.push({ category: "Yüz Yağı / Emollient", role: p.tolerance === "hassas" ? "Destek" : "İsteğe bağlı", reason: "Gece onarım katmanı; bariyer yenilenmesini hızlandırır", icon: "moon" });
      }
      if (p.tolerance !== "hassas" && p.severity !== "düşük") {
        steps.push({ category: "Seramid Krem (gece)", role: "İsteğe bağlı", reason: "Lipid bariyerini yapısal olarak tamir eder", icon: "layers" });
      }
      return steps.slice(0, 5);
    },
  },

  // ── AKNE ─────────────────────────────────────────────────────────────────────
  akne: {
    konuId: "akne",
    questions: [
      { id: "tur", soru: "Hangi tür sivilce daha baskın?", options: [
        { value: "komedon", label: "Siyah / beyaz nokta" },
        { value: "iltihapli", label: "Kırmızı, iltihaplı" },
        { value: "kistik", label: "Kistik, derin ağrılı" },
        { value: "karisik", label: "Hepsi karışık" },
      ]},
      { id: "bolge", soru: "Nereden çıkıyor?", options: [
        { value: "t_bolgesi", label: "Alın & burun (T-bölgesi)" },
        { value: "yanak", label: "Yanaklar" },
        { value: "cene_boyun", label: "Çene & boyun" },
        { value: "yaygın", label: "Yüzün her yeri" },
      ]},
      { id: "yag", soru: "Cildin yağlanması nasıl?", options: [
        { value: "kuru_normal", label: "Kuru veya normal" },
        { value: "orta", label: "Orta yağlı" },
        { value: "cok_yağlı", label: "Çok yağlı" },
        { value: "t_yağlı", label: "Sadece T-bölgesi yağlı" },
      ]},
      { id: "aktif_iz", soru: "Şu an ne ön planda?", options: [
        { value: "aktif", label: "Aktif sivilceler baskın" },
        { value: "iz", label: "İzler / kırmızı lekeler baskın" },
        { value: "ikisi", label: "İkisi de var" },
      ]},
      { id: "tetik", soru: "Tetikleyicini fark ettın mı?", options: [
        { value: "hormonal", label: "Hormonal dönemler" },
        { value: "stres", label: "Stres" },
        { value: "beslenme", label: "Beslenme" },
        { value: "bilmiyorum", label: "Fark etmiyorum" },
      ]},
    ],
    evaluate(a) {
      const severe = a.tur === "kistik" || a.yag === "cok_yağlı" || a.aktif_iz === "ikisi";
      const mild = a.tur === "komedon" && a.yag === "kuru_normal" && a.aktif_iz === "iz";
      const severity = severe ? "yüksek" : mild ? "düşük" : "orta";
      const tolerance = a.yag === "kuru_normal" ? "hassas" : a.yag === "t_yağlı" ? "normal" : "güçlü";
      const priority = a.aktif_iz === "iz" ? "tedavi" : a.tur === "kistik" ? "tedavi" : "kontrol";
      const bolgeStr = a.bolge === "t_bolgesi" ? "T-bölgesi" : a.bolge === "yanak" ? "yanaklar" : a.bolge === "cene_boyun" ? "çene-boyun" : "yaygın";
      return { severity, tolerance, priority, systemContext:
        `Kullanıcı profili (karar ağacı):\n- Akne türü: ${a.tur}\n- Bölge: ${bolgeStr}\n- Yağlanma: ${a.yag}\n- Ön plan: ${a.aktif_iz}\n- Tetikleyici: ${a.tetik}\n- Sonuç: Şiddet=${severity}, Tolerans=${tolerance}, Öncelik=${priority}\n\nÇene-boyun bölgesi hormonal akneye işaret eder. Kistik akne için OTC ötesi yönlendirme gerekebilir — bunu belirt. Yeniden sorgu sormadan direkt protokol öner.` };
    },
    buildRoutine(p, a) {
      const steps: RoutineStep[] = [
        { category: "Jel / Köpük Temizleyici", role: "Esas", reason: "Fazla sebumu temizler, gözenekleri tıkamaz", icon: "droplet" },
        { category: "Niasinamid Serumu (%10)", role: a.aktif_iz === "iz" ? "Esas" : "Destek", reason: "Sebum üretimini düzenler, iz ve kızarıklığı azaltır", icon: "activity" },
        { category: "Yağsız Nemlendirici", role: "Esas", reason: "Hidrasyon olmadan bariyer bozulur, akne kötüleşir", icon: "shield" },
        { category: "Non-comedogenic SPF", role: "Esas", reason: "Akne izlerini koyulaştırmaz, gözenek tıkamaz", icon: "sun" },
      ];
      if (p.severity !== "düşük" && p.tolerance !== "hassas") {
        steps.splice(2, 0, { category: "Salisilik Asit Toner / BHA (%2)", role: p.severity === "yüksek" ? "Destek" : "İsteğe bağlı", reason: "Gözenek içi birikintileri çözer, C. acnes üremesini baskılar", icon: "zap" });
      }
      if (p.tolerance === "hassas") {
        steps.splice(2, 0, { category: "Azelaik Asit (%10)", role: "Destek", reason: "Hafif BHA alternatifi; inflamasyonu ve iz oluşumunu azaltır", icon: "alert-circle" });
      }
      if (p.severity === "yüksek" && a.tur === "kistik") {
        steps.push({ category: "Bölgesel Benzoil Peroksit (%2.5)", role: "İsteğe bağlı", reason: "Aktif kistik bölgeleri hedefler; geniş alana uygulamaktan kaçın", icon: "crosshair" });
      }
      return steps.slice(0, 5);
    },
  },

  // ── LEKE ─────────────────────────────────────────────────────────────────────
  leke: {
    konuId: "leke",
    questions: [
      { id: "neden", soru: "Lekeler nasıl oluştu?", options: [
        { value: "gunes", label: "Güneş hasarı / yaşla" },
        { value: "pih", label: "Akne sonrası iz (PIH)" },
        { value: "hormonal", label: "Hormonal (melasma)" },
        { value: "bilmiyorum", label: "Bilmiyorum" },
      ]},
      { id: "sure", soru: "Ne zamandır var?", altBilgi: "Tedavi süresi ve derinliği için önemli", options: [
        { value: "yeni", label: "3 aydan az" },
        { value: "kisa", label: "3–12 ay" },
        { value: "uzun", label: "1–3 yıl" },
        { value: "eski", label: "3+ yıl, çok eski" },
      ]},
      { id: "spf", soru: "Güneş koruyucu kullanımın?", options: [
        { value: "her_gun", label: "Her gün SPF 30+" },
        { value: "bazen", label: "Arada sırada" },
        { value: "hayır", label: "Kullanmıyorum" },
      ]},
      { id: "ton", soru: "Genel cilt rengin?", altBilgi: "Tedavi yaklaşımını etkiler", options: [
        { value: "cok_acik", label: "Çok açık" },
        { value: "acik_orta", label: "Açık-orta" },
        { value: "orta", label: "Orta" },
        { value: "koyu", label: "Koyu / esmer" },
      ]},
      { id: "deneyim", soru: "Daha önce tedavi denedin mi?", options: [
        { value: "hayır", label: "Hayır, ilk kez" },
        { value: "kozmetik", label: "Asit / serum denedim" },
        { value: "dermatolog", label: "Dermatolog gördüm" },
        { value: "hepsi", label: "Her şeyi denedim, sonuç yok" },
      ]},
    ],
    evaluate(a) {
      const severe = a.sure === "eski" || a.deneyim === "hepsi" || a.spf === "hayır";
      const mild = a.sure === "yeni" && a.spf === "her_gun" && a.deneyim === "hayır";
      const severity = severe ? "yüksek" : mild ? "düşük" : "orta";
      const tolerance = a.ton === "koyu" ? "hassas" : a.ton === "cok_acik" ? "normal" : "normal";
      const priority = a.deneyim === "hepsi" ? "tedavi" : a.spf !== "her_gun" ? "kontrol" : "tedavi";
      return { severity, tolerance, priority, systemContext:
        `Kullanıcı profili (karar ağacı):\n- Leke nedeni: ${a.neden}\n- Süre: ${a.sure}\n- SPF alışkanlığı: ${a.spf}\n- Cilt tonu: ${a.ton}\n- Önceki deneyim: ${a.deneyim}\n- Sonuç: Şiddet=${severity}, Öncelik=${priority}\n\nÖnemli: ${a.spf !== "her_gun" ? "SPF kullanımı olmadan hiçbir leke tedavisi çalışmaz — bunu net vurgula." : "SPF kullanımı mevcut, doğrula ve aktif bileşene yönlendir."} ${a.ton === "koyu" ? "Koyu cilt tonu — yüksek konsantrasyonlu asitler hiperpigmentasyonu artırabilir, dikkatli seç." : ""} Yeniden soru sormadan protokol öner.` };
    },
    buildRoutine(p, a) {
      const spfRole: RoutineRole = a.spf !== "her_gun" ? "Esas" : "Esas";
      const cVitRole: RoutineRole = p.tolerance === "hassas" ? "Destek" : "Esas";
      const steps: RoutineStep[] = [
        { category: "Yumuşak Temizleyici", role: "Esas", reason: "Leke tedavisinde bariyer sağlıklı tutulmalıdır", icon: "droplet" },
        { category: "SPF 50+ Güneş Koruyucu", role: spfRole, reason: a.spf !== "her_gun" ? "EN KRİTİK ADIM — SPF olmadan hiçbir leke tedavisi çalışmaz" : "Lekelerin koyulaşmasını ve yeni oluşumu engeller", icon: "sun" },
        { category: p.tolerance === "hassas" ? "Azelaik Asit (%10–15)" : "C Vitamini Serumu (%10–15)", role: cVitRole, reason: p.tolerance === "hassas" ? "Melanin sentezini baskılar, hassas cilde uyumludur" : "Tirosinaz inhibisyonu ile melanin üretimini durdurur", icon: "zap" },
        { category: "Niasinamid Serumu (%5)", role: "Destek", reason: "Melanin transferini epidermal hücrelere engeller", icon: "activity" },
      ];
      if (p.severity !== "düşük" && p.tolerance !== "hassas") {
        steps.push({ category: "AHA Exfoliant (laktik / mandelik asit)", role: "İsteğe bağlı", reason: "Yüzeysel pigmenti pul dökümüyle uzaklaştırır", icon: "layers" });
      }
      if (a.ton === "koyu") {
        steps.push({ category: "Koyu Cilt Tonuna Uygun Formül Notu", role: "İsteğe bağlı", reason: "Yüksek asit konsantrasyonundan kaçın — PIH tetikleyebilir", icon: "alert-circle" });
      }
      return steps.slice(0, 5);
    },
  },

  // ── HASSASİYET/KIZARIKLIK ───────────────────────────────────────────────────
  hassas: {
    konuId: "hassas",
    questions: [
      { id: "tezahur", soru: "Kızarıklık nasıl tezahür ediyor?", options: [
        { value: "surekli", label: "Sürekli kırmızı / pembe" },
        { value: "tetik", label: "Sıcak, yemek sonrası artar" },
        { value: "urun", label: "Ürün kullanınca çıkıyor" },
        { value: "stres", label: "Stres / heyecanla çıkıyor" },
      ]},
      { id: "his", soru: "Hangi his en belirgin?", options: [
        { value: "yanma", label: "Yanma & batma" },
        { value: "kasınti", label: "Kaşıntı" },
        { value: "gerginlik", label: "Gerginlik & çekme" },
        { value: "gorsel", label: "Sadece görsel kızarıklık" },
      ]},
      { id: "urun_tolere", soru: "Bakım ürünleri nasıl hissettiriyor?", options: [
        { value: "iyi", label: "Çoğu iyi tolere ediyorum" },
        { value: "karisik", label: "Bazısı yakar, bazısı iyi" },
        { value: "cok_etkili", label: "Hepsi neredeyse etkiliyor" },
      ]},
      { id: "sure", soru: "Ne kadar zamandır bu durumdasın?", options: [
        { value: "hep", label: "Hep böyleydi" },
        { value: "birkaç_ay", label: "Son birkaç ay" },
        { value: "yeni", label: "Yeni başladı" },
        { value: "urun_sonrasi", label: "Ürün değişikliğinden beri" },
      ]},
    ],
    evaluate(a) {
      const severe = a.urun_tolere === "cok_etkili" || a.his === "yanma";
      const mild = a.urun_tolere === "iyi" && a.his === "gorsel";
      const severity = severe ? "yüksek" : mild ? "düşük" : "orta";
      const tolerance: TreeProfile["tolerance"] = a.urun_tolere === "cok_etkili" ? "hassas" : a.urun_tolere === "karisik" ? "normal" : "güçlü";
      const priority: TreeProfile["priority"] = a.sure === "urun_sonrasi" || a.urun_tolere === "cok_etkili" ? "onarım" : "kontrol";
      return { severity, tolerance, priority, systemContext:
        `Kullanıcı profili (karar ağacı):\n- Kızarıklık tipi: ${a.tezahur}\n- Belirgin his: ${a.his}\n- Ürün toleransı: ${tolerance}\n- Başlangıç: ${a.sure}\n- Sonuç: Şiddet=${severity}, Öncelik=${priority}\n\n${a.sure === "urun_sonrasi" ? "Ürün değişikliği tetikleyici — bariyer bozulması şüphesi yüksek. Rutin sadeleştirme öneri ver." : ""} ${a.tezahur === "surekli" ? "Sürekli kızarıklık rozaseyi düşündürür — bunu dikkatli şekilde belirt." : ""} Yeniden soru sormadan onarım protokolü öner.` };
    },
    buildRoutine(p, a) {
      const steps: RoutineStep[] = [
        { category: "Hassas Cilt Temizleyici (parfümsüz)", role: "Esas", reason: "Koku ve deterjan içermeyen formül bariyer bütünlüğünü korur", icon: "droplet" },
        { category: "Bariyer Onarım Kremi (seramid + pantenol)", role: "Esas", reason: "Hasarlı bariyer fonksiyonunu yeniden yapılandırır", icon: "shield" },
        { category: "Mineral Filtreli SPF (çinko oksit)", role: "Esas", reason: "Kimyasal filtreler hassas cilde reaktif olabilir; mineral daha güvenli", icon: "sun" },
      ];
      if (p.severity !== "düşük") {
        steps.splice(2, 0, { category: "Centella Asiatica / Madecassoside Serumu", role: "Destek", reason: "İnflamasyonu ve kızarıklığı yatıştırır, bariyer onarımını hızlandırır", icon: "activity" });
      }
      if (p.severity === "yüksek") {
        steps.splice(3, 0, { category: "Termal Su / Soothing Mist", role: "Destek", reason: "Akut reaktivite dönemlerinde anlık rahatlama ve nem sağlar", icon: "wind" });
      }
      if (a.sure === "urun_sonrasi") {
        steps.push({ category: "Rutin Sadeleştirme Notu", role: "İsteğe bağlı", reason: "Maksimum 3 ürüne indir; bariyer onarılınca yeni ürün ekle", icon: "alert-circle" });
      }
      return steps.slice(0, 5);
    },
  },

  // ── YAĞLILIK/GÖZENEK ─────────────────────────────────────────────────────────
  yaglilik: {
    konuId: "yaglilik",
    questions: [
      { id: "yag_zaman", soru: "Yağlanma ne zaman başlıyor?", options: [
        { value: "sabah_zaten", label: "Sabah zaten parlıyor" },
        { value: "2_3_saat", label: "2–3 saat sonra" },
        { value: "4_6_saat", label: "4–6 saat sonra" },
        { value: "sadece_t", label: "Sadece T-bölgesi" },
      ]},
      { id: "goz_deligi", soru: "Gözenekler sorun mu?", options: [
        { value: "yok", label: "Fark etmiyorum" },
        { value: "burun", label: "Sadece burun üstü" },
        { value: "t_geneli", label: "T-bölgesi geneli" },
        { value: "tum_yuz", label: "Tüm yüzde belirgin" },
      ]},
      { id: "akne", soru: "Sivilce eşlik ediyor mu?", options: [
        { value: "hayır", label: "Hayır" },
        { value: "arada", label: "Arada sırada" },
        { value: "evet", label: "Evet, düzenli" },
      ]},
      { id: "nemlendirici", soru: "Nemlendirici kullanıyor musun?", options: [
        { value: "hayır", label: "Hayır, zaten yağlı" },
        { value: "hafif_jel", label: "Hafif jel / su bazlı" },
        { value: "krem", label: "Krem kullanıyorum" },
      ]},
      { id: "makyaj", soru: "Makyaj / güneş kremi uyumu?", options: [
        { value: "kullanmiyorum", label: "Kullanmıyorum" },
        { value: "iyi", label: "İyi oturuyor" },
        { value: "kayiyor", label: "Kayıyor / dağılıyor" },
      ]},
    ],
    evaluate(a) {
      const severe = a.yag_zaman === "sabah_zaten" || a.goz_deligi === "tum_yuz";
      const mild = a.yag_zaman === "sadece_t" && a.goz_deligi === "yok";
      const severity = severe ? "yüksek" : mild ? "düşük" : "orta";
      const tolerance: TreeProfile["tolerance"] = a.nemlendirici === "hayır" ? "normal" : "güçlü";
      const priority: TreeProfile["priority"] = a.akne === "evet" ? "tedavi" : "kontrol";
      return { severity, tolerance, priority, systemContext:
        `Kullanıcı profili (karar ağacı):\n- Yağlanma zamanı: ${a.yag_zaman}\n- Gözenek durumu: ${a.goz_deligi}\n- Akne eşliği: ${a.akne}\n- Nemlendirici: ${a.nemlendirici}\n- Makyaj uyumu: ${a.makyaj}\n- Sonuç: Şiddet=${severity}, Öncelik=${priority}\n\n${a.nemlendirici === "hayır" ? "Nemlendirici kullanmıyor — bu aslında yağlanmayı artırır (compensatory sebum). Hafif, oil-free nemlendirici öncelikli." : ""} Yeniden soru sormadan hafif, porları minimize eden rutin öner.` };
    },
    buildRoutine(p, a) {
      const steps: RoutineStep[] = [
        { category: "Jel / Köpük Temizleyici (SLS-free)", role: "Esas", reason: "Sebumu kaldırır, cilt bariyerini bozmaz", icon: "droplet" },
        { category: "Niasinamid Serumu (%10)", role: "Esas", reason: "Sebum bezlerini düzenler, gözenek görünümünü azaltır", icon: "activity" },
        { category: "Yağsız Jel Nemlendirici", role: "Esas", reason: a.nemlendirici === "hayır" ? "Nemlendirme eksikliği compensatory sebum artışına yol açar" : "Hafif hidrasyon sebum üretimini dengeye getirir", icon: "shield" },
        { category: "Non-comedogenic SPF (jel/sıvı formül)", role: "Esas", reason: "Gözenek tıkamayan formül yağlı ciltle uyumludur", icon: "sun" },
      ];
      if (p.severity !== "düşük" || a.akne === "evet") {
        steps.splice(2, 0, { category: "BHA Toner (%2 Salisilik Asit)", role: p.tolerance === "hassas" ? "İsteğe bağlı" : "Destek", reason: "Gözenek içi yağı ve tıkanıklıkları çözer", icon: "zap" });
      }
      if (p.severity === "yüksek") {
        steps.push({ category: "Kil Maskesi (haftada 2×)", role: "İsteğe bağlı", reason: "Derin gözenek temizliği yapar, haftalık sebum kontrolü sağlar", icon: "layers" });
      }
      return steps.slice(0, 5);
    },
  },

  // ── YAŞLANMA KARŞITI ─────────────────────────────────────────────────────────
  yaslanma: {
    konuId: "yaslanma",
    questions: [
      { id: "endise", soru: "Öncelikli endişen ne?", options: [
        { value: "ince_cizgi", label: "İnce çizgiler" },
        { value: "derin_kirisik", label: "Derin kırışıklar" },
        { value: "sarkma", label: "Sarkma / gevşeme" },
        { value: "ton_parlaklik", label: "Cilt tonu & parlaklık" },
      ]},
      { id: "yas", soru: "Yaş aralığın?", options: [
        { value: "20_30", label: "20 – 30" },
        { value: "30_40", label: "30 – 40" },
        { value: "40_50", label: "40 – 50" },
        { value: "50_plus", label: "50+" },
      ]},
      { id: "retinol", soru: "Retinol / retinoid kullanımın?", options: [
        { value: "hic", label: "Hiç denemem" },
        { value: "denemek", label: "Denemek istiyorum" },
        { value: "dusuk_doz", label: "Düşük doz kullanıyorum" },
        { value: "aktif", label: "Aktif / üst doz kullanıcısı" },
      ]},
      { id: "cilt_tipi", soru: "Cilt tipin?", options: [
        { value: "kuru", label: "Kuru" },
        { value: "normal", label: "Normal" },
        { value: "karma", label: "Karma" },
        { value: "yagli", label: "Yağlı" },
      ]},
      { id: "spf", soru: "Güneş koruyucu rutinin?", options: [
        { value: "her_gun", label: "Her gün SPF 30+" },
        { value: "cogu_gun", label: "Çoğu gün" },
        { value: "arada", label: "Arada sırada" },
        { value: "hayır", label: "Kullanmıyorum" },
      ]},
    ],
    evaluate(a) {
      const severe = a.yas === "50_plus" || (a.endise === "sarkma" && a.retinol === "hic");
      const mild = a.yas === "20_30" && a.endise === "ince_cizgi" && a.spf === "her_gun";
      const severity = severe ? "yüksek" : mild ? "düşük" : "orta";
      const tolerance: TreeProfile["tolerance"] = a.cilt_tipi === "kuru" && a.retinol === "hic" ? "hassas" : "normal";
      const priority: TreeProfile["priority"] = a.spf !== "her_gun" ? "kontrol" : a.retinol === "hic" || a.retinol === "denemek" ? "onarım" : "tedavi";
      return { severity, tolerance, priority, systemContext:
        `Kullanıcı profili (karar ağacı):\n- Öncelikli endişe: ${a.endise}\n- Yaş aralığı: ${a.yas}\n- Retinol deneyimi: ${a.retinol}\n- Cilt tipi: ${a.cilt_tipi}\n- SPF rutini: ${a.spf}\n- Sonuç: Şiddet=${severity}, Tolerans=${tolerance}, Öncelik=${priority}\n\n${a.spf !== "her_gun" ? "SPF kullanımı yetersiz — güneş hasarı tüm anti-aging çalışmalarını etkisizleştirir. Net vurgula." : ""} ${a.retinol === "hic" ? "Retinol deneyimi yok — adaptasyon protokolüyle başlangıç rehberliği ver." : a.retinol === "aktif" ? "Aktif retinoid kullanıcısı — peptid, antioksidan ve destek ürünlere odaklan." : ""} Yeniden soru sormadan kanıta dayalı anti-aging protokol öner.` };
    },
    buildRoutine(p, a) {
      const retinolExpYok = a.retinol === "hic";
      const retinolDenemek = a.retinol === "denemek";
      const retinolAktif = a.retinol === "aktif";
      const dusukDoz = a.retinol === "dusuk_doz";
      const hassasCilt = p.tolerance === "hassas";
      const steps: RoutineStep[] = [
        { category: "Yumuşak Temizleyici", role: "Esas", reason: "Anti-aging aktifler bariyere baskı yapar; temizleyici hafif olmalı", icon: "droplet" },
        { category: "SPF 50+ Güneş Koruyucu", role: "Esas", reason: a.spf !== "her_gun" ? "EN KRİTİK ADIM — güneş hasarı retinolün etkisini sıfırlar" : "Tüm anti-aging protokolünün vazgeçilmez temelidir", icon: "sun" },
        { category: "Zenginleştirilmiş Nemlendirici", role: "Esas", reason: "Retinol ve diğer aktifler nedeniyle artan kuruluk ve soyulmayı önler", icon: "shield" },
      ];
      if (retinolAktif) {
        steps.splice(1, 0, { category: "Retinoid / Retinoik Asit (gece)", role: "Esas", reason: "Kollajen sentezini uyarır, kırışık derinliğini ve yaşlılık lekelerini azaltır", icon: "moon" });
        steps.splice(1, 0, { category: "C Vitamini Serumu (%15–20, sabah)", role: "Esas", reason: "Gündüz antioksidan kalkanı; gece retinolünü tamamlar", icon: "zap" });
        steps.push({ category: "Peptid Serumu", role: "Destek", reason: "Matriks proteinlerini destekler; retinol irritasyonunu yumuşatır", icon: "activity" });
      } else if (dusukDoz) {
        steps.splice(1, 0, { category: "Retinol (%0.3–0.5, gece)", role: "Destek", reason: "Kollajen yenilenmesini başlatır; hücre döngüsünü hızlandırır", icon: "moon" });
        steps.splice(1, 0, { category: "C Vitamini Serumu (sabah)", role: "Esas", reason: "Retinol ile sinerji; sabah antioksidan, gece hücre yenileme", icon: "zap" });
      } else if (retinolDenemek && !hassasCilt) {
        steps.push({ category: "Retinol Başlangıç (%0.1–0.25, haftada 2–3×)", role: "İsteğe bağlı", reason: "Adaptasyon protokolüyle başla: 2 hafta bekle, irritasyon yoksa sıklaştır", icon: "moon" });
        steps.push({ category: "Bakuchiol Serumu", role: "Destek", reason: "Bitkisel retinol alternatifi; adaptasyon sürecinde güvenli destek sağlar", icon: "leaf" });
      } else if (retinolExpYok || hassasCilt) {
        steps.push({ category: "Bakuchiol Serumu", role: hassasCilt ? "Esas" : "Destek", reason: hassasCilt ? "Hassas ciltte retinol yerine tercih edilmeli; eşdeğer anti-aging etki" : "Retinol yolculuğuna başlamadan önce güvenli köprü bileşeni", icon: "leaf" });
      }
      if (p.severity === "yüksek") {
        steps.push({ category: "Göz Çevresi Kremi (peptid/kafein)", role: "İsteğe bağlı", reason: "Göz altı çizgi ve morluklarını hedefler; ince cilde özel formül", icon: "circle" });
        if (!hassasCilt) {
          steps.push({ category: "AHA Exfoliant (glikolik/laktik, haftada 1–2×)", role: "İsteğe bağlı", reason: "Yüzeysel ölü hücreleri uzaklaştırır; parlak, düzgün yüzey sağlar", icon: "layers" });
        }
      }
      return steps.slice(0, 5);
    },
  },
};

// ── Rutin Değerlendirme Adımları ─────────────────────────────────────────────

const RUTIN_ADIMLAR = [
  { id: "sabah", label: "Sabah rutini ürünlerin", placeholder: "Örn: yüz temizleyici, C vitamini serumu, güneş kremi" },
  { id: "gece", label: "Gece rutini ürünlerin", placeholder: "Örn: yüz yıkama, retinol, nemlendirici" },
  { id: "cilt_tipi", label: "Cilt tipin", placeholder: "Kuru / yağlı / karma / hassas / normal" },
  { id: "endise", label: "Ana endişen", placeholder: "Akne, leke, kuruluk, kızarıklık vb." },
];

// ── AI Mesaj Ayrıştırıcı & Premium Bubble ────────────────────────────────────

type AIBlock =
  | { t: "header";        text: string }
  | { t: "bullet";        text: string }
  | { t: "numbered";      text: string; n: number }
  | { t: "micro";         text: string }
  | { t: "para";          text: string }
  | { t: "product_slot";  hint: string }
  | { t: "soft_product";  brand: string; name: string; desc?: string };

// ── Soft product detection (marka + ürün desenini düz metinden yakalar) ──
// Eczane/dermokozmetik ana markalar — DB'de olmasa bile pasif kart basılır.
const KNOWN_BRANDS = [
  "La Roche-Posay", "La Roche Posay",
  "Avène", "Avene",
  "Bioderma", "Uriage", "Eucerin", "Mustela", "Vichy",
  "CeraVe", "Cerave",
  "SVR", "ISDIN", "Klorane", "Ducray", "Sebamed",
  "COSRX", "Paula's Choice", "SkinCeuticals", "Skinceuticals",
  "Neutrogena", "Clinique", "Kiehl's", "Kiehls",
  "The Ordinary", "Drunk Elephant",
  "NIVEA", "Nivea", "The Purest Solutions", "Dalin", "Cire Aseptine",
  "Garnier", "L'Oréal", "L'Oreal", "Loreal",
];

function tryParseSoftProduct(rawLine: string): { brand: string; name: string; desc?: string } | null {
  let l = rawLine.trim();
  // Bullet/numbered marker temizle
  l = l.replace(/^([•\-*]\s+|\d+\.\s+)/, "");
  // Sarmalayan ** temizle
  l = l.replace(/^\*\*/, "").replace(/\*\*$/, "").trim();
  // Sondaki : temizle (ör: "**Bioderma Atoderm:**")
  l = l.replace(/:$/, "").trim();
  if (!l) return null;

  for (const brand of KNOWN_BRANDS) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^(${escaped})\\s+(.+)$`, "i");
    const m = l.match(re);
    if (!m) continue;

    let rest = m[2];
    let desc: string | undefined;

    // Ayraç (— : • ·  veya  " - ") varsa açıklamayı ayır
    const sepRe = /\s+[—:•·]\s+|\s+-\s+/;
    const sepMatch = rest.match(sepRe);
    if (sepMatch && sepMatch.index !== undefined && sepMatch.index > 0) {
      desc = rest.slice(sepMatch.index + sepMatch[0].length).trim().replace(/[.,;]+$/, "");
      rest = rest.slice(0, sepMatch.index).trim();
    }

    // Ürün adı: title-case / digit / +/- ile devam eden token zinciri
    const words = rest.split(/\s+/);
    const productWords: string[] = [];
    for (const w of words) {
      if (productWords.length === 0) {
        if (!/^[A-ZÇĞİÖŞÜ\d]/.test(w)) break;
      } else if (
        !/^[A-ZÇĞİÖŞÜ\d]/.test(w) &&
        !/[+\-]/.test(w) &&
        !/^[A-ZÇĞİÖŞÜ]+$/.test(w)
      ) break;
      productWords.push(w);
      if (productWords.length >= 6) break;
    }
    if (productWords.length === 0) return null;
    const name = productWords.join(" ").replace(/[.,;:*]+$/, "").trim();
    if (!name) return null;

    return { brand, name, desc };
  }
  return null;
}

// ECZ4 RELEASE QA: marker leak savunması — [ÜRÜN:...] / [URUN:...] / [PRODUCT:...]
// işaretleyicileri inline geçse bile asla ham metin olarak render edilmemeli.
// Genel global regex: standalone satırda da, paragraf içinde de yakalar.
const PRODUCT_MARKER_RE = /\[(?:ÜRÜN|URUN|PRODUCT)\s*:\s*([^\]]+)\]/gi;

function parseAIBlocks(content: string): AIBlock[] {
  const blocks: AIBlock[] = [];

  const pushTextLine = (l: string): void => {
    if (!l) return;
    if (/^[-━═─]{3,}$/.test(l)) return;                    // decorative line → skip
    // Soft product: bilinen marka + Title-case ürün adı (DB'siz pasif kart)
    const soft = tryParseSoftProduct(l);
    if (soft) {
      blocks.push({ t: "soft_product", brand: soft.brand, name: soft.name, desc: soft.desc });
      return;
    }
    if (/^\*\*[^*]{1,60}\*\*:?$/.test(l)) {
      blocks.push({ t: "header", text: l.replace(/\*\*/g, "").replace(/:$/, "") });
      return;
    }
    if (l.length <= 48 && l.endsWith(":") && !/^[•\-*\d]/.test(l)) {
      blocks.push({ t: "header", text: l });
      return;
    }
    const bulletM = l.match(/^[•\-*]\s+(.+)/);
    if (bulletM) {
      blocks.push({ t: "bullet", text: bulletM[1].replace(/\*\*/g, "") });
      return;
    }
    const numM = l.match(/^(\d+)\.\s+(.+)/);
    if (numM) {
      blocks.push({ t: "numbered", text: numM[2].replace(/\*\*/g, ""), n: parseInt(numM[1]) });
      return;
    }
    if (blocks.length > 0 && l.split(/\s+/).length <= 5 && /[.!]$/.test(l)) {
      blocks.push({ t: "micro", text: l });
      return;
    }
    blocks.push({ t: "para", text: l.replace(/\*\*/g, "") });
  };

  for (const raw of content.split("\n")) {
    let line = raw.trim();
    if (!line) continue;

    // 1) İnline / standalone marker'ları çıkart, slot'a çevir, metinden temizle.
    const inlineMarkers: string[] = [];
    PRODUCT_MARKER_RE.lastIndex = 0;
    line = line.replace(PRODUCT_MARKER_RE, (_full, hint: string) => {
      const h = String(hint ?? "").trim();
      if (h) inlineMarkers.push(h);
      return "";
    });
    // 2) Marker temizlendikten sonra kalan deflection-tipi kelimeleri sessizce sil
    //    ("markör", "marker", "product_slot") — yine de kullanıcıya sızmasın.
    if (inlineMarkers.length > 0) {
      line = line
        .replace(/\bmarkör(?:üyle|ünden|le|den|ü)?\b/gi, "")
        .replace(/\bmarker\b/gi, "")
        .replace(/\bproduct[_\s]?slot\b/gi, "")
        .replace(/\bzaten\s+(?:karttan|kart\s+olarak|gösterildi|kartta)\b[^.!?]*[.!?]?/gi, "");
    }
    line = line.replace(/\s{2,}/g, " ").replace(/^[\s,;:·•\-]+|[\s,;:·•\-]+$/g, "").trim();

    // 3) Önce kalan metin (varsa), sonra slot blokları — okuma akışı korunur.
    pushTextLine(line);
    for (const hint of inlineMarkers) blocks.push({ t: "product_slot", hint });
  }
  return blocks;
}

function AIBubbleContent({
  content,
  streaming,
  colors,
  isDark,
  accent,
}: {
  content: string;
  streaming?: boolean;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
  accent: string;
}) {
  const blocks   = parseAIBlocks(content);
  const textClr  = colors.text;
  const headClr  = isDark ? "#9DB88D" : "#3D5030";
  const cursor   = <Text style={{ opacity: 0.4 }}> ▊</Text>;

  if (blocks.length === 0) {
    return streaming ? <Text style={{ opacity: 0.4, color: textClr }}> ▊</Text> : null;
  }

  // ECZ4 STRICT AUDIENCE FIX: birbirini takip eden soft_product bloklarını
  // SoftProductGroup'a topla → DB-hit'ler pasif miss'lerin üstüne sıralanır.
  type RenderUnit =
    | { kind: "block"; block: AIBlock; idx: number }
    | { kind: "soft_group"; items: Array<{ brand: string; name: string; desc?: string }>; idx: number };
  const units: RenderUnit[] = [];
  let buf: Array<{ brand: string; name: string; desc?: string }> = [];
  const flushBuf = (idx: number) => {
    if (buf.length === 0) return;
    units.push({ kind: "soft_group", items: buf, idx });
    buf = [];
  };
  blocks.forEach((b, i) => {
    if (b.t === "soft_product") {
      buf.push({ brand: b.brand, name: b.name, desc: b.desc });
    } else {
      flushBuf(i);
      units.push({ kind: "block", block: b, idx: i });
    }
  });
  flushBuf(blocks.length);

  return (
    <View style={{ gap: 5 }}>
      {units.map((u) => {
        if (u.kind === "soft_group") {
          return <SoftProductGroup key={`sg-${u.idx}`} items={u.items} isDark={isDark} />;
        }
        const block = u.block;
        const i = u.idx;
        const isLast = i === blocks.length - 1;
        const tail   = streaming && isLast ? cursor : null;
        switch (block.t) {
          case "header":
            return (
              <Text key={i} style={[abStyles.header, { color: headClr }]}>
                {block.text}
              </Text>
            );
          case "bullet":
            return (
              <View key={i} style={abStyles.bulletRow}>
                <Text style={[abStyles.bulletDot, { color: accent }]}>·</Text>
                <Text style={[abStyles.bulletText, { color: textClr }]}>{block.text}{tail}</Text>
              </View>
            );
          case "numbered":
            return (
              <View key={i} style={abStyles.numRow}>
                <Text style={[abStyles.numBadge, { color: accent }]}>{block.n}.</Text>
                <Text style={[abStyles.numText, { color: textClr }]}>{block.text}{tail}</Text>
              </View>
            );
          case "micro":
            return (
              <Text key={i} style={[abStyles.micro, { color: isDark ? "#9DB88D" : accent }]}>
                {block.text}{tail}
              </Text>
            );
          case "product_slot":
            return (
              <InlineProductSlot
                key={`ps-${i}-${block.hint}`}
                hint={block.hint}
                streaming={streaming}
                isDark={isDark}
              />
            );
          case "soft_product":
            // Buraya düşmez — soft_product blokları yukarıda SoftProductGroup'a
            // toplandı. TS narrowing için exhaustive case.
            return null;
          case "para":
          default:
            return (
              <Text key={i} style={[abStyles.para, { color: textClr }]}>
                {(block as { text: string }).text}{tail}
              </Text>
            );
        }
      })}
    </View>
  );
}

// ── Ürün Segment Meta ─────────────────────────────────────────────────────────

const SEG_META: Record<"ekonomik" | "profesyonel" | "seckin", { label: string; bg: string; lightText: string; darkBg: string }> = {
  ekonomik:    { label: "Eko",    bg: "#EBF0E8", lightText: "#4A6A3A", darkBg: "rgba(74,106,58,0.16)"   },
  profesyonel: { label: "Pro",    bg: "#E4EFF6", lightText: "#2A5480", darkBg: "rgba(42,84,128,0.18)"   },
  seckin:      { label: "Seçkin", bg: "#F5EAD8", lightText: "#8A5A1A", darkBg: "rgba(184,150,90,0.20)"  },
};

function resolveSegMeta(segment?: string) {
  const s = (segment ?? "").toLowerCase();
  if (s.includes("seç") || s.includes("sec")) return SEG_META.seckin;
  if (s.includes("prof"))                      return SEG_META.profesyonel;
  return SEG_META.ekonomik;
}

// ── ECZ4 Issue F: STRICT PRODUCT MATCHING GUARD ──────────────────────────────
// AI metni ya da CATEGORY_ANCHORS ön-filtresi bazen yanlış kategoriden ürün döndürür
// (Örn: "Mustela Hydra Bébé Facial Cream" önerilirken DB'den Sun Lotion gelmesi).
// Bu guard, önerilen-text intent'ini aday ürünün sınıfı ile karşılaştırır; HARD
// kategori çatışması varsa kart pasifleştirilir → "uygulamada yer almıyor" durumu.
// Tüm helpers SAF — backend / scoring / Supabase / image pipeline'a dokunmaz.

type DermoIntent =
  | "moisturizer" | "sunscreen" | "aftersun" | "niacinamide" | "vitamin_c"
  | "retinol" | "cleanser" | "serum" | "hair" | "unknown";

const _stripDiacritics = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/İ/g, "i");

const normalizeIntentText = (s: string | null | undefined): string =>
  _stripDiacritics(String(s ?? "")).toLowerCase().replace(/\s+/g, " ").trim();

// Öncelik sırası: spesifik (hair / aftersun / sunscreen / aktif maddeler) →
// genel (cleanser / serum / moisturizer). İlk eşleşen kazanır.
const INTENT_TOKEN_TABLE: Array<{ intent: DermoIntent; tokens: string[] }> = [
  { intent: "hair",        tokens: ["sac kremi", "shampoo", "sampuan", "conditioner", "scalp", "kepek", "hair"] },
  { intent: "aftersun",    tokens: ["after sun", "aftersun", "gunes sonrasi", "after-sun", "soothing after"] },
  { intent: "sunscreen",   tokens: ["sunscreen", "spf", "sun protection", "very high protection", "gunes kremi", "gunes losyonu", "uv koruyucu", "sun lotion", "sun fluid"] },
  { intent: "niacinamide", tokens: ["niacinamide", "niasinamid", "niacin"] },
  { intent: "vitamin_c",   tokens: ["vitamin c", "c vitamini", "ascorbic", "ascorbyl", "ethyl ascorbic"] },
  { intent: "retinol",     tokens: ["retinol", "retinal", "retinoid", "retinyl"] },
  { intent: "cleanser",    tokens: ["cleanser", "temizleyici", "yuz yikama", "face wash", "kopuk", "foam wash", "micel", "cleansing gel", "yikama jeli"] },
  { intent: "serum",       tokens: ["serum", "ampul", "ampoule", "concentrate"] },
  { intent: "moisturizer", tokens: ["moisturizer", "moisturising", "moisturizing", "hydrating", "hydra", "nemlendirici", "krem", "cream", "lotion", "balm", "emollient", "bariyer", "barrier", "stelatopia", "atoderm", "facial cream", "yuz kremi"] },
];

function inferProductIntent(text: string | null | undefined): DermoIntent {
  const t = ` ${normalizeIntentText(text)} `;
  if (t.trim().length === 0) return "unknown";
  for (const { intent, tokens } of INTENT_TOKEN_TABLE) {
    for (const tok of tokens) {
      const needle = ` ${normalizeIntentText(tok)} `;
      // tek kelimelik token'lar için kelime-sınırlı kontrol; çok-kelimeliler için
      // direct includes (zaten boşluklu).
      if (t.includes(needle)) return intent;
    }
  }
  return "unknown";
}

function classifyProductCandidate(p: V2DBProduct): DermoIntent {
  const blob = `${p.name ?? ""} ${p.category ?? ""} ${p.short_benefit ?? ""}`;
  return inferProductIntent(blob);
}

// HARD conflict tablosu — aynı satırdaki sınıflar UYUMSUZDUR.
const HARD_CONFLICT: Record<DermoIntent, DermoIntent[]> = {
  moisturizer: ["sunscreen", "aftersun", "cleanser", "hair"],
  sunscreen:   ["moisturizer", "aftersun", "cleanser", "hair", "serum"],
  aftersun:    ["sunscreen", "cleanser", "hair", "serum"],
  cleanser:    ["moisturizer", "sunscreen", "serum", "hair", "aftersun"],
  serum:       ["sunscreen", "cleanser", "hair", "aftersun"],
  hair:        ["moisturizer", "sunscreen", "cleanser", "serum", "niacinamide", "vitamin_c", "retinol", "aftersun"],
  niacinamide: ["sunscreen", "hair", "cleanser", "aftersun"],
  vitamin_c:   ["sunscreen", "hair", "cleanser", "aftersun"],
  retinol:     ["sunscreen", "hair", "cleanser", "aftersun"],
  unknown:     [],
};

const ACTIVE_INTENTS: DermoIntent[] = ["niacinamide", "vitamin_c", "retinol"];

// ── ECZ4 STRICT AUDIENCE + USE-CONTEXT GUARD ─────────────────────────────────
// Mevcut intent guard ürün KATEGORİSİNİ doğrular ama HEDEF KİTLE (bebek vs yetişkin)
// ve KULLANIM BAĞLAMI'nı (after-sun vs acne-post-treatment) ayırt etmiyordu. Örn:
// "Bebekler için güneş sonrası" istenince Avène Cleanance Hydra (akne sonrası kuruluk
// kremi) tıklanabilir kart oluyordu — tehlikeli yanlış eşleşme.
type DermoAudience = "baby_child" | "unknown";

const AUDIENCE_BABY_TOKENS: string[] = [
  "bebek", "bebekler", "baby", "babies", "bebe", "bébé", "cocuk", "çocuk",
  "child", "children", "kids", "kid", "pediatrik", "pediatric",
  "stelatopia", "baby skin", "bebe skin", "yenidogan", "yenidoğan",
  "newborn", "infant", "abcderm", "pediatril", "0-3 yas", "0-12 ay",
];

function inferAudienceIntent(text: string | null | undefined): DermoAudience {
  const t = ` ${normalizeIntentText(text)} `;
  for (const tok of AUDIENCE_BABY_TOKENS) {
    const n = normalizeIntentText(tok);
    if (n && t.includes(n)) return "baby_child";
  }
  return "unknown";
}

function classifyProductAudience(p: V2DBProduct): DermoAudience {
  const blob = `${p.name ?? ""} ${p.brand ?? ""} ${p.category ?? ""} ${p.short_benefit ?? ""}`;
  return inferAudienceIntent(blob);
}

// Akne/post-akne tedavi sonrası kuruluk ürünleri — bebek bakımı veya nötr after-sun
// için ASLA gösterilmemeli. Cleanance Hydra, Effaclar H, Sebium Hydra gibi.
const ACNE_POST_TREATMENT_TOKENS: string[] = [
  "cleanance", "effaclar", "sebium", "hyseac", "acnomega",
  "anti acne", "anti-acne", "akne", "acne", "sivilce",
  "post acne", "post-acne", "purifying", "blemish",
];

// Yetişkin aktif/anti-aging ürünleri — bebek/çocuk için ASLA.
const ADULT_ACTIVE_TOKENS: string[] = [
  "anti-aging", "anti aging", "anti-age", "kirisiklik", "kırışıklık",
  "redermic", "liftactiv", "retinol", "retinal", "retinoid",
  "anti-wrinkle", "yas karsiti", "yaş karşıtı", "hyalu b5", "lift",
];

function isAcneOrAdultActiveProduct(p: V2DBProduct): boolean {
  const blob = normalizeIntentText(`${p.name ?? ""} ${p.category ?? ""} ${p.short_benefit ?? ""}`);
  if (!blob) return false;
  for (const t of ACNE_POST_TREATMENT_TOKENS) {
    const n = normalizeIntentText(t);
    if (n && blob.includes(n)) return true;
  }
  for (const t of ADULT_ACTIVE_TOKENS) {
    const n = normalizeIntentText(t);
    if (n && blob.includes(n)) return true;
  }
  return false;
}

interface MatchSafeArgs {
  recommendedBrand?: string | null;
  recommendedName?: string | null;
  recommendedDesc?: string | null;
  /** Opsiyonel: kullanıcının sorduğu bağlamdan gelen ek hint (chat son user msg). */
  audienceHint?: string | null;
  product: V2DBProduct;
}

function isDermoProductMatchSafe({
  recommendedBrand, recommendedName, recommendedDesc, audienceHint, product,
}: MatchSafeArgs): boolean {
  // A) Brand uyumu — recommended brand belliyse iki yönlü includes ile kontrol
  //    (DB'de "La Roche-Posay" vs AI "La Roche Posay" gibi varyasyonları tolere et).
  if (recommendedBrand && recommendedBrand.trim()) {
    if (!product.brand) return false;
    const rb = normalizeIntentText(recommendedBrand);
    const pb = normalizeIntentText(product.brand);
    if (rb && pb && !pb.includes(rb) && !rb.includes(pb)) return false;
  }

  // B) Intent inference — önerilen text'ten (name + desc) ve adaydan ayrı ayrı
  const recBlob = `${recommendedName ?? ""} ${recommendedDesc ?? ""}`;
  const recIntent = inferProductIntent(recBlob);
  const candIntent = classifyProductCandidate(product);

  // C) Audience guard — bebek/çocuk bağlamında adult/akne tedavisi ürünü ASLA.
  //    Audience hem öneri text'inden hem ek hint'ten kontrol edilir; biri yeterli.
  const recAudience = inferAudienceIntent(`${recBlob} ${audienceHint ?? ""}`);
  if (recAudience === "baby_child") {
    const candAudience = classifyProductAudience(product);
    if (candAudience !== "baby_child") return false;
    if (isAcneOrAdultActiveProduct(product)) return false;
  }

  // D) Aftersun bağlamı — akne-tedavi ürünü kesin yasak (Cleanance Hydra gibi).
  if (recIntent === "aftersun" && isAcneOrAdultActiveProduct(product)) return false;

  // Önerilen text intent'i çıkmadıysa (zayıf sinyal) — brand match + audience yeterli.
  if (recIntent === "unknown") return true;

  // E) HARD conflict
  if (HARD_CONFLICT[recIntent].includes(candIntent)) return false;

  // F) Aktif madde isteği için sıkı kural — niacinamide/vitamin_c/retinol istendiyse
  //    aday ya aynı aktifi taşımalı ya da generic kart-türü olmamalı.
  if (ACTIVE_INTENTS.includes(recIntent)) {
    if (candIntent === recIntent) return true;
    // Generic kart türleri (moisturizer/serum/cleanser/unknown) — aktif belirtilmemiş,
    // pasif kart daha güvenli.
    if (candIntent === "moisturizer" || candIntent === "serum" || candIntent === "cleanser" || candIntent === "unknown") {
      return false;
    }
  }

  return true;
}

// ECZ4 Issue F: kart visible olur olmaz idempotent eager prefetch.
// Set ile id-başına tek kez → onPress'te zaten cache hot olur, görsel anında gelir.
const dermoPrefetchedIds = new Set<string>();
function eagerPrefetchOnce(p: V2DBProduct | null | undefined): void {
  if (!p?.id || dermoPrefetchedIds.has(p.id)) return;
  dermoPrefetchedIds.add(p.id);
  try { prefetchProductHeroImage(p as any); } catch { /* sessizce geç */ }
}

// ── ECZ4 UNIFIED DERMO PRODUCT CONTRACT ───────────────────────────────────────
// Tüm DermoAsistan ürün kartları (ProductMiniCard, SoftProductCard,
// SoftProductGroup, InlineProductSlot, RoutinePreviewScreen chip'leri) bu
// helper kontratını kullanır. Tek noktadan: sticky audience guard +
// prefetch + setNavigationProduct + router.push(source:"danisma").

// Module-level sticky audience hint — `gonder()` pozitif sinyalde günceller,
// generic follow-up'larda ("başka seçenek?", "yok", "hadi") DEĞİŞMEZ.
let stickyAudienceHint = "";
function getStickyAudienceHint(): string { return stickyAudienceHint; }

// Pozitif bağlam token'ları — hint'i sadece bunlardan biri yakalanırsa yenile.
const STICKY_POSITIVE_TOKENS: string[] = [
  ...AUDIENCE_BABY_TOKENS,
  "aftersun", "after sun", "after-sun", "gunes sonrasi", "güneş sonrası",
  "gunes kremi", "güneş kremi", "sunscreen", "spf", "uv",
  "sac", "saç", "hair", "shampoo", "şampuan", "sampuan",
  "niasinamid", "niacinamide", "vitamin c", "vit c", "askorbik",
  "retinol", "retinal", "retinoid",
  "akne sonrasi", "akne sonrası", "post akne", "post-akne", "post acne",
  "nemlendirici", "moisturizer", "moisturiser", "krem", "cream",
  "temizleyici", "cleanser", "kopuk", "köpük", "jel temizle",
  "serum", "ampul", "ampoule",
];

function updateStickyAudienceFromUser(text: string | null | undefined): void {
  if (!text) return;
  const t = ` ${normalizeIntentText(text)} `;
  for (const tok of STICKY_POSITIVE_TOKENS) {
    const n = normalizeIntentText(tok);
    if (!n) continue;
    // Önce kelime sınırlı strict match (kısa token'larda false-positive önler:
    // "spf" → " spf " evet, ama "speci" içinde değil); olmazsa çok-kelimeli
    // ifadeler için (örn. "after sun") substring fallback.
    const strict = t.includes(` ${n} `);
    const loose = n.includes(" ") && t.includes(n);
    if (strict || loose) {
      stickyAudienceHint = text;
      return;
    }
  }
  // Pozitif sinyal yok → eski sticky korunur (follow-up dayanıklılığı).
}

// Yeni konu/tree başlangıcında bağlamı sıfırla (yanlış sticky'i önler).
function resetStickyAudienceHint(seed?: string | null): void {
  stickyAudienceHint = seed?.trim() ?? "";
}

// `prefetchDermoProduct` — id-bazlı idempotent eager prefetch.
// (eagerPrefetchOnce ile aynı semantik; isim kontrat tarafı için açık.)
function prefetchDermoProduct(p: V2DBProduct | null | undefined): void {
  eagerPrefetchOnce(p);
}

// Tek atomik açılış — Haptics + onPress + prefetch + setter + router.push.
// Sıra ÖNEMLİ: prefetch → setter → push (push'tan sonra setter etkisiz).
function openDermoProduct(
  p: V2DBProduct | null | undefined,
  opts?: { onPress?: () => void },
): void {
  if (!p?.id) return;
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  try { opts?.onPress?.(); } catch {}
  try { prefetchProductHeroImage(p as any); } catch {}
  try { setNavigationProduct(p as any); } catch {}
  router.push({
    pathname: `/(tabs)/(home)/product/${p.id}` as any,
    params: { source: "danisma" },
  });
}

// Routine/questionnaire ProductCard (gorsel_url, score, average_price ...) →
// openDermoProduct'in beklediği V2DBProduct'a adapter. id yoksa null döner
// (kart pasif kalır, regresyon yok).
function toDermoProduct(raw: any): V2DBProduct | null {
  if (!raw || !raw.id) return null;
  const image_url =
    raw.image_url ?? raw.gorsel_url ?? raw.gorsel ?? null;
  const thumbnail_url =
    raw.thumbnail_url ?? image_url ?? null;
  return {
    id: String(raw.id),
    name: String(raw.name ?? raw.isim ?? ""),
    brand: raw.brand ?? raw.marka ?? undefined,
    short_benefit: raw.short_benefit ?? raw.short_description ?? null,
    category: raw.category ?? raw.kategori ?? undefined,
    segment: raw.segment ?? undefined,
    image_url,
    thumbnail_url,
  } as V2DBProduct;
}

// Sticky audience'ı dahili olarak okuyan tek doğrulama girişi.
function validateDermoProductMatch(
  rec: { brand?: string | null; name?: string | null; desc?: string | null },
  product: V2DBProduct,
): boolean {
  return isDermoProductMatchSafe({
    recommendedBrand: rec.brand ?? null,
    recommendedName: rec.name ?? null,
    recommendedDesc: rec.desc ?? null,
    audienceHint: getStickyAudienceHint() || null,
    product,
  });
}

// ── ECZ4 — VERIFIED DB GATE for routine/questionnaire chips ─────────────────
// Sorun: /api/danisma/urun-oneri server endpoint'i bazen AI tarafından üretilmiş
// ya da products tablosunda olmayan id'lerle ProductCard döndürebiliyor. Bu id
// product/[id] sayfasına push edilince fetchProduct boş cevap veriyor → kullanıcı
// "boş ürün detayı" görüyor. Çözüm: clickable yapmadan önce her routine ürününü
// findProductByName ile DB'de doğrula. Sadece DB-backed eşleşmeler clickable.
type RoutineVerifyState =
  | { status: "loading" }
  | { status: "verified"; product: V2DBProduct }
  | { status: "unverified" };

const verifiedRoutineCache = new Map<string, RoutineVerifyState>();

function routineVerifyKey(raw: ProductCard): string {
  return `${raw.id ?? ""}|${(raw.brand ?? "").toLowerCase()}|${(raw.name ?? "").toLowerCase()}`;
}

async function verifyRoutineProduct(raw: ProductCard): Promise<RoutineVerifyState> {
  const key = routineVerifyKey(raw);
  const cached = verifiedRoutineCache.get(key);
  if (cached && cached.status !== "loading") return cached;
  const product = await findProductByName(`${raw.brand ?? ""} ${raw.name ?? ""}`).catch(() => null);
  let next: RoutineVerifyState;
  if (product && product.id) {
    // ID exact match VEYA güçlü brand+name token eşleşmesi.
    const sameId = String(product.id) === String(raw.id);
    const normBrand = normalizeIntentText(product.brand ?? "");
    const rawBrand  = normalizeIntentText(raw.brand ?? "");
    const normName  = normalizeIntentText(product.name ?? "");
    const rawNameFirst = normalizeIntentText(raw.name ?? "").split(" ")[0] ?? "";
    const strong = !!normBrand && normBrand === rawBrand &&
                   rawNameFirst.length >= 3 && normName.includes(rawNameFirst);
    next = (sameId || strong) ? { status: "verified", product } : { status: "unverified" };
  } else {
    next = { status: "unverified" };
  }
  verifiedRoutineCache.set(key, next);
  return next;
}

// ── ProductMiniCard ───────────────────────────────────────────────────────────

function ProductMiniCard({ product, isDark, size, onPress }: {
  product: V2DBProduct;
  isDark: boolean;
  size: "primary" | "alt";
  onPress?: () => void;
}) {
  const imgUri  = getProductImageUri(product);
  const segMeta = resolveSegMeta(product.segment);
  const isPrimary = size === "primary";
  const imgSz   = isPrimary ? 56 : 44;
  const padSz   = isPrimary ? 11 : 9;

  // ECZ4 UNIFIED: tek atomik açılış kontratı (prefetch + setter + push).
  // Daha önce setNavigationProduct çağrılmıyordu → product/[id] hot-paint
  // path'ine düşmüyor, fetchProduct ağır yolu çalışıyordu (3-5 sn).
  const handlePress = () => openDermoProduct(product, { onPress });

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        pcStyles.card,
        {
          backgroundColor: isDark ? "rgba(122,143,107,0.09)" : "#FFFFFF",
          borderColor:     isDark ? "rgba(122,143,107,0.22)" : "rgba(122,143,107,0.25)",
          padding:         padSz,
          opacity:         pressed ? 0.74 : 1,
        },
      ]}
    >
      {/* Image */}
      <View style={[pcStyles.imgWrap, { width: imgSz, height: imgSz }]}>
        {imgUri ? (
          <Image
            source={{ uri: imgUri }}
            style={{ width: imgSz, height: imgSz, borderRadius: isPrimary ? 11 : 9 }}
            resizeMode="cover"
          />
        ) : (
          <View style={[pcStyles.imgFallback, { width: imgSz, height: imgSz, borderRadius: isPrimary ? 11 : 9 }]}>
            <Feather name="package" size={isPrimary ? 20 : 16} color="#9DB88D" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: isPrimary ? 2 : 1 }}>
        {product.brand ? (
          <Text style={[pcStyles.brand, { fontSize: isPrimary ? 11 : 10, color: isDark ? "#9DB88D" : "#6A8A5A" }]} numberOfLines={1}>
            {product.brand}
          </Text>
        ) : null}
        <Text
          style={[pcStyles.name, { fontSize: isPrimary ? 13.5 : 12.5, color: isDark ? "#E8F0E8" : "#1A2D1A" }]}
          numberOfLines={isPrimary ? 2 : 1}
        >
          {product.name}
        </Text>
        {isPrimary && product.short_benefit ? (
          <Text style={[pcStyles.benefit, { color: isDark ? "#7DAA7D" : "#5A7A5A" }]} numberOfLines={1}>
            {product.short_benefit}
          </Text>
        ) : null}
        <View style={[pcStyles.segBadge, { backgroundColor: isDark ? segMeta.darkBg : segMeta.bg, marginTop: 3 }]}>
          <Text style={[pcStyles.segText, { color: isDark ? "#9DB88D" : segMeta.lightText }]}>
            {segMeta.label}
          </Text>
        </View>
      </View>

      {/* Chevron */}
      <Feather name="chevron-right" size={14} color={isDark ? "#6A8A6A" : "#9DB88D"} />
    </Pressable>
  );
}

// ── SoftProductCard ───────────────────────────────────────────────────────────
// AI marka + ürün adını düz metinde yazınca parser yakalayıp burayı render eder.
// ECZ4 Issue B: DB'de gerçek eşleşme varsa tıklanabilir karta dönüşür
// (ProductMiniCard'la aynı navigasyon: source="danisma" → back tab'a döner).
// Eşleşme yoksa eski pasif "uygulamada yer almıyor" durumu korunur.

type SoftLookupState =
  | { status: "loading" }
  | { status: "hit"; product: V2DBProduct }
  | { status: "miss" };

const softLookupCache = new Map<string, SoftLookupState>();

const normalizeSoftKey = (brand: string, name: string): string =>
  `${brand} ${name}`.toLowerCase().replace(/\s+/g, " ").trim();

function SoftProductCard({ brand, name, desc, isDark }: {
  brand: string;
  name: string;
  desc?: string;
  isDark: boolean;
}) {
  const cacheKey = normalizeSoftKey(brand, name);
  const initial: SoftLookupState = softLookupCache.get(cacheKey) ?? { status: "loading" };
  const [state, setState] = useState<SoftLookupState>(initial);

  useEffect(() => {
    const cached = softLookupCache.get(cacheKey);
    // ECZ4 UNIFIED — STALE CACHE FIX: cache anahtarı sticky context içermez,
    // bu yüzden hit cache'i sticky'ye göre yeniden doğrula. Audience hint
    // değişmişse (örn. "bebek aftersun?" → "yetişkin akne") önceki hit kart
    // miss'e düşer; cache invalidate edilmez (başka bağlamda tekrar geçerli olabilir).
    if (cached && cached.status === "hit") {
      const stillSafe = validateDermoProductMatch({ brand, name, desc }, cached.product);
      setState(stillSafe ? cached : { status: "miss" });
      return;
    }
    if (cached && cached.status === "miss") {
      setState(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      const product = await findProductByName(`${brand} ${name}`).catch(() => null);
      let next: SoftLookupState;
      if (product && validateDermoProductMatch({ brand, name, desc }, product)) {
        next = { status: "hit", product };
      } else {
        next = { status: "miss" };
      }
      softLookupCache.set(cacheKey, next);
      if (!cancelled) setState(next);
    })();
    return () => { cancelled = true; };
  }, [cacheKey, brand, name, desc]);

  // Hit → tıklanabilir kart, ProductMiniCard ile aynı navigasyon imzası.
  if (state.status === "hit") {
    const p = state.product;
    // ECZ4 Issue F: kart visible olduğu anda idempotent prefetch — onPress
    // sırasındaki prefetch zaten korundu, bu sadece "yumuşak" early-warm.
    eagerPrefetchOnce(p);
    const imgUri  = getProductImageUri(p);
    const segMeta = resolveSegMeta(p.segment);
    // ECZ4 UNIFIED: openDermoProduct kontratı (prefetch + setter + push birleşik).
    const handlePress = () => openDermoProduct(p, {
      onPress: () => recordSegmentClick(p.segment ?? ""),
    });
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          pcStyles.card,
          {
            backgroundColor: isDark ? "rgba(122,143,107,0.09)" : "#FFFFFF",
            borderColor:     isDark ? "rgba(122,143,107,0.22)" : "rgba(122,143,107,0.25)",
            padding:         10,
            opacity:         pressed ? 0.74 : 1,
          },
        ]}
      >
        <View style={[pcStyles.imgWrap, { width: 44, height: 44 }]}>
          {imgUri ? (
            <Image
              source={{ uri: imgUri }}
              style={{ width: 44, height: 44, borderRadius: 9 }}
              resizeMode="cover"
            />
          ) : (
            <View style={[pcStyles.imgFallback, { width: 44, height: 44, borderRadius: 9 }]}>
              <Feather name="package" size={16} color="#9DB88D" />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[pcStyles.brand, { fontSize: 11, color: isDark ? "#9DB88D" : "#6A8A5A" }]} numberOfLines={1}>
            {p.brand ?? brand}
          </Text>
          <Text
            style={[pcStyles.name, { fontSize: 12.8, color: isDark ? "#E8F0E8" : "#1A2D1A" }]}
            numberOfLines={2}
          >
            {p.name ?? name}
          </Text>
          {desc ? (
            <Text style={{ fontSize: 11, lineHeight: 14.5, color: isDark ? "#7DAA7D" : "#5A7A5A", marginTop: 1 }} numberOfLines={2}>
              {desc}
            </Text>
          ) : null}
          <View style={[pcStyles.segBadge, { backgroundColor: isDark ? segMeta.darkBg : segMeta.bg, marginTop: 3 }]}>
            <Text style={[pcStyles.segText, { color: isDark ? "#9DB88D" : segMeta.lightText }]}>
              {segMeta.label}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={14} color={isDark ? "#6A8A6A" : "#9DB88D"} />
      </Pressable>
    );
  }

  // Loading / miss → mevcut pasif kart (görsel olarak değişmedi).
  // Loading sırasında da "yer almıyor" yazısını basmıyoruz; kısa lookup
  // sonrası yerini ya hit kartı ya miss kartı alır.
  return (
    <View style={[pcStyles.card, {
      backgroundColor: isDark ? "rgba(122,143,107,0.05)" : "rgba(122,143,107,0.04)",
      borderColor:     isDark ? "rgba(122,143,107,0.14)" : "rgba(122,143,107,0.16)",
      borderStyle:     "dashed",
      padding:         10,
      opacity:         0.92,
    }]}>
      <View style={[pcStyles.imgWrap, { width: 44, height: 44 }]}>
        <View style={[pcStyles.imgFallback, { width: 44, height: 44, borderRadius: 9, backgroundColor: isDark ? "rgba(122,143,107,0.10)" : "#EAF2EA" }]}>
          <Feather name="package" size={16} color={isDark ? "#6A8A6A" : "#9DB88D"} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[pcStyles.brand, { fontSize: 10.5, color: isDark ? "#7A9A7A" : "#7A8F6B" }]} numberOfLines={1}>
          {brand}
        </Text>
        <Text style={[pcStyles.name, { fontSize: 12.8, color: isDark ? "#C8D5C8" : "#3A4F3A" }]} numberOfLines={2}>
          {name}
        </Text>
        {desc ? (
          <Text style={{ fontSize: 11, lineHeight: 14.5, color: isDark ? "#7DAA7D" : "#5A7A5A", marginTop: 1 }} numberOfLines={2}>
            {desc}
          </Text>
        ) : null}
        {state.status === "miss" ? (
          <Text style={{ fontSize: 10, fontStyle: "italic", color: isDark ? "#6A8A6A" : "#8A9A8A", marginTop: 3 }}>
            Bu ürün henüz uygulamada yer almıyor
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── SoftProductGroup ──────────────────────────────────────────────────────────
// ECZ4 STRICT AUDIENCE FIX — birbirini takip eden soft_product kartları için
// paralel lookup yapıp DB-eşleşen (hit) kartları pasif (miss) kartların ÜSTÜNE
// koyar. Görsel tasarım birebir aynı kalır; sıralama lokal olarak değişir.
function SoftProductGroup({ items, isDark }: {
  items: Array<{ brand: string; name: string; desc?: string }>;
  isDark: boolean;
}) {
  const [order, setOrder] = useState(items);

  useEffect(() => {
    let live = true;
    (async () => {
      const ranked = await Promise.all(items.map(async (it) => {
        const key = normalizeSoftKey(it.brand, it.name);
        let st = softLookupCache.get(key);
        if (!st || st.status === "loading") {
          const product = await findProductByName(`${it.brand} ${it.name}`).catch(() => null);
          if (product && validateDermoProductMatch(
            { brand: it.brand, name: it.name, desc: it.desc },
            product,
          )) {
            st = { status: "hit", product };
          } else {
            st = { status: "miss" };
          }
          softLookupCache.set(key, st);
        }
        // ECZ4 UNIFIED — STALE CACHE: cached hit'i sticky'ye göre yeniden doğrula.
        // Cache invalidate edilmez (başka bağlamda geçerli olabilir); yalnız bu
        // sıralama için "miss" gibi davranır, böylece doğru kartlar üstte kalır.
        let effectiveRank: number;
        if (st.status === "hit") {
          const stillSafe = validateDermoProductMatch(
            { brand: it.brand, name: it.name, desc: it.desc },
            st.product,
          );
          effectiveRank = stillSafe ? 0 : 1;
        } else {
          effectiveRank = 1;
        }
        return { it, rank: effectiveRank };
      }));
      ranked.sort((a, b) => a.rank - b.rank);
      if (live) setOrder(ranked.map(r => r.it));
    })();
    return () => { live = false; };
  }, [items.map(i => `${i.brand}|${i.name}`).join("~")]);

  return (
    <>
      {order.map((it, idx) => (
        <SoftProductCard
          key={`sg-${idx}-${it.brand}-${it.name}`}
          brand={it.brand}
          name={it.name}
          desc={it.desc}
          isDark={isDark}
        />
      ))}
    </>
  );
}

// ── InlineProductSlot ─────────────────────────────────────────────────────────

function InlineProductSlot({ hint, streaming, isDark }: {
  hint: string;
  streaming?: boolean;
  isDark: boolean;
}) {
  const { isSeckin } = useAuth();
  const [result, setResult] = useState<{ primary: V2DBProduct | null; alts: V2DBProduct[] } | null>(null);

  useEffect(() => {
    if (streaming) return;
    let live = true;
    (async () => {
      const preferred = await getPreferredSegment(isSeckin ?? false);
      const data = await fetchChatProductsByPreference(hint, preferred);
      // ECZ4 Issue F: hint intent'i ile aday ürünleri çapraz kontrol et — pre-filter
      // (CATEGORY_ANCHORS) zaten kategoriyi kabaca daraltıyor, bu ek bir savunma
      // hattı. brand kontrolü atlanır (recommendedBrand=null → guard A skip).
      // ECZ4 UNIFIED: validateDermoProductMatch sticky audienceHint dahil eder.
      const passes = (p: V2DBProduct | null): boolean =>
        !!p && validateDermoProductMatch(
          { brand: null, name: hint, desc: null },
          p,
        );
      const safePrimary = passes(data.primary) ? data.primary : null;
      const safeAlts = (data.alts ?? []).filter(passes);
      // Güvenli ürünler için eager prefetch — visible olur olmaz görsel ısıtılır.
      if (safePrimary) eagerPrefetchOnce(safePrimary);
      safeAlts.forEach(eagerPrefetchOnce);
      if (live) setResult({ primary: safePrimary, alts: safeAlts });
    })().catch(() => { if (live) setResult({ primary: null, alts: [] }); });
    return () => { live = false; };
  }, [hint, streaming, isSeckin]);

  // Gizle: streaming sürerken
  if (streaming) return null;

  // Skeleton: yükleniyor
  if (result === null) {
    return (
      <View style={[pcStyles.skeleton, {
        backgroundColor: isDark ? "rgba(122,143,107,0.10)" : "rgba(122,143,107,0.07)",
        borderColor:     isDark ? "rgba(122,143,107,0.15)" : "rgba(122,143,107,0.14)",
      }]}>
        <View style={[pcStyles.skelImg, { backgroundColor: isDark ? "#3A4F3A" : "#D4E4CC" }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[pcStyles.skelLine, { width: "65%", backgroundColor: isDark ? "#3A4F3A" : "#D4E4CC" }]} />
          <View style={[pcStyles.skelLine, { width: "45%", backgroundColor: isDark ? "#2F4230" : "#DDE8D6" }]} />
        </View>
      </View>
    );
  }

  // Boş: zarif inline fallback (kart açılmaz, sadece kısa not)
  if (!result.primary) {
    return (
      <View style={[pcStyles.skeleton, {
        backgroundColor: isDark ? "rgba(122,143,107,0.06)" : "rgba(122,143,107,0.05)",
        borderColor:     isDark ? "rgba(122,143,107,0.12)" : "rgba(122,143,107,0.12)",
        height: undefined,
        paddingVertical: 9,
      }]}>
        <Feather name="info" size={13} color={isDark ? "#7DAA7D" : "#7A8F6B"} />
        <Text style={{ flex: 1, fontSize: 12, lineHeight: 16, color: isDark ? "#9DB88D" : "#5A7A5A" }}>
          Bu kategoride uygulamada eşleşen ürün bulunamadı.
        </Text>
      </View>
    );
  }

  const altLabel = isDark ? "#7A9A7A" : "#7A8F6B";

  return (
    <View style={{ gap: 7, marginTop: 4 }}>
      <ProductMiniCard
        product={result.primary}
        isDark={isDark}
        size="primary"
        onPress={() => recordSegmentClick(result.primary!.segment ?? "")}
      />
      {result.alts.length > 0 && (
        <>
          <Text style={{ fontSize: 11, fontWeight: "600", color: altLabel, marginTop: 2, letterSpacing: 0.2 }}>
            İstersen alternatif:
          </Text>
          {result.alts.map(p => (
            <ProductMiniCard
              key={p.id}
              product={p}
              isDark={isDark}
              size="alt"
              onPress={() => recordSegmentClick(p.segment ?? "")}
            />
          ))}
        </>
      )}
    </View>
  );
}

// ── Ürün Kart Stilleri ────────────────────────────────────────────────────────

const pcStyles = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 13, borderWidth: 1 },
  imgWrap:    { overflow: "hidden", borderRadius: 11, backgroundColor: "#EAF2EA" },
  imgFallback:{ alignItems: "center", justifyContent: "center", backgroundColor: "#EAF2EA" },
  brand:      { fontWeight: "600", letterSpacing: 0.1 },
  name:       { fontWeight: "600", lineHeight: 18 },
  benefit:    { fontSize: 11, lineHeight: 15 },
  segBadge:   { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  segText:    { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  skeleton:   { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 13, borderWidth: 1, padding: 11, height: 72 },
  skelImg:    { width: 44, height: 44, borderRadius: 10 },
  skelLine:   { height: 9, borderRadius: 5 },
});

const abStyles = StyleSheet.create({
  header:    { fontSize: 12.5, fontWeight: "700", letterSpacing: 0.25, marginTop: 6, marginBottom: 1 },
  para:      { fontSize: 14.5, lineHeight: 23,    fontWeight: "500" },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletDot: { fontSize: 18,   lineHeight: 23, fontWeight: "700", marginTop: -1 },
  bulletText:{ flex: 1, fontSize: 14.5, lineHeight: 23, fontWeight: "500" },
  numRow:    { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  numBadge:  { fontSize: 12.5, fontWeight: "700", lineHeight: 23, minWidth: 20 },
  numText:   { flex: 1, fontSize: 14.5, lineHeight: 23, fontWeight: "500" },
  micro:     { fontSize: 13,   fontWeight: "600", fontStyle: "italic", marginTop: 5 },
});

// ── Ana Bileşen ────────────────────────────────────────────────────────────────

export default function DanismaScreen() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // ECZ4 GLOBAL — isRegistered: misafir kullanıcıyı CTA seviyesinde gateleyebilmek için.
  const { isSeckin, isRegistered: danismaIsRegistered, getAuthHeaders } = useAuth();
  const { ctaBarBottom, tabBarHeight } = useTabBarInset();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── Chat durumu ──────────────────────────────────────────────────────────────
  const [mod, setMod] = useState<Mod>("home");
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [input, setInput] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [aktifKonu, setAktifKonu] = useState<string>("");
  const scrollRef = useRef<ScrollView>(null);

  // ── Karar ağacı durumu ──────────────────────────────────────────────────────
  const [treeKonuId, setTreeKonuId]   = useState<string>("");
  const [treeStep, setTreeStep]       = useState(0);
  const [treeAnswers, setTreeAnswers] = useState<Record<string, string>>({});
  const treeAnim = useRef(new Animated.Value(0)).current;
  const [treeProfile, setTreeProfile] = useState<(TreeProfile & { systemContext: string }) | null>(null);
  const [treeRoutine, setTreeRoutine] = useState<RoutineStep[]>([]);
  const [treeKonuLabel, setTreeKonuLabel] = useState<string>("");
  const [productSlots, setProductSlots] = useState<ProductSlot[]>([]);
  const [productsFetching, setProductsFetching] = useState(false);

  // ── ECZ4 Issue C: Yerel sohbet geçmişi ─────────────────────────────────────
  const [historyThreads, setHistoryThreads] = useState<DermoAsistanThread[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const currentThreadIdRef = useRef<string | null>(null);
  const currentThreadCreatedAtRef = useRef<string | null>(null);
  const mesajlarRef = useRef<Mesaj[]>([]);
  const aktifKonuRef = useRef<string>("");
  const modRef = useRef<Mod>("home");
  useEffect(() => { mesajlarRef.current = mesajlar; }, [mesajlar]);
  useEffect(() => { aktifKonuRef.current = aktifKonu; }, [aktifKonu]);
  useEffect(() => { modRef.current = mod; }, [mod]);

  const refreshHistory = useCallback(async () => {
    const list = await getDermoAsistanThreads();
    setHistoryThreads(list);
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const persistCurrentThread = useCallback(async () => {
    const msgs = mesajlarRef.current;
    if (!msgs || msgs.length < 2) return;
    const hasVisibleUser = msgs.some(m => m.role === "user" && !m.hidden && m.content?.trim());
    const hasAssistant   = msgs.some(m => m.role === "assistant" && !m.streaming && m.content?.trim());
    if (!hasVisibleUser || !hasAssistant) return;

    if (!currentThreadIdRef.current) {
      currentThreadIdRef.current = makeDermoAsistanThreadId();
      currentThreadCreatedAtRef.current = new Date().toISOString();
    }
    const firstUserVisible = msgs.find(m => m.role === "user" && !m.hidden && m.content?.trim());
    const titleSource = aktifKonuRef.current?.trim() || firstUserVisible?.content || "DermoAsistan Sohbeti";

    await saveDermoAsistanThread({
      id: currentThreadIdRef.current,
      title: titleSource,
      mode: modRef.current,
      topic: aktifKonuRef.current || null,
      createdAt: currentThreadCreatedAtRef.current ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: msgs.map(m => ({
        role: m.role,
        content: m.content,
        hidden: m.hidden,
        streaming: m.streaming,
      })),
    });
    refreshHistory();
  }, [refreshHistory]);

  const restoreThread = useCallback((thread: DermoAsistanThread) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    currentThreadIdRef.current = thread.id;
    currentThreadCreatedAtRef.current = thread.createdAt;
    setMesajlar(
      (thread.messages ?? []).map(m => ({
        role: m.role,
        content: m.content,
        hidden: m.hidden,
        streaming: false,
      })) as Mesaj[],
    );
    setAktifKonu(thread.topic ?? thread.title ?? "");
    setHata(null);
    setOpeningSecenekler([]);
    setOpeningKonuId("");
    setMod("chat");
    setHistoryOpen(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
  }, []);

  const handleDeleteThread = useCallback(async (id: string) => {
    const updated = await deleteDermoAsistanThread(id);
    setHistoryThreads(updated);
    if (currentThreadIdRef.current === id) {
      currentThreadIdRef.current = null;
      currentThreadCreatedAtRef.current = null;
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      "Geçmişi temizle",
      "Tüm DermoAsistan sohbet geçmişi silinecek. Devam edilsin mi?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Temizle",
          style: "destructive",
          onPress: async () => {
            await clearDermoAsistanThreads();
            setHistoryThreads([]);
            currentThreadIdRef.current = null;
            currentThreadCreatedAtRef.current = null;
          },
        },
      ],
    );
  }, []);

  // ── Anlık açılış kartı durumu ─────────────────────────────────────────────
  const [openingSecenekler, setOpeningSecenekler] = useState<string[]>([]);
  const [openingKonuId, setOpeningKonuId] = useState<string>("");

  // ── Rutin değerlendirme durumu ───────────────────────────────────────────────
  const [rutinAdim, setRutinAdim] = useState(0);
  const [rutinCevaplar, setRutinCevaplar] = useState<Record<string, string>>({});
  const [rutinGiris, setRutinGiris] = useState("");

  // ── Yapılandırılmış rapor durumu ──────────────────────────────────────────────
  const [resultBlocks, setResultBlocks] = useState<ResultBlocks | null>(null);
  const [raporYukleniyor, setRaporYukleniyor] = useState(false);

  // ── Düşünme pulse animasyonu ──────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (yukleniyor) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.45, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => { loop?.stop(); };
  }, [yukleniyor]);

  // ── Sohbet gönder ───────────────────────────────────────────────────────────
  const gonder = useCallback(async (metin: string, gecmis?: Mesaj[], hideUserMsg?: boolean) => {
    const temiz = metin.trim();
    if (!temiz || yukleniyor) return;

    setOpeningSecenekler([]);
    setOpeningKonuId("");
    // ECZ4 Issue A v3: tek source-of-truth. baseMessages → API + UI aynı diziden türesin.
    // Önceki kod iki ayrı setMesajlar çağrısı yapıyordu; React 18 batching ile sorun
    // çıkmıyor ama tek setMesajlar daha güvenli ve okunaklı.
    // ECZ4 UNIFIED STICKY CONTEXT — visible user prompt ise sticky audience'ı
    // güncelle. hidden mesajlar (tree-derived hidden context) zaten kaynakta
    // güçlü bağlam taşır → onları da besleriz. Generic follow-up'larda ("başka
    // seçenek var mı?") pozitif token bulunmazsa sticky DEĞİŞMEZ.
    updateStickyAudienceFromUser(temiz);

    const baseMessages = gecmis ?? mesajlar;
    const userMsg: Mesaj = { role: "user", content: temiz, hidden: hideUserMsg };
    const nextMessagesForApi: Mesaj[] = [...baseMessages, userMsg];
    // ECZ4 FIX — DEAD-END BUG: placeholder asistan mesajı ASLA gizlenmemeli.
    // Önceden `hidden: hideUserMsg` set ediliyordu → guided flow'da
    // (handleOpeningSecenek "Yağlı" → gonder(prompt, ..., true)) hidden=true
    // olarak placeholder oluşur, SSE güncellemeleri prev hidden'ı koruduğu için
    // final asistan cevabı da hidden kalır → render filtresi (`!m.hidden`)
    // tarafından elenir → ekranda hiçbir şey görünmez. hideUserMsg yalnız user
    // enrichment mesajını gizlemek içindir; asistan cevabı her zaman görünür olmalı.
    const placeholderMsg: Mesaj = { role: "assistant", content: "", streaming: true, hidden: false };
    const nextUiMessages: Mesaj[] = [...nextMessagesForApi, placeholderMsg];
    setMesajlar(nextUiMessages);
    setInput("");
    setYukleniyor(true);
    setHata(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const asistanIdx = nextMessagesForApi.length;
    if (__DEV__) console.log("[DermoAsistan/send] payload count:", nextMessagesForApi.length, "lastRole:", nextMessagesForApi[nextMessagesForApi.length - 1]?.role, "asistanIdx:", asistanIdx);

    // ECZ4 Issue A v3: başarısızlıkta placeholder'ı SİLMEK yerine fallback bubble
    // ile değiştiren ortak helper. Kullanıcı hiç balon görmüyordu — şimdi
    // "Şu anda cevap üretemedim..." görüyor. failed:true → history sanitizer atar.
    const showFailureBubble = (reason: string) => {
      setMesajlar(prev => {
        const up = [...prev];
        if (up.length > asistanIdx && up[asistanIdx]?.role === "assistant") {
          // ECZ4 FIX — DEAD-END BUG: failure bubble da görünür olmalı; aksi halde
          // hidden user enrichment + hidden failure → kullanıcı sessizce takılır.
          up[asistanIdx] = { role: "assistant", content: reason, streaming: false, hidden: false, failed: true };
        }
        return up;
      });
    };

    // SSE parse helper — works with both ReadableStream (newer RN) and full text fallback
    // ECZ4 Issue A: artık opsiyonel olarak parsed.error de yakalar; çağıran taraf
    // err alanını kontrol edip kullanıcıya hata banner'ı basar.
    const parseSSE = (raw: string): { text: string; err: string | null } => {
      let out = "";
      let err: string | null = null;
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") break;
        try {
          const parsed = JSON.parse(payload);
          if (parsed?.error) { err = String(parsed.error); break; }
          out += parsed.choices?.[0]?.delta?.content ?? "";
        } catch {}
      }
      return { text: out, err };
    };

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/danisma`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessagesForApi.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = res.status === 403
          ? "Bu özellik Seçkin üyelik gerektirir."
          : err.error ?? "Cevap alınamadı";
        showFailureBubble(msg);
        setHata(msg);
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      const isSSE = contentType.includes("text/event-stream") || contentType.includes("text/plain");

      if (isSSE) {
        // Try ReadableStream (works in newer Expo/RN) — fall back to res.text() if unavailable
        const reader = res.body?.getReader();
        if (__DEV__) console.log("[DermoAsistan/SSE] reader available:", !!reader, "status:", res.status, "ct:", contentType);
        if (reader) {
          const decoder = new TextDecoder();
          let accumulated = "";
          let sseError: string | null = null;
          let buffer = "";
          let chunkCount = 0;
          // ECZ4 Issue A v2: chunk sınırlarında JSON satırları parçalanabiliyordu;
          // önceden her chunk tek başına split("\n") ediliyor, mid-line bölünme
          // sessizce JSON.parse hatasına dönüp content kaybediyordu. Şimdi kalıcı
          // buffer'a yazıp yalnız \n ile biten tam satırları tüketiyoruz.
          const consumeLine = (line: string): boolean => {
            if (!line.startsWith("data: ")) return false;
            const payload = line.slice(6).trim();
            if (!payload) return false;
            if (payload === "[DONE]") return true;
            try {
              const parsed = JSON.parse(payload);
              if (parsed?.error) {
                sseError = String(parsed.error);
                return true;
              }
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                accumulated += delta;
                setMesajlar(prev => {
                  const up = [...prev];
                  up[asistanIdx] = { role: "assistant", content: accumulated, streaming: true, hidden: prev[asistanIdx]?.hidden };
                  return up;
                });
              }
            } catch (e) {
              if (__DEV__) console.warn("[DermoAsistan/SSE] JSON parse fail:", payload.slice(0, 80));
            }
            return false;
          };

          outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunkCount++;
            buffer += decoder.decode(value, { stream: true });
            let nlIdx;
            while ((nlIdx = buffer.indexOf("\n")) !== -1) {
              const rawLine = buffer.slice(0, nlIdx).replace(/\r$/, "");
              buffer = buffer.slice(nlIdx + 1);
              if (consumeLine(rawLine)) break outer;
            }
          }
          // Drain residual buffer (no trailing newline at stream end)
          if (buffer.length > 0) {
            consumeLine(buffer.replace(/\r$/, ""));
            buffer = "";
          }
          if (__DEV__) console.log("[DermoAsistan/SSE] done. chunks:", chunkCount, "len:", accumulated.length, "err:", sseError);
          // ECZ4 Issue A v3: placeholder'ı silmek yerine fallback bubble göster.
          if (sseError || accumulated.trim() === "") {
            showFailureBubble(sseError ?? "Şu anda cevap üretemedim. Lütfen tekrar dene.");
            if (sseError) setHata(sseError);
          } else {
            setMesajlar(prev => {
              const up = [...prev];
              up[asistanIdx] = { role: "assistant", content: accumulated, streaming: false, hidden: prev[asistanIdx]?.hidden };
              return up;
            });
          }
        } else {
          // Fallback: buffer the full SSE response and parse at once
          const raw = await res.text();
          const { text, err } = parseSSE(raw);
          if (__DEV__) console.log("[DermoAsistan/SSE/fallback] rawLen:", raw.length, "textLen:", text.length, "err:", err, "asistanIdx:", asistanIdx);
          // ECZ4 Issue A v3: placeholder'ı silmek yerine fallback bubble göster.
          if (err || text.trim() === "") {
            showFailureBubble(err ?? "Şu anda cevap üretemedim. Lütfen tekrar dene.");
            if (err) setHata(err);
          } else {
            setMesajlar(prev => {
              const up = [...prev];
              up[asistanIdx] = { role: "assistant", content: text, streaming: false, hidden: prev[asistanIdx]?.hidden };
              return up;
            });
          }
        }
      } else {
        const data = await res.json();
        const text = data.content ?? data.message ?? data.yanit ?? JSON.stringify(data);
        setMesajlar(prev => {
          const up = [...prev];
          up[asistanIdx] = { role: "assistant", content: text, streaming: false, hidden: prev[asistanIdx]?.hidden };
          return up;
        });
      }
    } catch (e) {
      if (__DEV__) console.warn("[DermoAsistan/send] network/runtime error:", e);
      // ECZ4 Issue A v3: catch'te de user balonunu silmeyiz; yalnız placeholder'ı
      // fallback bubble ile değiştirip aynı zamanda hata banner'ı basarız.
      showFailureBubble("Bağlantı hatası. Lütfen tekrar dene.");
      setHata("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setYukleniyor(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
      // ECZ4 Issue C: başarılı asistan yanıtından sonra yerel geçmişi kaydet.
      // persistCurrentThread içindeki guard'lar boş/streaming/yalnız-user durumları zaten reddediyor.
      setTimeout(() => { persistCurrentThread(); }, 200);
    }
  }, [mesajlar, yukleniyor, persistCurrentThread]);

  // ── Karar ağacı tamamlandı → rutin önizleme ekranı ─────────────────────────
  const finishTree = useCallback(async (konuId: string, answers: Record<string, string>) => {
    const tree = DECISION_TREES[konuId];
    if (!tree) return;
    const profile = tree.evaluate(answers);
    const routine = tree.buildRoutine(profile, answers);
    const konu = KONULAR.find(k => k.id === konuId);
    if (!konu) return;
    setTreeProfile(profile);
    setTreeRoutine(routine);
    setTreeKonuLabel(konu.label);
    setAktifKonu(konu.label);
    setMesajlar([]);
    setHata(null);
    setProductSlots([]);
    setMod("tree_result");
    // ECZ4 UNIFIED STICKY: tree-derived bağlamı seed et — RoutinePreviewScreen
    // chip'lerine tıklanınca SoftProductCard guard'ı bu hint'i okur.
    resetStickyAudienceHint(`${konu.label} ${profile.priority} ${profile.tolerance}`);

    // Ürün önerilerini arka planda çek
    setProductsFetching(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/danisma/urun-oneri`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          concern: konuId,
          priority: profile.priority,
          tolerance: profile.tolerance,
          severity: profile.severity,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { slots: ProductSlot[] };
        setProductSlots(data.slots ?? []);
      }
    } catch { /* silently fail — ürün önerileri opsiyonel */ }
    finally { setProductsFetching(false); }
  }, [getAuthHeaders]);

  // ── Rutin önizlemeden chat'e geç ─────────────────────────────────────────────
  const startChatFromTree = useCallback(() => {
    if (!treeProfile) return;
    const { severity, tolerance, priority, systemContext } = treeProfile;
    const severityTR = severity === "yüksek" ? "ciddi" : severity === "orta" ? "orta şiddetli" : "hafif";
    const priorityTR = priority === "onarım" ? "bariyer onarımı" : priority === "kontrol" ? "sebum/tetikleyici kontrolü" : "aktif tedavi protokolü";
    const routineSummary = treeRoutine.map(s => `• ${s.category} (${s.role})`).join("\n");
    const hiddenContext = `Sen DermoAsistan. ${systemContext}\n\nKullanıcı profiline göre ${severityTR} ${treeKonuLabel.toLowerCase()} sorunu yaşıyor. Tolerans: ${tolerance}. Öncelik: ${priorityTR}.\n\nKullanıcıya önerilen rutin:\n${routineSummary}\n\nBu konuşmaya şöyle başla: kısa bir merhaba + bu rutinin neden bu profile özel olduğunu 2-3 cümleyle açıkla + en kritik adımı ön plana çıkar. Soruları zaten cevapladı — tekrar sorma. Ardından kullanıcının sorularını bekle.`;
    setMod("chat");
    setTimeout(() => gonder(hiddenContext, [], true), 100);
  }, [treeProfile, treeRoutine, treeKonuLabel, gonder]);

  // ── Konu seç ────────────────────────────────────────────────────────────────
  const konuSec = useCallback((konu: typeof KONULAR[0]) => {
    if (!isSeckin) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setMod("gate"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Tree-enabled konular → karar ağacı akışı
    if (TREE_CONCERN_IDS.has(konu.id)) {
      setTreeKonuId(konu.id);
      setTreeStep(0);
      setTreeAnswers({});
      treeAnim.setValue(0);
      setAktifKonu(konu.label);
      // ECZ4 UNIFIED STICKY: yeni konu → sticky'yi konuyla seed et.
      resetStickyAudienceHint(konu.label);
      setMod("tree");
      return;
    }
    // Diğer konular → anlık açılış mesajı göster, AI'ı arka planda beklet
    setAktifKonu(konu.label);
    // ECZ4 UNIFIED STICKY: konu tabanlı bağlamı seed et.
    resetStickyAudienceHint(konu.label);
    setHata(null);
    setOpeningSecenekler([]);
    setOpeningKonuId("");
    const opening = KONU_OPENING[konu.id];
    if (opening) {
      setMesajlar([{ role: "assistant", content: `${opening.selamlama}\n\n${opening.ilkSoru}`, streaming: false }]);
      setOpeningSecenekler(opening.secenekler);
      setOpeningKonuId(konu.id);
      setMod("chat");
    } else {
      setMesajlar([]);
      setMod("chat");
      setTimeout(() => gonder(konu.sistemPrompt, [], true), 100);
    }
  }, [gonder, isSeckin, treeAnim]);

  // ── Arama intent store: tab odaklanınca bekleyen konuyu başlat ──────────────
  useFocusEffect(
    useCallback(() => {
      const pending = consumeSearchKonu();
      if (pending) {
        const found = KONULAR.find((k) => k.id === pending);
        if (found) {
          setMod("home");
          setMesajlar([]);
          setHata(null);
          setTimeout(() => konuSec(found), 80);
        }
      }
    }, [konuSec])
  );

  // ── Ürün bul ────────────────────────────────────────────────────────────────
  const urunBul = useCallback(() => {
    if (!isSeckin) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setMod("gate"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAktifKonu("Ürün Eşleştirme");
    // ECZ4 UNIFIED STICKY: yeni akış girişi → sticky'yi deterministik seed et.
    resetStickyAudienceHint("Ürün Eşleştirme");
    setHata(null);
    setOpeningSecenekler([]);
    const opening = KONU_OPENING["urunbul"];
    setMesajlar([{ role: "assistant", content: `${opening.selamlama}\n\n${opening.ilkSoru}`, streaming: false }]);
    setOpeningSecenekler(opening.secenekler);
    setOpeningKonuId("urunbul");
    setMod("chat");
  }, [isSeckin]);

  // ── Rutin değerlendirme gönder ───────────────────────────────────────────────
  const rutinGonder = useCallback(() => {
    const cevaplar = { ...rutinCevaplar };
    const adim = RUTIN_ADIMLAR[rutinAdim];
    if (rutinGiris.trim()) cevaplar[adim.id] = rutinGiris.trim();

    const prompt = `Kullanıcının mevcut cilt bakım rutinini değerlendir:
Sabah rutini: ${cevaplar.sabah || "belirtilmedi"}
Gece rutini: ${cevaplar.gece || "belirtilmedi"}
Cilt tipi: ${cevaplar.cilt_tipi || "belirtilmedi"}
Ana endişe: ${cevaplar.endise || "belirtilmedi"}

Lütfen şunları değerlendir: iyi giden noktalar, fazla aktif içerik riski, bariyer yorgunluğu ihtimali, SPF eksikliği, içerik çakışmaları, sıralama önerisi ve sadeleştirme tavsiyesi. Samimi, sakin ve pratik bir ton kullan.`;

    setAktifKonu("Rutin Değerlendirme");
    // ECZ4 UNIFIED STICKY: yeni akış girişi → sticky'yi deterministik seed et.
    resetStickyAudienceHint("Rutin Değerlendirme");
    setMesajlar([]);
    setHata(null);
    setMod("chat");
    setRutinAdim(0);
    setRutinCevaplar({});
    setRutinGiris("");
    setTimeout(() => gonder(prompt, [], true), 100);
  }, [rutinAdim, rutinCevaplar, rutinGiris, gonder]);

  // ── Anlık seçenek tıklandı ──────────────────────────────────────────────────
  // UI'da yalnızca kullanıcının kısa seçim metni (ör. "Yağlı") görünür;
  // developer enrichment prompt'u hidden olarak gönderilir, UI'da gözükmez.
  const handleOpeningSecenek = useCallback((secenek: string) => {
    const konuId = openingKonuId;
    setOpeningSecenekler([]);
    setOpeningKonuId("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // ECZ4 UNIFIED STICKY: opening seçenekleri de pozitif bağlam taşıyabilir
    // (örn. "Bebek için", "Aftersun"). gonder() içinde de güncellenir ama
    // hidden enrichment prompt görünür mesajdan farklı; burada visible cevabı
    // kaynak alıyoruz.
    updateStickyAudienceFromUser(secenek);

    // Önce kullanıcının seçimini visible user bubble olarak ekle.
    const visibleUserMsg: Mesaj = { role: "user", content: secenek, hidden: false };
    const updatedMesajlar: Mesaj[] = [...mesajlar, visibleUserMsg];
    setMesajlar(updatedMesajlar);

    // Sonra developer enrichment'i hidden olarak gönder (gecmis = updatedMesajlar).
    if (konuId === "urunbul") {
      const prompt = `[Bağlam: Kullanıcı kendine uygun ürün bulmak istiyor. Cilt tipi: ${secenek}. Ana endişesini, bilinen alerjilerini ve tercih ettiği ürün kategorisini (nemlendirici, serum, temizleyici vb.) sor. Sonra uygun ürün yönlendirmesi yap.]`;
      gonder(prompt, updatedMesajlar, true);
      return;
    }
    const konu = KONULAR.find(k => k.id === konuId);
    if (!konu) return;
    const prompt = `[Bağlam: ${konu.sistemPrompt}\n\nKullanıcının yukarıdaki cevabı: "${secenek}". Bu bilgiyi temel al, doğrula ve konuşmaya devam et. Tekrar aynı soruyu sorma.]`;
    gonder(prompt, updatedMesajlar, true);
  }, [openingKonuId, mesajlar, gonder]);

  // ── Geri ────────────────────────────────────────────────────────────────────
  const geriGit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // ECZ4 Issue C: ekrandan ayrılmadan / temizlemeden önce yerel geçmişe kaydet.
    persistCurrentThread();
    currentThreadIdRef.current = null;
    currentThreadCreatedAtRef.current = null;
    setMod("home");
    setMesajlar([]);
    setHata(null);
    setAktifKonu("");
    // ECZ4 UNIFIED STICKY: home'a dön → bağlam temizle.
    resetStickyAudienceHint("");
    setResultBlocks(null);
    setRaporYukleniyor(false);
    setTreeKonuId("");
    setTreeStep(0);
    setTreeAnswers({});
    setOpeningSecenekler([]);
    setOpeningKonuId("");
  }, [persistCurrentThread]);

  // ── Serbest metin intent tespiti ─────────────────────────────────────────────
  const detectIntent = useCallback((input: string): { konu: string; prompt: string } => {
    const t = input.toLowerCase();
    if (/hamile|gebelik|emzir|alerji|alerjim|reaksiyon|güvenl|toksik|bebek/.test(t))
      return { konu: "Güvenlik & Alerji", prompt: `Kullanıcının endişesi: "${input}". Bu, güvenlik veya alerji ile ilgili bir soru. Önce durumu netleştirmek için 1 kısa soru sor: hamilelik mi, alerji mi, yoksa başka bir hassasiyet mi? Ardından güvenli ve kaçınılması gereken içerikler hakkında net, klinik bir dil kullan.` };
    if (/rutin|sıralama|sabah gece|adım|uygulama sırası|nasıl sürül|hangi önce|hangi sıra/.test(t))
      return { konu: "Rutin & Uygulama", prompt: `Kullanıcının sorusu: "${input}". Bu, rutin sıralaması veya uygulama tekniği ile ilgili. Sabah/akşam rutini, adım sıralaması ve uygulama düzeni hakkında eczacı tonunda, adım adım rehberlik et.` };
    if (/retinol|niasinamid|vitamin c|c vitamini|asit|aha|bha|pha|seramid|bileşen|içerik|karıştır|kombine|birlikte kullan/.test(t))
      return { konu: "İçerik & Bileşen", prompt: `Kullanıcının sorusu: "${input}". Bu, aktif bileşenler veya içerik kombinasyonu ile ilgili. Mekanizma, kullanım koşulları ve kombinasyon güvenliği hakkında klinik, özlü ve anlaşılır cevap ver.` };
    if (/ürün|krem|serum|temizleyici|tonik|nemlendirici|güneş|hangi ürün|öneri|tavsiye|bul|marka/.test(t))
      return { konu: "Ürün Eşleştirme", prompt: `Kullanıcının isteği: "${input}". Uygun ürün bulması gerekiyor. Cilt tipini, ana endişesini, bilinen alerjilerini ve bütçe aralığını sor. Ardından kategoriye göre uygun öneriler sun.` };
    if (/akne|sivilce|siyah nokta|gözenek|yağlı/.test(t))
      return { konu: "Akne", prompt: `Kullanıcının endişesi: "${input}". Aktif akne mi yoksa iz mi olduğunu, cilt yağ düzeyini ve hassasiyet durumunu sor. Ardından klinik, sakin bir eczacı tonunda öneriler sun.` };
    if (/kızarıklık|hassas|tahriş|roza|rozase|reaktif/.test(t))
      return { konu: "Hassas & Reaktif Cilt", prompt: `Kullanıcının endişesi: "${input}". Tetikleyicileri, mevcut kullanılan ürünleri ve reaksiyon şiddetini sor. Bariyer onarımı odaklı, sakin bir yaklaşımla yönlendir.` };
    if (/leke|iz|hiperpigment|aydınlat|esmer/.test(t))
      return { konu: "Leke & Ton Eşitsizliği", prompt: `Kullanıcının endişesi: "${input}". SPF kullanımını, lekelerin türünü (PIH, melasma, güneş) ve ne zamandır olduğunu sor. Ardından leke bakımında güvenli, etkili bir yol haritası çiz.` };
    if (/kuruluk|gerginlik|soyulma|kuru|dehidrate/.test(t))
      return { konu: "Kuruluk & Nem", prompt: `Kullanıcının endişesi: "${input}". Cildin ne zaman ne kadar kurulduğunu, mevcut nemlendirici kullanımını sor. Nem katmanlama ve bariyer güçlendirme üzerine pratik öneriler sun.` };
    // Genel endişe — default
    return { konu: "Danışma", prompt: `Kullanıcının endişesi: "${input}". Bu konuyu biraz daha anlamak için 1-2 kısa soru sor: cilt tipi, süre, mevcut ürün kullanımı. Ardından sakin ve net bir eczacı tonunda yönlendir.` };
  }, []);

  // ── Yapılandırılmış rapor al ──────────────────────────────────────────────────
  const getRapor = useCallback(async () => {
    if (raporYukleniyor || mesajlar.length < 2) return;
    setRaporYukleniyor(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const ozetIstegi =
      'Bu konuşmayı Türkçe olarak şu JSON formatında özetle — sadece JSON ver, başka metin yazma: {"genel":"...","onecikar":"...","yon":"...","kacin":"...","dikkat":"...","sonraki":"..."}. genel=genel izlenim (1-2 cümle), onecikar=öne çıkan bulgu (1-2 cümle), yon=önerilen yön (1-2 cümle), kacin=şimdilik kaçınılması gerekenler (1-2 cümle), dikkat=dikkat edilmesi gerekenler (1-2 cümle), sonraki=somut sonraki adım (1-2 cümle). Eczacı tonunda, kısa, net.';

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/danisma`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...mesajlar.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: ozetIstegi },
          ],
        }),
      });
      if (!res.ok) return;

      const contentType = res.headers.get("content-type") ?? "";
      let fullText = "";

      if (contentType.includes("text/event-stream") || contentType.includes("text/plain")) {
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const lines = decoder.decode(value, { stream: true }).split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6);
              if (payload === "[DONE]") break;
              try { fullText += JSON.parse(payload).choices?.[0]?.delta?.content ?? ""; } catch {}
            }
          }
        } else {
          // Fallback: buffer full SSE response and parse at once
          const raw = await res.text();
          for (const line of raw.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try { fullText += JSON.parse(payload).choices?.[0]?.delta?.content ?? ""; } catch {}
          }
        }
      } else {
        const data = await res.json();
        fullText = data.content ?? data.message ?? "";
      }

      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const p = JSON.parse(jsonMatch[0]);
        setResultBlocks({
          genel:    p.genel    ?? "",
          onecikar: p.onecikar ?? "",
          yon:      p.yon      ?? "",
          kacin:    p.kacin    ?? "",
          dikkat:   p.dikkat   ?? "",
          sonraki:  p.sonraki  ?? "",
        });
        setMod("result");
      }
    } catch {
      // sessizce geç
    } finally {
      setRaporYukleniyor(false);
    }
  }, [mesajlar, raporYukleniyor]);

  // ── Renk yardımcısı ─────────────────────────────────────────────────────────
  const cardBg   = isDark ? colors.surfaceCard : "#FAFAFA";
  const borderC  = isDark ? colors.border      : "rgba(0,0,0,0.07)";
  const accent   = "#7A8F6B";

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={isDark ? ["#242E1E", "#1C2818"] : ["#7A8F6B", "#6B7F5D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <View style={styles.headerDeco1} />
        <View style={styles.headerDeco2} />
        <View style={styles.headerRow}>
          {mod !== "home" ? (
            <TouchableOpacity style={styles.backBtn} onPress={geriGit}>
              <Feather name="arrow-left" size={19} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.backBtn} onPress={() => safeBack(router, "/(tabs)/profil")}>
              <Feather name="arrow-left" size={19} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>DermoAsistan</Text>
            {mod !== "home" && (
              <Text style={styles.headerSub}>
                {mod === "rutin" ? "Rutin değerlendirme" : mod === "tree" ? `${aktifKonu} · Hızlı değerlendirme` : mod === "tree_result" ? `${aktifKonu} · Şahsi Rutin` : aktifKonu || "Danışmanlık"}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* ═══════════════════ ANA EKRAN — CLEAN ENTRY ═══════════════════════════ */}
      {mod === "home" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[hStyles.homeScroll, { paddingBottom: ctaBarBottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Konu başlığı */}
          <Text style={[hStyles.homeSubtitle, { color: colors.textSecondary }]}>Neye bakalım?</Text>

          {/* ECZ4 Issue C: Son sohbetler şeridi — yalnız geçmiş varsa görünür */}
          {historyThreads.length > 0 && (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setHistoryOpen(true); }}
              activeOpacity={0.78}
              style={[
                histStyles.stripBtn,
                {
                  backgroundColor: isDark ? "rgba(122,143,107,0.10)" : "#F4F7F1",
                  borderColor:     isDark ? "rgba(122,143,107,0.22)" : "rgba(122,143,107,0.18)",
                },
              ]}
            >
              <View style={[histStyles.stripIcon, { backgroundColor: isDark ? "rgba(122,143,107,0.20)" : "#E4ECDD" }]}>
                <Feather name="clock" size={13} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[histStyles.stripTitle, { color: isDark ? "#C8D5C8" : "#3A4F3A" }]} numberOfLines={1}>
                  Son sohbetler
                </Text>
                <Text style={[histStyles.stripSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {historyThreads.length} kayıtlı sohbet · son: {historyThreads[0]?.title ?? ""}
                </Text>
              </View>
              <Feather name="chevron-right" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Konu kartları — her zaman görünür */}
          <View style={styles.konuGrid}>
            {KONULAR.map(konu => (
              <TouchableOpacity
                key={konu.id}
                style={[styles.konuCard, { backgroundColor: isDark ? konu.bgDark : konu.bg, borderColor: `${konu.renk}25` }]}
                onPress={() => konuSec(konu)}
                activeOpacity={0.76}
              >
                <View style={[styles.konuIconBox, { backgroundColor: `${konu.renk}18` }]}>
                  <Feather name={konu.icon} size={14} color={konu.renk} />
                </View>
                <Text style={[styles.konuLabel, { color: isDark ? konu.renk : "#1F2937" }]} numberOfLines={1}>
                  {konu.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Araç kartları */}
          <View style={{ gap: 9, marginTop: 4 }}>
            <TouchableOpacity
              style={[styles.featureCard, { backgroundColor: isDark ? "#0F1A2A" : "#EFF6FF", borderColor: isDark ? "rgba(37,99,235,0.20)" : "rgba(37,99,235,0.14)" }]}
              onPress={urunBul} activeOpacity={0.8}
            >
              <View style={[styles.featureIcon, { backgroundColor: isDark ? "rgba(37,99,235,0.15)" : "#DBEAFE" }]}>
                <Feather name="search" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: isDark ? "#93C5FD" : "#1D4ED8" }]}>Bana Uygun Ürün Bul</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featureCard, { backgroundColor: isDark ? "rgba(122,143,107,0.10)" : "#EAF1EA", borderColor: isDark ? "rgba(122,143,107,0.22)" : "rgba(122,143,107,0.16)" }]}
              onPress={() => {
                if (!isSeckin) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setMod("gate"); return; }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMod("rutin");
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIcon, { backgroundColor: isDark ? "rgba(122,143,107,0.20)" : "#EAF1EA" }]}>
                <Feather name="layers" size={18} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: isDark ? "#9DB88D" : "#5C7050" }]}>Rutinini Değerlendir</Text>
                <Text style={[styles.featureSub, { color: colors.textSecondary }]}>Mevcut ürünlerini analiz ettir</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.featureCard, { backgroundColor: isDark ? "#1A0C00" : "#FFF7ED", borderColor: isDark ? "rgba(234,88,12,0.20)" : "rgba(234,88,12,0.14)" }]}
              onPress={() => konuSec({ id: "hamilelik", label: "Alerji & Uyarılar", icon: "alert-triangle", renk: "#EA580C", bg: "#FFF7ED", bgDark: "#1A0C00", sistemPrompt: "Kullanıcı cilt bakım alerjileri ve içerik güvenliği hakkında bilgi almak istiyor. Hangi içeriklere tepki verdiğini, ne tür semptomlar yaşadığını sor. Kaçınılması gereken içerikler ve güvenli alternatifler hakkında bilgi ver." })}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIcon, { backgroundColor: isDark ? "rgba(234,88,12,0.15)" : "#FED7AA" }]}>
                <Feather name="alert-triangle" size={18} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: isDark ? "#FB923C" : "#9A3412" }]}>Alerji & Uyarılar</Text>
                <Text style={[styles.featureSub, { color: colors.textSecondary }]}>İçerik güvenliği, hamilelik, hassasiyet</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Serbest soru girişi */}
          <View style={[hStyles.askBar, { backgroundColor: cardBg, borderColor: borderC }]}>
            <TextInput
              style={[hStyles.askInput, { color: colors.text }]}
              placeholder="Bir soru sor..."
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (!input.trim()) return;
                if (!isSeckin) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setMod("gate"); return; }
                const userInput = input.trim();
                // ECZ4 Issue D: typed question wins. detectIntent yalnız aktifKonu
                // tagging için kullanılır; user'ın YAZDIĞI metin doğrudan API'ye user
                // mesajı olarak gider — enrichment prompt ile DEĞİŞTİRİLMEZ. Önceki
                // davranış [user="Hamile niasinamid..."] + [user="Önce 1 kısa soru sor..."]
                // çift-user payload yolluyor, AI da enrichment'taki "önce soru sor"
                // direktifine uyup cevap yerine "Cilt tipin ne?" basıyordu. Artık tek
                // user mesajı ⇒ AI doğrudan cevap verir.
                const { konu } = detectIntent(userInput);
                setAktifKonu(konu); setMesajlar([]); setHata(null); setMod("chat");
                setInput("");
                setTimeout(() => gonder(userInput, [], false), 80);
              }}
            />
            <TouchableOpacity
              style={[hStyles.askSend, { backgroundColor: input.trim() ? accent : colors.border }]}
              onPress={() => {
                if (!input.trim()) return;
                if (!isSeckin) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); setMod("gate"); return; }
                const userInput = input.trim();
                // ECZ4 Issue D: typed question wins. Bkz. onSubmitEditing yorumu.
                const { konu } = detectIntent(userInput);
                setAktifKonu(konu); setMesajlar([]); setHata(null); setMod("chat");
                setInput("");
                setTimeout(() => gonder(userInput, [], false), 80);
              }}
              disabled={!input.trim()}
            >
              <Feather name="send" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ═══════════════════ PRİMİUM GATE ════════════════════════════════════ */}
      {mod === "gate" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.homeContent, { paddingBottom: ctaBarBottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <PremiumLockCard
            title="DermoAsistan"
            description="AI destekli şahsi cilt danışmanlığı, derin analiz ve rutin değerlendirme Seçkin Üyelere özeldir."
            features={[
              "Cilt sorularınıza uzman AI cevapları",
              "Rutin analizi ve içerik güvenliği kontrolü",
              "Ürün eşleştirme ve şahsi öneriler",
              "Derin şahsi analiz raporu",
            ]}
            onUpgrade={() => router.push("/uyelik")}
          />
          <TouchableOpacity
            style={{ marginTop: 16, alignSelf: "center", paddingVertical: 8 }}
            onPress={() => setMod("home")}
          >
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>← Geri dön</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ═══════════════════ KARAR AĞACI ═══════════════════════════════════════ */}
      {mod === "tree" && treeKonuId in DECISION_TREES && (
        <TreeScreen
          tree={DECISION_TREES[treeKonuId]}
          step={treeStep}
          answers={treeAnswers}
          treeAnim={treeAnim}
          colors={colors}
          isDark={isDark}
          ctaBarBottom={ctaBarBottom}
          onAnswer={(questionId, value) => {
            const tree = DECISION_TREES[treeKonuId];
            const newAnswers = { ...treeAnswers, [questionId]: value };
            setTreeAnswers(newAnswers);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (treeStep < tree.questions.length - 1) {
              // slide out left, then show next question
              Animated.sequence([
                Animated.timing(treeAnim, { toValue: -1, duration: 180, useNativeDriver: true }),
                Animated.timing(treeAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
                Animated.spring(treeAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
              ]).start();
              setTreeStep(s => s + 1);
            } else {
              // last answer → finish
              finishTree(treeKonuId, newAnswers);
            }
          }}
        />
      )}

      {/* ═══════════════════ AĞAÇ SONUCU — KİŞİSEL RUTİN ════════════════════════ */}
      {mod === "tree_result" && treeRoutine.length > 0 && treeProfile && (
        <RoutinePreviewScreen
          konuLabel={treeKonuLabel}
          profile={treeProfile}
          routine={treeRoutine}
          productSlots={productSlots}
          productsFetching={productsFetching}
          colors={colors}
          isDark={isDark}
          ctaBarBottom={ctaBarBottom}
          onChat={startChatFromTree}
          onBack={() => setMod("home")}
        />
      )}

      {/* ═══════════════════ RUTİN DEĞERLENDİRME ══════════════════════════════ */}
      {mod === "rutin" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.homeContent, { paddingBottom: ctaBarBottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.freeInputCard, { backgroundColor: cardBg, borderColor: borderC }]}>
            <Text style={[styles.sectionLabel, { color: isDark ? "#9DB88D" : accent }]}>RUTİNİNİ DEĞERLENDİR</Text>
            <Text style={[styles.freeInputHint, { color: colors.textSecondary }]}>
              Mevcut ürünlerini gir — eczacı bakışıyla analiz edelim.
            </Text>

            {/* İlerleme */}
            <View style={{ flexDirection: "row", gap: 5, marginBottom: 12 }}>
              {RUTIN_ADIMLAR.map((_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: i <= rutinAdim
                      ? accent
                      : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                  }}
                />
              ))}
            </View>

            {/* Mevcut adım */}
            <Text style={[styles.rutinAdimLabel, { color: colors.text }]}>
              {RUTIN_ADIMLAR[rutinAdim].label}
            </Text>
            <View style={[styles.freeInputBox, { backgroundColor: colors.background, borderColor: borderC, marginTop: 6 }]}>
              <TextInput
                style={[styles.freeInput, { color: colors.text }]}
                placeholder={RUTIN_ADIMLAR[rutinAdim].placeholder}
                placeholderTextColor={colors.textMuted}
                value={rutinGiris}
                onChangeText={setRutinGiris}
                multiline
                maxLength={300}
              />
            </View>

            {/* Önceki cevaplar */}
            {Object.entries(rutinCevaplar).map(([k, v]) => {
              const adim = RUTIN_ADIMLAR.find(a => a.id === k);
              return (
                <View key={k} style={{ marginTop: 8, flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                  <Feather name="check-circle" size={13} color={accent} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>
                    <Text style={{ fontWeight: "600" }}>{adim?.label}: </Text>{v}
                  </Text>
                </View>
              );
            })}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              {rutinAdim > 0 && (
                <TouchableOpacity
                  style={[styles.rutinBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#F3F4F6", flex: 0.4 }]}
                  onPress={() => {
                    const adim = RUTIN_ADIMLAR[rutinAdim];
                    setRutinCevaplar(prev => { const c = { ...prev }; delete c[adim.id]; return c; });
                    setRutinAdim(p => p - 1);
                    setRutinGiris(rutinCevaplar[RUTIN_ADIMLAR[rutinAdim - 1].id] ?? "");
                  }}
                >
                  <Feather name="arrow-left" size={14} color={colors.textSecondary} />
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Geri</Text>
                </TouchableOpacity>
              )}
              {rutinAdim < RUTIN_ADIMLAR.length - 1 ? (
                <TouchableOpacity
                  style={[styles.rutinBtn, { backgroundColor: accent, flex: 1 }]}
                  onPress={() => {
                    const adim = RUTIN_ADIMLAR[rutinAdim];
                    if (rutinGiris.trim()) setRutinCevaplar(prev => ({ ...prev, [adim.id]: rutinGiris.trim() }));
                    setRutinAdim(p => p + 1);
                    setRutinGiris(rutinCevaplar[RUTIN_ADIMLAR[rutinAdim + 1]?.id] ?? "");
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Devam</Text>
                  <Feather name="arrow-right" size={14} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.rutinBtn, { backgroundColor: accent, flex: 1 }]}
                  onPress={rutinGonder}
                >
                  <Feather name="bar-chart-2" size={14} color="#fff" />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Değerlendir</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Değerlendirme çıktısı önizlemesi */}
          <View style={[styles.freeInputCard, { backgroundColor: isDark ? "rgba(122,143,107,0.06)" : "#EAF1EA", borderColor: isDark ? "rgba(122,143,107,0.15)" : "rgba(122,143,107,0.12)" }]}>
            <Text style={[styles.sectionLabel, { color: isDark ? "#9DB88D" : accent, marginBottom: 8 }]}>DEĞERLENDİRME KAPSAR</Text>
            {[
              "İyi giden noktalar",
              "Fazla aktif içerik riski",
              "Bariyer yorgunluğu ihtimali",
              "SPF eksikliği",
              "İçerik çakışmaları",
              "Sıralama önerisi",
              "Sadeleştirme tavsiyesi",
            ].map(item => (
              <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <Feather name="check" size={12} color={accent} />
                <Text style={{ fontSize: 12.5, color: colors.textSecondary }}>{item}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ═══════════════════ SOHBET EKRANI ══════════════════════════════════════ */}
      {mod === "chat" && (
        <View style={{ flex: 1, marginBottom: tabBarHeight }}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.chatContent, { paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Konu bandı */}
            {aktifKonu && (
              <View style={[styles.topicBand, { backgroundColor: isDark ? "rgba(122,143,107,0.12)" : "rgba(122,143,107,0.07)", borderColor: isDark ? "rgba(122,143,107,0.22)" : "rgba(122,143,107,0.14)" }]}>
                <Feather name="tag" size={11} color={isDark ? "#9DB88D" : accent} />
                <Text style={{ fontSize: 11.5, color: isDark ? "#9DB88D" : accent, fontWeight: "600" }}>{aktifKonu}</Text>
              </View>
            )}

            {/* Boş durum — yükleme bekleniyor */}
            {mesajlar.filter(m => !m.hidden).length === 0 && yukleniyor && (
              <View style={styles.emptyChat}>
                <Animated.View style={[styles.warmSkeletonIcon, { backgroundColor: isDark ? "rgba(122,143,107,0.14)" : "#EAF1EA", opacity: pulseAnim }]}>
                  <Feather name="message-circle" size={22} color={isDark ? "#9DB88D" : "#7A8F6B"} />
                </Animated.View>
              </View>
            )}

            {/* Mesaj baloncukları */}
            {mesajlar.filter(m => !m.hidden).map((msg, idx) => {
              if (msg.role === "assistant" && msg.streaming && msg.content === "") {
                return (
                  <Animated.View
                    key={idx}
                    style={[styles.warmSkeletonIcon, { backgroundColor: isDark ? "rgba(122,143,107,0.14)" : "#EAF1EA", opacity: pulseAnim, alignSelf: "flex-start", marginLeft: 4 }]}
                  >
                    <Feather name="message-circle" size={16} color={isDark ? "#9DB88D" : "#7A8F6B"} />
                  </Animated.View>
                );
              }
              if (msg.role === "assistant") {
                return (
                  <View
                    key={idx}
                    style={[
                      styles.aiBubble,
                      {
                        backgroundColor: isDark ? colors.surfaceCard : "#F2F7F2",
                        borderColor: isDark ? "rgba(122,143,107,0.22)" : "rgba(122,143,107,0.18)",
                      },
                    ]}
                  >
                    <AIBubbleContent
                      content={msg.content}
                      streaming={msg.streaming}
                      colors={colors}
                      isDark={isDark}
                      accent={accent}
                    />
                  </View>
                );
              }
              return (
                <View
                  key={idx}
                  style={[styles.bubble, styles.userBubble, { backgroundColor: accent }]}
                >
                  <Text style={[styles.bubbleText, { color: "#fff" }]}>
                    {msg.content}
                  </Text>
                </View>
              );
            })}

            {/* Anlık seçenek butonları */}
            {openingSecenekler.length > 0 && !yukleniyor && (
              <View style={styles.quickBtnWrap}>
                {openingSecenekler.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.quickBtn, {
                      backgroundColor: isDark ? "rgba(122,143,107,0.10)" : "#F0F6F0",
                      borderColor: isDark ? "rgba(122,143,107,0.28)" : "#C3D5C3",
                    }]}
                    onPress={() => handleOpeningSecenek(s)}
                    activeOpacity={0.72}
                  >
                    <Text style={[styles.quickBtnText, { color: isDark ? "#A8C8A0" : "#4A6B4A" }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Hata */}
            {hata && (
              <View style={[styles.errBubble, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}28` }]}>
                <Feather name="alert-circle" size={13} color={colors.danger} />
                <Text style={[styles.errText, { color: colors.danger }]}>{hata}</Text>
              </View>
            )}

            {/* Danışma özeti butonu — son AI mesajı tamamlandıktan sonra görünür */}
            {mesajlar.length >= 2 && !yukleniyor && !mesajlar[mesajlar.length - 1]?.streaming && mesajlar[mesajlar.length - 1]?.role === "assistant" && (
              <TouchableOpacity
                style={[styles.raporBtn, { backgroundColor: isDark ? "rgba(122,143,107,0.14)" : "rgba(122,143,107,0.08)", borderColor: isDark ? "rgba(122,143,107,0.30)" : "rgba(122,143,107,0.20)" }]}
                onPress={getRapor}
                disabled={raporYukleniyor}
                activeOpacity={0.76}
              >
                {raporYukleniyor ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : (
                  <Feather name="file-text" size={13} color={isDark ? "#9DB88D" : accent} />
                )}
                <Text style={{ fontSize: 12.5, color: isDark ? "#9DB88D" : accent, fontWeight: "600" }}>
                  {raporYukleniyor ? "Özet hazırlanıyor..." : "Danışma Özetini Gör"}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Input bar */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom, borderTopColor: borderC, backgroundColor: colors.background }]}>
            <View style={[styles.inputBox, { backgroundColor: isDark ? colors.surfaceCard : "#F5F7F5", borderColor: borderC }]}>
              <TextInput
                style={[styles.inputField, { color: colors.text }]}
                placeholder="Cevapla veya devam et..."
                placeholderTextColor={colors.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => gonder(input)}
                editable={!yukleniyor}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: input.trim() && !yukleniyor ? accent : colors.border }]}
                onPress={() => gonder(input)}
                disabled={!input.trim() || yukleniyor}
              >
                {yukleniyor
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="send" size={15} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ═══════════════════ RAPOR EKRANI ════════════════════════════════════════ */}
      {mod === "result" && resultBlocks && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.homeContent, { paddingBottom: ctaBarBottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Başlık bandı */}
          <View style={[styles.resultHeader, { backgroundColor: isDark ? "rgba(122,143,107,0.10)" : "#EAF1EA", borderColor: isDark ? "rgba(122,143,107,0.25)" : "rgba(122,143,107,0.18)" }]}>
            <View style={[styles.resultHeaderIcon, { backgroundColor: isDark ? "rgba(122,143,107,0.20)" : "#EAF1EA" }]}>
              <Feather name="file-text" size={15} color={accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.resultHeaderTitle, { color: isDark ? "#9DB88D" : accent }]}>Danışma Özeti</Text>
              <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>{aktifKonu || "DermoAsistan"}</Text>
            </View>
            <TouchableOpacity
              style={[styles.resultNavBtn, { backgroundColor: isDark ? "rgba(122,143,107,0.18)" : "rgba(122,143,107,0.10)" }]}
              onPress={() => setMod("chat")}
            >
              <Feather name="message-circle" size={12} color={isDark ? "#9DB88D" : accent} />
              <Text style={{ fontSize: 11, color: isDark ? "#9DB88D" : accent, fontWeight: "600" }}>Sohbet</Text>
            </TouchableOpacity>
          </View>

          {/* 6 Yapılandırılmış Blok */}
          {([
            { key: "genel",    icon: "info"               as const, tag: "GENEL İZLENİM",     color: "#7A8F6B", bgLight: "#EAF1EA", bgDark: "rgba(122,143,107,0.10)",  bdLight: "rgba(122,143,107,0.18)",  bdDark: "rgba(122,143,107,0.28)"  },
            { key: "onecikar", icon: "eye"                as const, tag: "ÖNE ÇIKAN",         color: "#2563EB", bgLight: "#EFF6FF", bgDark: "#0F1A2A",               bdLight: "rgba(37,99,235,0.16)",  bdDark: "rgba(37,99,235,0.28)"  },
            { key: "yon",      icon: "navigation"         as const, tag: "ÖNERİLEN YÖN",      color: "#7A8F6B", bgLight: "#EAF1EA", bgDark: "#1E2D18",               bdLight: "rgba(5,150,105,0.16)",  bdDark: "rgba(5,150,105,0.28)"  },
            { key: "kacin",    icon: "slash"              as const, tag: "ŞİMDİLİK KAÇIN",    color: "#DC2626", bgLight: "#FEF2F2", bgDark: "#2A0A0A",               bdLight: "rgba(220,38,38,0.16)",  bdDark: "rgba(220,38,38,0.28)"  },
            { key: "dikkat",   icon: "alert-triangle"     as const, tag: "DİKKAT ET",         color: "#D97706", bgLight: "#FFFBEB", bgDark: "#1A0C00",               bdLight: "rgba(217,119,6,0.16)",  bdDark: "rgba(217,119,6,0.28)"  },
            { key: "sonraki",  icon: "arrow-right-circle" as const, tag: "SONRAKİ ADIM",      color: "#7C3AED", bgLight: "#F5F3FF", bgDark: "#1A0A2E",               bdLight: "rgba(124,58,237,0.16)", bdDark: "rgba(124,58,237,0.28)" },
          ] as const).map(block => {
            const val = resultBlocks[block.key as keyof ResultBlocks];
            if (!val) return null;
            return (
              <View
                key={block.key}
                style={[styles.resultBlock, {
                  backgroundColor: isDark ? block.bgDark : block.bgLight,
                  borderColor:     isDark ? block.bdDark : block.bdLight,
                }]}
              >
                <View style={[styles.resultBlockIcon, { backgroundColor: `${block.color}18` }]}>
                  <Feather name={block.icon} size={13} color={block.color} />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={[styles.resultBlockLabel, { color: block.color }]}>{block.tag}</Text>
                  <Text style={[styles.resultBlockText, { color: colors.text }]}>{val}</Text>
                </View>
              </View>
            );
          })}

          {/* Alt aksiyon butonları */}
          <View style={{ flexDirection: "row", gap: 9, marginTop: 4 }}>
            <TouchableOpacity
              style={[styles.resultActionBtn, { backgroundColor: isDark ? "rgba(122,143,107,0.12)" : "rgba(122,143,107,0.08)", borderColor: isDark ? "rgba(122,143,107,0.25)" : "rgba(122,143,107,0.18)", flex: 1 }]}
              onPress={() => setMod("chat")}
            >
              <Feather name="message-circle" size={13} color={isDark ? "#9DB88D" : accent} />
              <Text style={{ fontSize: 12.5, color: isDark ? "#9DB88D" : accent, fontWeight: "600" }}>Sohbete Dön</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resultActionBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB", borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)", flex: 1 }]}
              onPress={geriGit}
            >
              <Feather name="home" size={13} color={colors.textMuted} />
              <Text style={{ fontSize: 12.5, color: colors.textSecondary, fontWeight: "600" }}>Ana Menü</Text>
            </TouchableOpacity>
          </View>

          {/* DermoAsistan → Rutinim bağlantısı */}
          {(() => {
            const flowMap: Record<string, string> = {
              "Akne":               "akne",
              "Leke":               "leke",
              "Hassas Cilt":        "hassasiyet",
              "Kuruluk":            "kuruluk",
              "Güneş Koruması":     "gunes",
              "Saç Dökülmesi":      "sac",
              "Yağlı Cilt":         "akne",
              "Cilt Bariyeri":      "hassasiyet",
              "Roza":               "hassasiyet",
              "Yaşlanma Karşıtı":  "yaslanma",
            };
            const flowId = flowMap[aktifKonu];
            if (!flowId) return (
              <TouchableOpacity
                style={[styles.resultActionBtn, { marginTop: 0, backgroundColor: isDark ? "rgba(124,58,237,0.10)" : "rgba(124,58,237,0.07)", borderColor: isDark ? "rgba(124,58,237,0.25)" : "rgba(124,58,237,0.18)" }]}
                onPress={() => router.push("/(tabs)/rutin" as any)}
              >
                <Feather name="layers" size={13} color="#7C3AED" />
                <Text style={{ fontSize: 12.5, color: "#7C3AED", fontWeight: "600", flex: 1, textAlign: "center" }}>Rutinim'e Git</Text>
              </TouchableOpacity>
            );
            return (
              <TouchableOpacity
                style={[styles.resultActionBtn, { marginTop: 0, backgroundColor: isDark ? "rgba(124,58,237,0.10)" : "rgba(124,58,237,0.07)", borderColor: isDark ? "rgba(124,58,237,0.25)" : "rgba(124,58,237,0.18)" }]}
                onPress={() => {
                  // ECZ4 GLOBAL — Misafir kişisel rutin oluşturamaz; /giris.
                  if (!danismaIsRegistered) {
                    router.push("/giris" as any);
                    return;
                  }
                  router.push(`/(tabs)/(home)/rutin-olustur?flow=${flowId}&premium=0&from=danisma` as any);
                }}
              >
                <Feather name="plus-circle" size={13} color="#7C3AED" />
                <Text style={{ fontSize: 12.5, color: "#7C3AED", fontWeight: "600", flex: 1, textAlign: "center" }}>Bu Konuya Göre Rutin Oluştur</Text>
              </TouchableOpacity>
            );
          })()}
        </ScrollView>
      )}
      {/* ── ECZ4 Issue C: Geçmiş Modalı ──────────────────────────────────── */}
      <Modal
        visible={historyOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={histStyles.modalRoot}>
          <Pressable style={histStyles.modalBackdrop} onPress={() => setHistoryOpen(false)} />
          <View
            style={[
              histStyles.modalSheet,
              {
                backgroundColor: isDark ? "#1A2418" : "#FFFFFF",
                borderColor:     isDark ? "rgba(122,143,107,0.22)" : "rgba(0,0,0,0.06)",
                paddingBottom:   Math.max(insets.bottom, 14) + 6,
              },
            ]}
          >
            <View style={histStyles.modalHandle} />
            <View style={histStyles.modalHeader}>
              <Text style={[histStyles.modalTitle, { color: isDark ? "#E8F0E8" : "#1A2D1A" }]}>
                DermoAsistan Geçmişi
              </Text>
              <TouchableOpacity onPress={() => setHistoryOpen(false)} hitSlop={8}>
                <Feather name="x" size={20} color={isDark ? "#9DB88D" : "#6A8A6A"} />
              </TouchableOpacity>
            </View>

            {historyThreads.length === 0 ? (
              <View style={{ paddingVertical: 28, alignItems: "center" }}>
                <Feather name="message-circle" size={26} color={isDark ? "#6A8A6A" : "#9DB88D"} />
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>
                  Henüz kayıtlı sohbet yok.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {historyThreads.map(t => (
                  <View key={t.id} style={[histStyles.itemRow, { borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }]}>
                    <Pressable
                      onPress={() => restoreThread(t)}
                      style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Text style={[histStyles.itemTitle, { color: isDark ? "#E8F0E8" : "#1A2D1A" }]} numberOfLines={1}>
                        {t.title}
                      </Text>
                      <Text style={[histStyles.itemMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {t.messages.length} mesaj · {new Date(t.updatedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </Pressable>
                    <TouchableOpacity
                      onPress={() => handleDeleteThread(t.id)}
                      hitSlop={8}
                      style={{ padding: 6, marginLeft: 6 }}
                    >
                      <Feather name="trash-2" size={15} color={isDark ? "#9A6A6A" : "#B66565"} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {historyThreads.length > 0 && (
              <TouchableOpacity
                onPress={handleClearHistory}
                style={[
                  histStyles.clearBtn,
                  { borderColor: isDark ? "rgba(182,101,101,0.35)" : "rgba(182,101,101,0.30)" },
                ]}
                activeOpacity={0.78}
              >
                <Feather name="trash" size={13} color="#B66565" />
                <Text style={{ fontSize: 12.5, color: "#B66565", fontWeight: "600" }}>
                  Tüm geçmişi temizle
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── TreeScreen ──────────────────────────────────────────────────────────────
function TreeScreen({
  tree, step, answers, treeAnim, colors, isDark, ctaBarBottom, onAnswer,
}: {
  tree: ConcernTree;
  step: number;
  answers: Record<string, string>;
  treeAnim: Animated.Value;
  colors: any;
  isDark: boolean;
  ctaBarBottom: number;
  onAnswer: (questionId: string, value: string) => void;
}) {
  const question = tree.questions[step];
  if (!question) return null;
  const total = tree.questions.length;
  const accent = "#7A8F6B";

  const slideX = treeAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-120, 0, 120],
  });
  const opacity = treeAnim.interpolate({
    inputRange: [-1, -0.4, 0, 0.4, 1],
    outputRange: [0, 0, 1, 0, 0],
  });

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: ctaBarBottom + 24 }}>
      {/* İlerleme çubuğu */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 }}>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <Animated.View style={{ height: 4, width: `${((step + 1) / total) * 100}%`, backgroundColor: accent, borderRadius: 2 }} />
        </View>
        <Text style={{ fontSize: 11.5, fontWeight: "600", color: colors.textMuted }}>{step + 1}/{total}</Text>
      </View>

      {/* Soru kartı */}
      <Animated.View style={{ transform: [{ translateX: slideX }], opacity, flex: 1 }}>
        {/* Nokta göstergeleri */}
        <View style={{ flexDirection: "row", gap: 5, marginBottom: 20, justifyContent: "center" }}>
          {tree.questions.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                backgroundColor: i < step ? accent : i === step ? accent : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
        </View>

        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text, lineHeight: 29, marginBottom: question.altBilgi ? 8 : 24, letterSpacing: -0.4 }}>
          {question.soru}
        </Text>
        {question.altBilgi ? (
          <Text style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 22, lineHeight: 17 }}>
            {question.altBilgi}
          </Text>
        ) : null}

        {/* Seçenekler */}
        <View style={{ gap: 10 }}>
          {question.options.map((opt, idx) => {
            const isSelected = answers[question.id] === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  treeStyles.optionBtn,
                  {
                    backgroundColor: isSelected
                      ? isDark ? `${accent}25` : `${accent}12`
                      : isDark ? colors.surfaceCard : "#fff",
                    borderColor: isSelected ? accent : isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
                onPress={() => onAnswer(question.id, opt.value)}
                activeOpacity={0.72}
              >
                <View style={[treeStyles.optionIndex, { backgroundColor: isSelected ? `${accent}20` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isSelected ? accent : colors.textMuted }}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                </View>
                <Text style={[treeStyles.optionLabel, { color: isSelected ? (isDark ? "#9DB88D" : "#3D5030") : colors.text }]}>
                  {opt.label}
                </Text>
                {isSelected ? <Feather name="check-circle" size={16} color={accent} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Son soru altı bilgi */}
        {step === total - 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 22, justifyContent: "center" }}>
            <Feather name="zap" size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 11.5, color: colors.textMuted }}>Son soru — hemen analiz başlıyor</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

// ── Rutin Önizleme Ekranı ─────────────────────────────────────────────────────

const ROLE_CONFIG: Record<RoutineRole, { label: string; bg: string; text: string; border: string }> = {
  "Esas":          { label: "Esas",          bg: "#EAF1EA", text: "#3D5030", border: "#7A8F6B" },
  "Destek":        { label: "Destek",        bg: "#FDF6EE", text: "#7A5B35", border: "#C8A97E" },
  "İsteğe bağlı": { label: "İsteğe bağlı", bg: "#F5F5F5", text: "#666",    border: "#ccc"    },
};
const ROLE_CONFIG_DARK: Record<RoutineRole, { label: string; bg: string; text: string; border: string }> = {
  "Esas":          { label: "Esas",          bg: "#2E3D25", text: "#9DB88D", border: "#7A8F6B" },
  "Destek":        { label: "Destek",        bg: "#3A2E20", text: "#C8A97E", border: "#C8A97E" },
  "İsteğe bağlı": { label: "İsteğe bağlı", bg: "#292929", text: "#888",    border: "#444"    },
};

const PROFILE_SEVERITY_LABEL: Record<TreeProfile["severity"], string> = {
  "düşük": "Hafif", "orta": "Orta", "yüksek": "Ciddi",
};
const PROFILE_PRIORITY_LABEL: Record<TreeProfile["priority"], string> = {
  "onarım": "Bariyer Onarımı", "kontrol": "Kontrol", "tedavi": "Aktif Bakım",
};

function guessSlotId(stepCategory: string): string {
  const c = stepCategory.toLowerCase();
  if (c.includes("spf") || c.includes("güneş") || c.includes("gunes"))       return "spf";
  if (c.includes("toner") || c.includes("bha") || c.includes("aha"))          return "toner";
  if (c.includes("maske") || c.includes("mask"))                               return "maske";
  if (c.includes("serum") || c.includes("c vitamini") || c.includes("retinol") ||
      c.includes("bakuchiol") || c.includes("peptid") || c.includes("niasinamid") ||
      c.includes("centella") || c.includes("hyalüronik") || c.includes("azelaik"))  return "serum";
  if (c.includes("temizle"))                                                   return "temizleyici";
  if (c.includes("nemlendirici") || c.includes("bariyer") || c.includes("krem") ||
      c.includes("emollient") || c.includes("yağ"))                            return "nemlendirici";
  return "";
}

// ── ECZ4 — RoutineProductChip / RoutineSlotProducts ─────────────────────────
// Her routine ürünü clickable olmadan önce DB'de doğrulanır. Doğrulanan ürünler
// (verified) sticky audience guard'ı geçen DB-backed objeyle openDermoProduct
// kontratı kullanır. Doğrulanmayanlar passive (disabled) render edilir;
// hiçbir koşulda boş product/[id] sayfası açılmaz.

function RoutineProductChip({
  prod, pIdx, isDark, colors, accent, borderC, onVerified,
}: {
  prod: ProductCard;
  pIdx: number;
  isDark: boolean;
  colors: any;
  accent: string;
  borderC: string;
  onVerified: () => void;
}) {
  const key = routineVerifyKey(prod);
  const initial: RoutineVerifyState = verifiedRoutineCache.get(key) ?? { status: "loading" };
  const [state, setState] = useState<RoutineVerifyState>(initial);

  useEffect(() => {
    if (state.status !== "loading") return;
    let cancelled = false;
    verifyRoutineProduct(prod).then(s => {
      if (cancelled) return;
      setState(s);
      if (s.status === "verified") {
        // Doğrulanan DB-backed ürün için hero görseli idempotent prefetch.
        try { prefetchDermoProduct(s.product); } catch {}
        onVerified();
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const verified = state.status === "verified" ? state.product : null;
  const isLoading = state.status === "loading";
  const handlePress = () => {
    if (verified) openDermoProduct(verified);
  };

  // Visual: verified → primary look; unverified/loading → muted passive look.
  const isPrimaryVisual = pIdx === 0 && !!verified;
  const passiveOpacity = verified ? 1 : isLoading ? 0.7 : 0.55;

  return (
    <Pressable
      onPress={handlePress}
      disabled={!verified}
      style={({ pressed }) => [rpStyles.productChip, {
        opacity: pressed && verified ? 0.78 : passiveOpacity,
        backgroundColor: isDark
          ? isPrimaryVisual ? "rgba(122,143,107,0.12)" : "rgba(255,255,255,0.03)"
          : isPrimaryVisual ? "rgba(122,143,107,0.07)" : "rgba(0,0,0,0.02)",
        borderColor: isPrimaryVisual
          ? isDark ? "rgba(122,143,107,0.25)" : "rgba(122,143,107,0.20)"
          : borderC,
      }]}
    >
      {/* Ürün resmi — verified varsa DB image, yoksa server-supplied gorsel_url */}
      {(verified ? getProductImageUri(verified) : prod.gorsel_url) ? (
        <Image
          source={{ uri: (verified ? getProductImageUri(verified) : prod.gorsel_url) as string }}
          style={rpStyles.productImg}
          resizeMode="contain"
        />
      ) : (
        <View style={[rpStyles.productImgPlaceholder, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}>
          <Feather name="package" size={12} color={colors.textMuted} />
        </View>
      )}

      {/* Ürün bilgisi */}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[rpStyles.productBrand, { color: isPrimaryVisual ? (isDark ? "#9DB88D" : accent) : colors.textMuted }]}>
          {verified?.brand ?? prod.brand}
        </Text>
        <Text style={[rpStyles.productName, { color: colors.text }]} numberOfLines={2}>
          {verified?.name ?? prod.name}
        </Text>
        <View style={{ flexDirection: "row", gap: 5, marginTop: 2, flexWrap: "wrap" }}>
          {prod.score != null && prod.score > 0 && (
            <View style={[rpStyles.productBadge, { backgroundColor: isDark ? "rgba(122,143,107,0.15)" : "#EAF1EA" }]}>
              <Text style={{ fontSize: 9, color: isDark ? "#9DB88D" : "#3D5030", fontWeight: "700" }}>★ {prod.score.toFixed(1)}</Text>
            </View>
          )}
          {getFeatureFlag(prod, "fragrance") === false && (
            <View style={[rpStyles.productBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F0F0F0" }]}>
              <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: "600" }}>Parfümsüz</Text>
            </View>
          )}
          {prod.average_price != null && prod.average_price > 0 && (
            <View style={[rpStyles.productBadge, { backgroundColor: isDark ? "rgba(200,169,126,0.10)" : "#FDF6EE" }]}>
              <Text style={{ fontSize: 9, color: isDark ? "#C8A97E" : "#7A5B35", fontWeight: "600" }}>₺{Math.round(prod.average_price)}</Text>
            </View>
          )}
          {/* Passive cue: doğrulanmamış ürünler için kısa not */}
          {!verified && !isLoading && (
            <View style={[rpStyles.productBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }]}>
              <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: "600" }}>Bilgi amaçlı</Text>
            </View>
          )}
        </View>
      </View>

      {isPrimaryVisual && (
        <View style={{ alignSelf: "flex-start", marginTop: 1 }}>
          <Feather name="star" size={11} color={isDark ? "#9DB88D" : accent} />
        </View>
      )}
    </Pressable>
  );
}

function RoutineSlotProducts({
  slot, isDark, colors, accent, borderC,
}: {
  slot: ProductSlot;
  isDark: boolean;
  colors: any;
  accent: string;
  borderC: string;
}) {
  // verifyTick: chip doğrulanınca artar → useMemo sort'u tetikler.
  const [verifyTick, setVerifyTick] = useState(0);
  const onChipVerified = useCallback(() => setVerifyTick(t => t + 1), []);

  const sortedProducts = useMemo(() => {
    return [...slot.products].sort((a, b) => {
      const sa = verifiedRoutineCache.get(routineVerifyKey(a))?.status === "verified" ? 0 : 1;
      const sb = verifiedRoutineCache.get(routineVerifyKey(b))?.status === "verified" ? 0 : 1;
      return sa - sb;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.products, verifyTick]);

  return (
    <>
      {sortedProducts.map((prod, pIdx) => (
        <RoutineProductChip
          key={prod.id}
          prod={prod}
          pIdx={pIdx}
          isDark={isDark}
          colors={colors}
          accent={accent}
          borderC={borderC}
          onVerified={onChipVerified}
        />
      ))}
    </>
  );
}

function RoutinePreviewScreen({
  konuLabel, profile, routine, productSlots, productsFetching,
  colors, isDark, ctaBarBottom, onChat, onBack,
}: {
  konuLabel: string;
  profile: TreeProfile & { systemContext: string };
  routine: RoutineStep[];
  productSlots: ProductSlot[];
  productsFetching: boolean;
  colors: any;
  isDark: boolean;
  ctaBarBottom: number;
  onChat: () => void;
  onBack: () => void;
}) {
  const accent = "#7A8F6B";
  const copperAccent = "#C8A97E";
  const cardBg = isDark ? colors.surfaceCard : "#fff";
  const borderC = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const roleCfg = isDark ? ROLE_CONFIG_DARK : ROLE_CONFIG;
  const essCount = routine.filter(s => s.role === "Esas").length;

  // ECZ4 — VERIFIED PREFETCH: sadece DB'de doğrulanan ürünlerin hero görseli
  // prefetch edilir. Doğrulanmamış (synthetic-id) ürünler için id-bazlı
  // eagerPrefetchOnce çağırmıyoruz — boş id ile çağrı yararsız network trafiği.
  // Doğrulanan her ürünün prefetch'i RoutineProductChip içinde tetiklenir.
  // Bu effect ek bir savunma hattı: cache'te zaten "verified" olanları ısıt.
  useEffect(() => {
    for (const slot of productSlots) {
      for (const prod of slot.products) {
        const cached = verifiedRoutineCache.get(routineVerifyKey(prod));
        if (cached?.status === "verified") {
          try { prefetchDermoProduct(cached.product); } catch {}
        }
      }
    }
  }, [productSlots]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: ctaBarBottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profil özet çipsleri */}
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          <View style={[rpStyles.chip, { backgroundColor: isDark ? "#2E3D25" : "#EAF1EA", borderColor: accent }]}>
            <Text style={[rpStyles.chipText, { color: isDark ? "#9DB88D" : "#3D5030" }]}>
              {PROFILE_SEVERITY_LABEL[profile.severity]} şiddet
            </Text>
          </View>
          <View style={[rpStyles.chip, { backgroundColor: isDark ? "#292929" : "#F5F5F5", borderColor: borderC }]}>
            <Text style={[rpStyles.chipText, { color: colors.textSecondary }]}>
              Tolerans: {profile.tolerance}
            </Text>
          </View>
          <View style={[rpStyles.chip, { backgroundColor: isDark ? "#3A2E20" : "#FDF6EE", borderColor: copperAccent }]}>
            <Text style={[rpStyles.chipText, { color: isDark ? "#C8A97E" : "#7A5B35" }]}>
              {PROFILE_PRIORITY_LABEL[profile.priority]}
            </Text>
          </View>
        </View>

        {/* Açıklama */}
        <View style={[rpStyles.introCard, { backgroundColor: isDark ? "#1E2A18" : "#EAF1EA", borderColor: isDark ? `${accent}30` : `${accent}40` }]}>
          <Feather name="info" size={14} color={isDark ? "#9DB88D" : accent} style={{ marginTop: 1 }} />
          <Text style={[rpStyles.introText, { color: isDark ? "#9DB88D" : "#3D5030" }]}>
            Cevaplarına göre {konuLabel.toLowerCase()} için şahsileştirilmiş rutin hazırlandı. <Text style={{ fontWeight: "700" }}>{essCount} esas adım</Text> ile başla; destek ve opsiyonelleri ilerledikçe ekle.
          </Text>
        </View>

        {/* Ürün yükleme göstergesi */}
        {productsFetching && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, marginBottom: 2 }}>
            <ActivityIndicator size="small" color={accent} />
            <Text style={{ fontSize: 11.5, color: colors.textMuted }}>Ürün önerileri hazırlanıyor…</Text>
          </View>
        )}

        {/* Rutin adımları */}
        <View style={{ gap: 10, marginTop: productsFetching ? 8 : 14 }}>
          {routine.map((step, idx) => {
            const cfg = roleCfg[step.role];
            const slotId = guessSlotId(step.category);
            const slot = productSlots.find(s => s.slotId === slotId);
            return (
              <View
                key={idx}
                style={[rpStyles.stepCard, { backgroundColor: cardBg, borderColor: borderC }]}
              >
                {/* Numara */}
                <View style={[rpStyles.stepIconWrap, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }]}>
                  <Text style={[rpStyles.stepNum, { color: colors.textMuted }]}>{idx + 1}</Text>
                </View>

                {/* İçerik */}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Text style={[rpStyles.stepCategory, { color: colors.text }]}>{step.category}</Text>
                    <View style={[rpStyles.roleBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                      <Text style={[rpStyles.roleBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={[rpStyles.stepReason, { color: colors.textSecondary }]}>{step.reason}</Text>

                  {/* Ürün kartları */}
                  {slot && slot.products.length > 0 && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 1 }}>
                        <View style={{ height: 1, flex: 1, backgroundColor: borderC }} />
                        <Text style={{ fontSize: 9.5, color: colors.textMuted, fontWeight: "600", letterSpacing: 0.4 }}>ÖNERİLEN ÜRÜNLER</Text>
                        <View style={{ height: 1, flex: 1, backgroundColor: borderC }} />
                      </View>
                      <RoutineSlotProducts
                        slot={slot}
                        isDark={isDark}
                        colors={colors}
                        accent={accent}
                        borderC={borderC}
                      />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Rol açıklaması */}
        <View style={[rpStyles.legendRow, { marginTop: 20, borderTopColor: borderC }]}>
          {(["Esas", "Destek", "İsteğe bağlı"] as RoutineRole[]).map(role => {
            const cfg = roleCfg[role];
            return (
              <View key={role} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={[rpStyles.legendDot, { backgroundColor: cfg.border }]} />
                <Text style={{ fontSize: 10.5, color: colors.textMuted }}>{cfg.label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Alt CTA */}
      <View style={[rpStyles.ctaWrap, { paddingBottom: ctaBarBottom + 16, backgroundColor: isDark ? colors.background : "#E8ECE4", borderTopColor: borderC }]}>
        <Text style={[rpStyles.ctaHint, { color: colors.textMuted }]}>
          Ürün önerileri ve detaylı rehberlik için DermoAsistan'a sor
        </Text>
        <TouchableOpacity
          style={[rpStyles.ctaBtn, { backgroundColor: accent }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onChat(); }}
          activeOpacity={0.82}
        >
          <Feather name="message-circle" size={18} color="#fff" />
          <Text style={rpStyles.ctaBtnText}>DermoAsistan ile Konuş</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rpStyles = StyleSheet.create({
  chip:              { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  chipText:          { fontSize: 11, fontWeight: "700" },
  introCard:         { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 14, borderWidth: 1, padding: 12 },
  introText:         { flex: 1, fontSize: 12.5, lineHeight: 17 },
  stepCard:          { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  stepIconWrap:      { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNum:           { fontSize: 13, fontWeight: "700" },
  stepCategory:      { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  stepReason:        { fontSize: 12, lineHeight: 16.5 },
  roleBadge:         { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  roleBadgeText:     { fontSize: 10, fontWeight: "700" },
  legendRow:         { flexDirection: "row", gap: 14, borderTopWidth: 1, paddingTop: 14 },
  legendDot:         { width: 8, height: 8, borderRadius: 4 },
  ctaWrap:           { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  ctaHint:           { fontSize: 11.5, textAlign: "center" },
  ctaBtn:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, paddingVertical: 14 },
  ctaBtnText:        { fontSize: 15, fontWeight: "700", color: "#fff" },
  // Ürün kartı
  productChip:       { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 12, borderWidth: 1, padding: 9 },
  productImg:        { width: 46, height: 46, borderRadius: 8, flexShrink: 0 },
  productImgPlaceholder: { width: 46, height: 46, borderRadius: 8, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  productBrand:      { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.3 },
  productName:       { fontSize: 12, fontWeight: "500", lineHeight: 15.5 },
  productBadge:      { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
});

// ── Home (result-first) styles ────────────────────────────────────────────────
const hStyles = StyleSheet.create({
  homeScroll:        { paddingHorizontal: 15, paddingTop: 14, gap: 12 },
  homeSubtitle:      { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, marginBottom: 4 },

  // Insight hero card
  insightCard:       { borderRadius: 20, padding: 16, overflow: "hidden" },
  insightDeco:       { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)", top: -30, right: -20 },
  insightRow:        { flexDirection: "row", alignItems: "center", gap: 12 },
  insightIconBox:    { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  insightMain:       { fontSize: 17, fontWeight: "800", color: "#fff", lineHeight: 22 },
  insightSub:        { fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 3, lineHeight: 17 },

  // Mini routine card
  miniCard:          { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  miniCardHeader:    { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 10 },
  miniCardHeaderDot: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  miniCardTitle:     { flex: 1, fontSize: 14, fontWeight: "800" },
  miniCardSub:       { fontSize: 11, fontWeight: "500" },

  miniStep:          { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1 },
  miniStepNum:       { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  miniStepNumText:   { fontSize: 11, fontWeight: "800" },
  miniStepIcon:      { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  miniStepLabel:     { fontSize: 14, fontWeight: "600" },
  miniStepReason:    { fontSize: 11.5 },
  roleBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  roleBadgeText:     { fontSize: 10.5, fontWeight: "700" },

  // Personalize CTA
  personalizeBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, borderWidth: 1, paddingVertical: 13 },
  personalizeBtnText:{ fontSize: 14, fontWeight: "700" },

  // Ask bar (compact free input)
  askBar:            { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  askInput:          { flex: 1, fontSize: 14, paddingVertical: 0 },
  askSend:           { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});

const treeStyles = StyleSheet.create({
  optionBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15,
  },
  optionIndex: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: "500", lineHeight: 20 },
});

// ── Stiller ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:     { paddingHorizontal: 16, paddingBottom: 18, overflow: "hidden" },
  headerDeco1:{ position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.06)", top: -40, right: -30 },
  headerDeco2:{ position: "absolute", width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.04)", bottom: -20, left: 30 },
  headerRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:    { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  headerTitle:{ fontSize: 19, fontWeight: "800", color: "#fff" },
  headerSub:  { fontSize: 11.5, color: "rgba(255,255,255,0.72)", marginTop: 1 },
  aiBadgeBox: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  // Home content
  homeContent: { paddingHorizontal: 15, paddingTop: 14, gap: 14 },

  // Serbest giriş
  freeInputCard:{ borderRadius: 20, borderWidth: 1, padding: 14, gap: 6 },
  sectionLabel: { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.7 },
  freeInputHint:{ fontSize: 12.5, lineHeight: 17 },
  freeInputBox: { flexDirection: "row", alignItems: "flex-end", borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, gap: 9, marginTop: 4 },
  freeInput:    { flex: 1, fontSize: 14, maxHeight: 90, paddingVertical: 0 },
  freeInputSend:{ width: 33, height: 33, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  exampleChip:  { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },

  // Konu grid
  sectionBlock: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  sectionSub:   { fontSize: 11.5, marginTop: -6 },
  konuGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  konuCard:     { borderRadius: 16, borderWidth: 1, padding: 11, alignItems: "center", gap: 6, width: "30.5%" },
  konuIconBox:  { width: 30, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  konuLabel:    { fontSize: 11, fontWeight: "600", textAlign: "center" },

  // Feature cards
  featureCard:  { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14 },
  featureIcon:  { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 14, fontWeight: "700" },
  featureSub:   { fontSize: 12, marginTop: 2 },

  // Başlatıcılar
  startCard:    { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11 },
  startText:    { flex: 1, fontSize: 13, lineHeight: 18 },

  // Premium
  premiumCard:  { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14 },
  premiumTitle: { fontSize: 13.5, fontWeight: "700" },
  premiumSub:   { fontSize: 11.5, lineHeight: 16, marginTop: 2 },

  // Rutin
  rutinAdimLabel:{ fontSize: 14, fontWeight: "700" },
  rutinBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 16, paddingVertical: 12 },

  // Chat
  chatContent:  { paddingHorizontal: 15, gap: 10, paddingTop: 8 },
  topicBand:        { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 14, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  emptyChat:        { alignItems: "center", gap: 12, paddingTop: 48 },
  emptyText:        { fontSize: 13 },
  warmSkeletonIcon: { width: 52, height: 52, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  warmSkeletonLine: { height: 10, borderRadius: 6 },
  quickBtnWrap:     { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 4, paddingTop: 6, paddingBottom: 8 },
  quickBtn:         { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1 },
  quickBtnText:     { fontSize: 13.5, fontWeight: "500" },
  bubble:       { maxWidth: "86%", borderRadius: 18, padding: 13, gap: 4 },
  userBubble:   { alignSelf: "flex-end", borderBottomRightRadius: 5 },
  aiBubble:     { alignSelf: "flex-start", maxWidth: "92%", borderRadius: 16, borderBottomLeftRadius: 5,
                  borderWidth: 1, padding: 14 },
  aiMini:       { width: 20, height: 20, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  bubbleText:   { fontSize: 14.5, lineHeight: 23, fontWeight: "500" },
  errBubble:    { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, borderWidth: 1, padding: 11 },
  errText:      { fontSize: 13, flex: 1 },

  // Input
  inputBar:     { paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1 },
  inputBox:     { flexDirection: "row", alignItems: "flex-end", borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9, gap: 9 },
  inputField:   { flex: 1, fontSize: 14.5, maxHeight: 100, paddingVertical: 0 },
  sendBtn:      { width: 34, height: 34, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  newTopicBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingTop: 8, paddingBottom: 4 },

  // Rapor butonu (chat içinde)
  raporBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 16, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },

  // Result ekranı
  resultHeader:      { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 18, borderWidth: 1, padding: 14 },
  resultHeaderIcon:  { width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  resultHeaderTitle: { fontSize: 15, fontWeight: "800" },
  resultNavBtn:      { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  resultBlock:       { flexDirection: "row", alignItems: "flex-start", gap: 11, borderRadius: 18, borderWidth: 1, padding: 13 },
  resultBlockIcon:   { width: 30, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 1 },
  resultBlockLabel:  { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6 },
  resultBlockText:   { fontSize: 13.5, lineHeight: 20 },
  resultActionBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 16, borderWidth: 1, paddingVertical: 11 },
});

// ── ECZ4 Issue C: Geçmiş şeridi + modal stilleri ─────────────────────────────
const histStyles = StyleSheet.create({
  stripBtn:      { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11, marginTop: 6, marginBottom: 4 },
  stripIcon:     { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stripTitle:    { fontSize: 13, fontWeight: "700" },
  stripSub:      { fontSize: 11, marginTop: 1 },
  modalRoot:     { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  modalSheet:    { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingTop: 8, paddingHorizontal: 14 },
  modalHandle:   { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(122,143,107,0.35)", marginBottom: 8 },
  modalHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 },
  modalTitle:    { fontSize: 15, fontWeight: "700" },
  itemRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  itemTitle:     { fontSize: 13.5, fontWeight: "600" },
  itemMeta:      { fontSize: 11, marginTop: 2 },
  clearBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, borderWidth: 1, paddingVertical: 10, marginTop: 12 },
});