/**
 * Skin Intelligence — Stack Navigator
 * Eski cilt-analizi.tsx akışından tamamen bağımsız,
 * kendi içinde kapalı bir modül.
 */

import { Stack } from "expo-router";

export default function SkinIntelligenceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="capture" />
      <Stack.Screen name="analysis" />
      <Stack.Screen name="result" />
      <Stack.Screen name="routine" />
      <Stack.Screen name="products" />
      <Stack.Screen name="history" />
    </Stack>
  );
}