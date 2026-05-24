import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

const CREAM = "#F5F1EB";

interface Props {
  onDone: () => void;
}

export default function SplashAnimation({ onDone }: Props) {
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const blurOpacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([

      // Icon fades in: 0 → 700ms
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),

      // Blur dissolves to sharp: 0 → 1600ms
      Animated.timing(blurOpacity, {
        toValue: 0,
        duration: 1600,
        useNativeDriver: true,
      }),

      // "güzelleşmek için" fades in at 1400ms, stays visible
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        // hold for remaining 0.6s (1400 + 500 + 600 = 2500ms total)
        Animated.delay(600),
      ]),

    ]).start(() => onDone());
  }, []);

  return (
    <View style={styles.container}>

      {/* Icon — blur → sharp */}
      <Animated.View style={[styles.iconWrap, { opacity: iconOpacity }]}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.icon}
          resizeMode="contain"
        />
        {/* Blur overlay that dissolves */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: blurOpacity }]}>
          <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFillObject} />
        </Animated.View>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: textOpacity }]}>
        Bilerek güzelleş
      </Animated.Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 28,
    overflow: "hidden",
  },
  icon: {
    width: 120,
    height: 120,
  },
  tagline: {
    position: "absolute",
    bottom: 76,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "300",
    letterSpacing: 1.8,
    color: "#9A8B7A",
  },
});
