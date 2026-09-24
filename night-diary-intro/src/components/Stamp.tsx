import React, { useMemo } from "react";
import { Img, staticFile } from "remotion";
import { COLORS, FONTS } from "../theme";

export const STAMP_W = 340;
export const STAMP_H = 420;

/** Outline of a stamp with perforated (scalloped) edges, traced clockwise. */
const perforatedPath = (w: number, h: number, r = 9, gap = 26) => {
  const holes = (len: number) => {
    const n = Math.floor(len / gap);
    const start = (len - (n - 1) * gap) / 2;
    return new Array(n).fill(0).map((_, i) => start + i * gap);
  };
  const arc = (x: number, y: number) => `A${r},${r} 0 0 0 ${x.toFixed(1)},${y.toFixed(1)}`;
  let d = `M0,0`;
  for (const c of holes(w)) d += ` L${(c - r).toFixed(1)},0 ${arc(c + r, 0)}`;
  d += ` L${w},0`;
  for (const c of holes(h)) d += ` L${w},${(c - r).toFixed(1)} ${arc(w, c + r)}`;
  d += ` L${w},${h}`;
  for (const c of holes(w).reverse()) d += ` L${(c + r).toFixed(1)},${h} ${arc(c - r, h)}`;
  d += ` L0,${h}`;
  for (const c of holes(h).reverse()) d += ` L0,${(c + r).toFixed(1)} ${arc(0, c - r)}`;
  return d + " Z";
};

type StampProps = {
  image: string;
  /** Portrait push-in, 1 → 1.05 (a slow Ken Burns inside the frame). */
  zoom?: number;
  denomination?: string;
};

/** A postage stamp: gold field, perforated edge, duotone portrait cutout, denomination. */
export const Stamp: React.FC<StampProps> = ({ image, zoom = 1, denomination = "1947 · ½ ANNA" }) => {
  const clip = useMemo(() => `path('${perforatedPath(STAMP_W, STAMP_H)}')`, []);
  const inset = 22;
  return (
    <div style={{ width: STAMP_W, height: STAMP_H, filter: "drop-shadow(0 14px 18px rgba(6,21,38,0.45))" }}>
      <div style={{ position: "absolute", inset: 0, clipPath: clip, background: COLORS.gold }}>
        <div
          style={{
            position: "absolute",
            left: inset,
            top: inset,
            right: inset,
            bottom: inset,
            overflow: "hidden",
            border: `3px solid ${COLORS.navy}`,
            background: `radial-gradient(circle at 50% 30%, rgba(246,239,226,0.35), rgba(246,239,226,0) 70%)`,
          }}
        >
          <Img
            src={staticFile(image)}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 0,
              height: "86%",
              transform: `translateX(-50%) scale(${zoom})`,
              transformOrigin: "50% 100%",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 14,
              top: 10,
              fontFamily: FONTS.heading,
              fontWeight: 800,
              fontSize: 26,
              letterSpacing: 1,
              color: COLORS.navy,
            }}
          >
            {denomination}
          </div>
        </div>
      </div>
    </div>
  );
};

type PostmarkProps = {
  /** Text around the ring, e.g. "GANDHI · CONGRESS". */
  text: string;
  id: string;
  size?: number;
};

/** A circular ink postmark with cancellation lines. */
export const Postmark: React.FC<PostmarkProps> = ({ text, id, size = 250 }) => {
  const R = 100;
  const ring = `M ${-R + 20},0 A ${R - 20},${R - 20} 0 1,1 ${R - 20},0 A ${R - 20},${R - 20} 0 1,1 ${-R + 20},0`;
  return (
    <svg width={size * 1.9} height={size} viewBox="-120 -120 456 240" style={{ overflow: "visible" }}>
      <defs>
        <filter id={`ink-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={3} />
        </filter>
        <path id={`ring-${id}`} d={ring} />
      </defs>
      <g filter={`url(#ink-${id})`} fill="none" stroke={COLORS.navy} strokeOpacity={0.82}>
        <circle r={R} strokeWidth={5} />
        <circle r={R - 42} strokeWidth={3} />
        <text fill={COLORS.navy} fillOpacity={0.85} stroke="none" fontFamily={FONTS.heading} fontWeight={800} fontSize={24} letterSpacing={2}>
          <textPath href={`#ring-${id}`} startOffset="50%" textAnchor="middle">
            {text}
          </textPath>
        </text>
        <text y={11} textAnchor="middle" fill={COLORS.navy} fillOpacity={0.85} stroke="none" fontFamily={FONTS.heading} fontWeight={800} fontSize={30}>
          1947
        </text>
        {[-34, -12, 10, 32].map((y) => (
          <path key={y} d={`M${R + 12},${y} q20,-10 40,0 t40,0 t40,0`} strokeWidth={5} />
        ))}
      </g>
    </svg>
  );
};
