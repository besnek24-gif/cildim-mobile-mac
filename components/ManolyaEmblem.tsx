import React from "react";
import Svg, {
  Ellipse,
  Circle,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  G,
} from "react-native-svg";

interface Props {
  size?: number;
}

export default function ManolyaEmblem({ size = 32 }: Props) {
  const petals = 8;
  const petalAngles = Array.from({ length: petals }, (_, i) => (360 / petals) * i);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="petalG" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#7FB8B6" />
          <Stop offset="100%" stopColor="#3A8480" />
        </LinearGradient>
        <RadialGradient id="centerG" cx="38%" cy="35%" r="65%">
          <Stop offset="0%" stopColor="#E8C97A" />
          <Stop offset="100%" stopColor="#B87333" />
        </RadialGradient>
        <RadialGradient id="innerG" cx="40%" cy="35%" r="65%">
          <Stop offset="0%" stopColor="#F5EDD6" />
          <Stop offset="100%" stopColor="#DBC48A" />
        </RadialGradient>
      </Defs>

      {/* 8 ince uzun papatya yaprağı */}
      {petalAngles.map((angle, i) => (
        <G
          key={i}
          rotation={angle}
          originX={50}
          originY={50}
        >
          <Ellipse
            cx={50}
            cy={22}
            rx={6}
            ry={18}
            fill="url(#petalG)"
            opacity={0.92}
          />
        </G>
      ))}

      {/* Merkez disk */}
      <Circle cx={50} cy={50} r={14} fill="url(#centerG)" />
      <Circle cx={50} cy={50} r={9}  fill="url(#innerG)" />
      <Circle cx={50} cy={50} r={4}  fill="#B87333" opacity={0.7} />
    </Svg>
  );
}
