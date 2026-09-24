import { noise2D } from "@remotion/noise";
import React from "react";
import { COLORS } from "../theme";

/** Shared flicker value (≈0.8–1.1) so the flame, page glow and shadow move together. */
export const lampFlicker = (frame: number) => {
  const slow = noise2D("lamp-slow", frame * 0.035, 0) * 0.08;
  const fast = noise2D("lamp-fast", frame * 0.23, 3) * 0.05;
  return 0.97 + slow + fast;
};

type Props = {
  x: number;
  y: number;
  scale?: number;
  /** 0 = unlit, 1 = fully lit. */
  lit: number;
  frame: number;
};

/**
 * A clay diya (oil lamp) in silhouette with a gold rim light, a living flame and a
 * wide warm glow. (x, y) is the bottom centre of the lamp.
 */
export const OilLamp: React.FC<Props> = ({ x, y, scale = 1, lit, frame }) => {
  const f = lampFlicker(frame);
  const sway = noise2D("flame-sway", frame * 0.06, 1) * 6;
  const stretch = 1 + noise2D("flame-h", frame * 0.12, 2) * 0.12;
  const flameOpacity = lit;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 150 * scale,
        top: y - 200 * scale,
        width: 300 * scale,
        height: 200 * scale,
      }}
    >
      {/* Large warm glow */}
      <div
        style={{
          position: "absolute",
          left: 150 * scale - 700,
          top: 60 * scale - 700,
          width: 1400,
          height: 1400,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(230,194,117,${0.34 * lit * f}) 0%, rgba(230,194,117,${0.12 * lit * f}) 28%, rgba(230,194,117,0) 62%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <svg width={300 * scale} height={200 * scale} viewBox="0 0 300 200" style={{ position: "absolute", overflow: "visible" }}>
        <defs>
          <radialGradient id="flame-grad" cx="50%" cy="70%" r="60%">
            <stop offset="0%" stopColor="#FFFDF6" />
            <stop offset="35%" stopColor={COLORS.cream} />
            <stop offset="70%" stopColor={COLORS.gold} />
            <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="lamp-rim" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.9} />
            <stop offset="30%" stopColor={COLORS.gold} stopOpacity={0.25} />
            <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
          </linearGradient>
          <filter id="flame-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        {/* flame: pivot at the wick (spout tip) */}
        <g transform={`translate(236 96)`} opacity={flameOpacity}>
          <ellipse cx={0} cy={-22} rx={26} ry={34} fill={COLORS.gold} opacity={0.25 * f} filter="url(#flame-blur)" />
          <path
            transform={`scale(${(0.9 + 0.1 * f).toFixed(3)} ${(stretch * f).toFixed(3)})`}
            d={`M0,4 C-13,-2 -12,-22 ${(-2 + sway * 0.4).toFixed(1)},-40 C${(4 + sway).toFixed(1)},-52 ${(sway * 1.2).toFixed(1)},-62 ${(sway * 1.5).toFixed(1)},-66 C${(10 + sway).toFixed(1)},-50 14,-24 12,-8 C10,2 5,6 0,4Z`}
            fill="url(#flame-grad)"
            filter="url(#flame-blur)"
          />
          <ellipse cx={1} cy={-10} rx={4} ry={8} fill="#FFFDF6" opacity={0.9} />
        </g>
        {/* diya body */}
        <path
          d="M40,110 C40,110 70,98 150,98 C200,98 225,100 250,92 L262,88 C258,100 248,110 236,116 C220,150 190,170 150,170 C95,170 55,148 40,110Z"
          fill={COLORS.navyDeep}
        />
        <path
          d="M40,110 C70,98 150,98 150,98 C200,98 225,100 250,92 L262,88 C258,100 248,110 236,116 C220,150 190,170 150,170 C95,170 55,148 40,110Z"
          fill="url(#lamp-rim)"
          opacity={0.25 + 0.55 * lit * f}
        />
        {/* oil surface */}
        <ellipse cx={140} cy={106} rx={88} ry={9} fill={COLORS.gold} opacity={0.2 + 0.35 * lit} />
        {/* foot */}
        <path d="M112,168 L188,168 L196,190 L104,190Z" fill={COLORS.navyDeep} />
        <path d="M104,190 L196,190" stroke={COLORS.gold} strokeOpacity={0.35 * lit} strokeWidth={3} />
      </svg>
    </div>
  );
};
