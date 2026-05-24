import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>Cildim Native Boot Açıldı</Text>
        <Text style={styles.subtitle}>ECZ4 Build 22 No Router Test</Text>
        <Text style={styles.note}>
          Bu ekran görünüyorsa sorun expo-router / route tree / ana uygulama import zincirindedir.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#E8ECE4",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2F3A31",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7A6A",
    marginBottom: 12,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: "#7A7A7A",
  },
});
