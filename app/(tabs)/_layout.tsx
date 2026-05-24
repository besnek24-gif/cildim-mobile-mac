import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#315342",
        tabBarInactiveTintColor: "#8A8175",
        tabBarStyle: {
          backgroundColor: "#FFFCF7",
          borderTopColor: "#E6DACB",
          height: 78,
          paddingBottom: 18,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },
      }}
    >
      <Tabs.Screen name="(home)" options={{ title: "Ana" }} />
      <Tabs.Screen name="scan" options={{ title: "Tara" }} />
      <Tabs.Screen name="profil" options={{ title: "Profil" }} />
    </Tabs>
  );
}