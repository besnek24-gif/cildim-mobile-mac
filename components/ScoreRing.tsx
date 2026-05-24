import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { getScoreColors } from "@/lib/scoreColors";

interface Props {
  score: number;
  size?: number;
  label?: string;
}

const SAGE   = "#7A8F6B";
const COPPER = "#C8A97E";

export function ScoreRing({ score, size = 72, label }: Props) {
  const colors = useColors();
  const pct    = Math.max(0, Math.min(100, score));
  const sc     = getScoreColors(pct);

  const strokeWidth   = Math.max(4, size * 0.1);
  const radius        = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset    = circumference * (1 - pct / 100);
  const center        = size / 2;

  const useGradient = pct >= 75;
  const strokeColor = useGradient ? "url(#scoreGrad)" : sc.main;

  const fontSize    = size * 0.24;
  const subFontSize = size * 0.16;

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={SAGE}   stopOpacity="1" />
              <Stop offset="1" stopColor={COPPER} stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Track ring */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Progress arc — rotated to start at top */}
          {pct > 0 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${center}, ${center}`}
            />
          )}
        </Svg>

        {/* Score text — centered absolutely */}
        <View
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize,
              fontWeight: "700",
              color: useGradient ? SAGE : sc.main,
              lineHeight: fontSize * 1.2,
            }}
          >
            {pct}
          </Text>
          <Text
            style={{
              fontSize: subFontSize,
              color: colors.textMuted,
              fontWeight: "500",
            }}
          >
            /100
          </Text>
        </View>
      </View>

      {label ? (
        <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: "center" }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
