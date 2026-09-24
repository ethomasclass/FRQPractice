import React from "react";
import { COLORS, FONTS } from "../theme";

type Props = {
  text: string;
  /** 0 → nothing written, 1 → fully written. */
  progress: number;
  fontSize?: number;
  color?: string;
  style?: React.CSSProperties;
  weight?: number;
};

/**
 * Ink that writes itself on: a soft-edged mask sweeps left to right across the line,
 * with a slightly darker, wetter edge at the nib.
 */
export const Handwriting: React.FC<Props> = ({ text, progress, fontSize = 72, color = COLORS.ink, style, weight = 600 }) => {
  const p = Math.max(0, Math.min(1, progress));
  const edge = 4; // % width of the feathered edge
  const at = p * (100 + edge);
  const mask = `linear-gradient(90deg, #000 ${at - edge}%, rgba(0,0,0,0.35) ${at - edge / 2}%, transparent ${at}%)`;
  return (
    <div
      style={{
        fontFamily: FONTS.hand,
        fontWeight: weight,
        fontSize,
        lineHeight: 1.15,
        color,
        whiteSpace: "nowrap",
        display: "inline-block",
        WebkitMaskImage: mask,
        maskImage: mask,
        paddingRight: 12,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
