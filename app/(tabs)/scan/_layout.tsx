import { Stack } from "expo-router";
import React from "react";

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="product/dermo-detail" />
    </Stack>
  );
}