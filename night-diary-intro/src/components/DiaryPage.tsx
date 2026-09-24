import React from "react";
import { Img, staticFile } from "remotion";
import { COLORS } from "../theme";

type Props = {
  width: number;
  height: number;
  /** Warmth of the lamp light falling on the page, 0–1.2. */
  glow?: number;
  /** Where the lamp is, relative to the page (0–1 in each axis, may be outside). */
  glowFrom?: [number, number];
  lineGap?: number;
  /** Strength of the shaded edges (1 = default). */
  shade?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

/** A sheet of lined diary paper with a paper texture and lamp light across it. */
export const DiaryPage: React.FC<Props> = ({
  width,
  height,
  glow = 1,
  glowFrom = [-0.1, 1.1],
  lineGap = 84,
  shade = 1,
  style,
  children,
}) => {
  const lines = [];
  for (let y = 150; y < height - 30; y += lineGap) lines.push(y);
  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        background: COLORS.cream,
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.35)",
        ...style,
      }}
    >
      <Img
        src={staticFile("images/textures/paper.png")}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", mixBlendMode: "multiply" }}
      />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {lines.map((y) => (
          <line key={y} x1={0} x2={width} y1={y} y2={y} stroke={COLORS.sky} strokeOpacity={0.45} strokeWidth={2} />
        ))}
        <line x1={130} x2={130} y1={0} y2={height} stroke={COLORS.gold} strokeOpacity={0.8} strokeWidth={3} />
      </svg>
      {/* Lamp light: warm near the lamp, falling off into shade. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at ${glowFrom[0] * 100}% ${glowFrom[1] * 100}%, rgba(230,194,117,${0.28 * glow}) 0%, rgba(230,194,117,0) 55%), radial-gradient(ellipse at 50% 50%, rgba(10,32,56,0) 45%, rgba(10,32,56,${(0.28 - 0.1 * Math.min(1, glow)) * shade}) 100%)`,
        }}
      />
      {children}
    </div>
  );
};
