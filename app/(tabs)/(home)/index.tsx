import React from "react";
import { SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

const products = [
  {
    brand: "La Roche-Posay",
    name: "Effaclar Duo+M",
    category: "Akneye Eğilim",
    score: 86,
    text: "Akne eğilimli ciltte pürüz ve leke sonrası görünüm için hedef bakım.",
  },
  {
    brand: "Bioderma",
    name: "Sensibio Defensive",
    category: "Hassas Cilt",
    score: 91,
    text: "Hassasiyet ve bariyer zayıflığında sade nem desteği.",
  },
  {
    brand: "CeraVe",
    name: "Nemlendirici Krem",
    category: "Bariyer",
    score: 88,
    text: "Kuru ve yıpranmış bariyer için seramid odaklı temel bakım.",
  },
];

const shortcuts = [
  ["Tüm Ürünler", "/(tabs)/(home)/tum-urunler", "Ürün katalog ekranını aç"],
  ["Akıllı Rutin", "/(tabs)/(home)/akilli-rutin", "Rutin akışını aç"],
  ["Mukayese", "/(tabs)/(home)/mukayese-listesi", "Karar rehberini aç"],
  ["Tara", "/(tabs)/scan", "Analiz / tarama ekranını aç"],
  ["Profil", "/(tabs)/profil", "Profil ekranını aç"],
];

export default function SafeOriginalHome() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Cildim</Text>
          <Text style={styles.title}>Cildine rastgele değil, bilerek yaklaş.</Text>
          <Text style={styles.heroText}>
            Bu V78 ana sayfa, crash veren eski home dosyası karantinaya alınarak güvenli şekilde kuruldu. Orijinal tasarım dili korunarak ekranlar tekrar bağlanıyor.
          </Text>
        </View>

        <View style={styles.searchFake}>
          <Text style={styles.searchText}>Ürün, marka veya endişe ara</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Sana özel öneriler</Text>
          <Text style={styles.sectionLink}>V78 güvenli home</Text>
        </View>

        {products.map((p) => (
          <View key={p.name} style={styles.productCard}>
            <View style={styles.productTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.brand}>{p.brand}</Text>
                <Text style={styles.productName}>{p.name}</Text>
              </View>
              <View style={styles.score}>
                <Text style={styles.scoreText}>{p.score}</Text>
              </View>
            </View>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{p.category}</Text>
              <Text style={styles.badgeCopper}>Eczacı önerisi</Text>
            </View>
            <Text style={styles.productText}>{p.text}</Text>
          </View>
        ))}

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Günün ipucu</Text>
          <Text style={styles.tipText}>
            Leke ve aktif bakım kullanan ciltte SPF ihmal edilirse rutin tek kanatla uçmaya çalışır.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ekranlara geç</Text>
          <Text style={styles.sectionLink}>Route testi</Text>
        </View>

        {shortcuts.map(([title, path, desc]) => (
          <Pressable key={path} style={styles.shortcut} onPress={() => router.push(path as any)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.shortcutTitle}>{title}</Text>
              <Text style={styles.shortcutDesc}>{desc}</Text>
              <Text style={styles.shortcutPath}>{path}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Teşhis</Text>
          <Text style={styles.noteText}>
            V77d gateway açıldı; Orijinal Ana Sayfa tıklanınca uygulama çöktü. Bu yüzden eski home dosyası karantinaya alındı. Şimdi diğer route'lar tek tek test edilecek.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F1E7" },
  wrap: { padding: 18, paddingBottom: 40 },
  hero: { backgroundColor: "#315342", borderRadius: 30, padding: 20, marginTop: 8 },
  kicker: { color: "#D8C2A6", fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { color: "#FFF8EA", fontSize: 30, lineHeight: 35, fontWeight: "900", marginTop: 8, letterSpacing: -0.8 },
  heroText: { color: "rgba(255,248,234,0.84)", fontSize: 14, lineHeight: 21, marginTop: 10, fontWeight: "600" },
  searchFake: { backgroundColor: "#FFFCF7", borderColor: "#E6DACB", borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, marginTop: 14 },
  searchText: { color: "#9A9489", fontSize: 14, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: "#2E302C", fontSize: 20, fontWeight: "900" },
  sectionLink: { color: "#B9834A", fontSize: 12, fontWeight: "900" },
  productCard: { backgroundColor: "#FFFCF7", borderColor: "#E6DACB", borderWidth: 1, borderRadius: 26, padding: 16, marginBottom: 12 },
  productTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  brand: { color: "#315342", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  productName: { color: "#2E302C", fontSize: 18, fontWeight: "900", marginTop: 3 },
  score: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: "#315342", alignItems: "center", justifyContent: "center" },
  scoreText: { color: "#315342", fontSize: 14, fontWeight: "900" },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 },
  badge: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(49,83,66,0.10)", color: "#315342", paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "900" },
  badgeCopper: { overflow: "hidden", borderRadius: 999, backgroundColor: "rgba(185,131,74,0.14)", color: "#B9834A", paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "900" },
  productText: { color: "#746F67", fontSize: 13, lineHeight: 19, marginTop: 10, fontWeight: "650" },
  tipCard: { backgroundColor: "#EFE0CD", borderColor: "#D9BE9E", borderWidth: 1, borderRadius: 24, padding: 16, marginTop: 4 },
  tipTitle: { color: "#B9834A", fontSize: 17, fontWeight: "900" },
  tipText: { color: "#2E302C", fontSize: 13, lineHeight: 20, marginTop: 7, fontWeight: "650" },
  shortcut: { backgroundColor: "#FFFCF7", borderColor: "#E6DACB", borderWidth: 1, borderRadius: 24, padding: 16, marginTop: 10, flexDirection: "row", alignItems: "center" },
  shortcutTitle: { color: "#2E302C", fontSize: 17, fontWeight: "900" },
  shortcutDesc: { color: "#746F67", fontSize: 13, lineHeight: 19, marginTop: 5, fontWeight: "650" },
  shortcutPath: { color: "#B9834A", fontSize: 11, marginTop: 7, fontWeight: "800" },
  arrow: { color: "#315342", fontSize: 32, fontWeight: "900" },
  noteCard: { backgroundColor: "#315342", borderRadius: 24, padding: 16, marginTop: 16 },
  noteTitle: { color: "#FFF8EA", fontSize: 17, fontWeight: "900" },
  noteText: { color: "rgba(255,248,234,0.84)", fontSize: 13, lineHeight: 20, marginTop: 7, fontWeight: "650" },
});
