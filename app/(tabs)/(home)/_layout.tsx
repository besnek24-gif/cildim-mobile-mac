import React from "react";
import { Stack } from "expo-router";

export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F7F1E7" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="tum-urunler" />
      <Stack.Screen name="akilli-rutin" />
      <Stack.Screen name="mukayese-listesi" />
      <Stack.Screen name="product/[id]" />
    </Stack>
  );
}