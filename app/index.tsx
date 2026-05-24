import React from "react";
import { SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

const routes = [
  ["Orijinal Ana Sayfa", "/(tabs)/(home)", "Orijinal Cildim ana ekranı"],
  ["Tüm Ürünler", "/(tabs)/(home)/tum-urunler", "Ürün liste ekranı"],
  ["Akıllı Rutin", "/(tabs)/(home)/akilli-rutin", "Rutin ekranı"],
  ["Mukayese", "/(tabs)/(home)/mukayese-listesi", "Karar rehberi"],
  ["Tara", "/(tabs)/scan", "Scan ekranı"],
  ["Profil", "/(tabs)/profil", "Profil ekranı"],
];

export default function Gateway() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Cildim güvenli açılış</Text>
          <Text style={styles.title}>Orijinal ekranları tek tek açıyoruz.</Text>
          <Text style={styles.text}>
            V76d doğrudan orijinal ana ekrana girdiği için çöktü. Bu sürüm önce güvenli açılır; sonra hangi ekranın çöktüğünü tek tek buluruz.
          </Text>
        </View>

        {routes.map(([title, path, desc]) => (
          <Pressable key={path} style={styles.card} onPress={() => router.push(path as any)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardDesc}>{desc}</Text>
              <Text style={styles.path}>{path}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F1E7" },
  wrap: { padding: 18, paddingBottom: 40 },
  hero: { backgroundColor: "#315342", borderRadius: 30, padding: 20, marginTop: 8, marginBottom: 8 },
  kicker: { color: "#D8C2A6", fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { color: "#FFF8EA", fontSize: 29, lineHeight: 34, fontWeight: "900", marginTop: 8 },
  text: { color: "rgba(255,248,234,0.84)", fontSize: 14, lineHeight: 21, marginTop: 10, fontWeight: "600" },
  card: { backgroundColor: "#FFFCF7", borderColor: "#E6DACB", borderWidth: 1, borderRadius: 24, padding: 16, marginTop: 12, flexDirection: "row", alignItems: "center" },
  cardTitle: { color: "#2E302C", fontSize: 17, fontWeight: "900" },
  cardDesc: { color: "#746F67", fontSize: 13, lineHeight: 19, marginTop: 5, fontWeight: "650" },
  path: { color: "#B9834A", fontSize: 11, marginTop: 7, fontWeight: "800" },
  arrow: { color: "#315342", fontSize: 32, fontWeight: "900" },
});
