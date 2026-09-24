import React from "react";
import { COLORS, FONTS } from "../theme";

/** Archivo 800, uppercase: the heading style used across the unit materials. */
export const Heading: React.FC<{
  lines: string[];
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  /** Per-line reveal 0–1 (slides up and fades in). */
  reveal?: number[];
  align?: "left" | "center" | "right";
}> = ({ lines, size = 96, color = COLORS.cream, style, reveal, align = "left" }) => (
  <div style={{ position: "absolute", textAlign: align, ...style }}>
    {lines.map((line, i) => {
      const r = reveal ? reveal[i] ?? 1 : 1;
      return (
        <div
          key={i}
          style={{
            fontFamily: FONTS.heading,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.02,
            letterSpacing: size > 80 ? 1 : 2,
            textTransform: "uppercase",
            color,
            opacity: r,
            transform: `translateY(${(1 - r) * 30}px)`,
            whiteSpace: "nowrap",
            textShadow: "0 4px 24px rgba(6,21,38,0.55)",
          }}
        >
          {line}
        </div>
      );
    })}
  </div>
);
