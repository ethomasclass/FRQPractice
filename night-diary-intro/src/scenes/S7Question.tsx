import { useSceneFrame } from "../lib/sceneFrame";
import React from "react";
import { AbsoluteFill} from "remotion";
import { DiaryDesk, onLine, wallBackground } from "../components/DiaryDesk";
import { Handwriting } from "../components/Handwriting";
import { MAP, cameraTransform, project } from "../components/MapView";
import { lampFlicker } from "../components/OilLamp";
import { GirlShadow } from "../components/Silhouette";
import { EASE_OUT, ramp } from "../lib/anim";
import { localCue, s, VOICE } from "../timeline";
import { COLORS, FONTS } from "../theme";

const FONT = 76;
// Inset mini-map (top right).
const BOX = { left: 1380, top: 120, width: 420, height: 340 };
const MINI = { cx: 760, cy: 400, k: 0.95, sx: BOX.left + BOX.width / 2, sy: BOX.top + BOX.height / 2 };

/** 1:30–1:45 Nisha's question. Her shadow writes on the wall; Mirpur Khas is now in Pakistan. */
export const S7Question: React.FC = () => {
  const frame = useSceneFrame();
  const abs = frame + s(90);
  const f = lampFlicker(abs);
  const a = localCue("question", "s7-a");
  const b = localCue("question", "s7-b");
  const aOut = 1 - ramp(frame, b - 12, 12);
  const writeA = VOICE["s7-a"].seconds * 30 * 0.85;
  const writeB = VOICE["s7-b"].seconds * 30 * 0.85;
  const mapIn = ramp(frame, 40, 30);
  const mk = project(MAP.cities["Mirpur Khas"], MINI);
  const pulse = EASE_OUT((frame % 45) / 45);
  const shadowIn = ramp(frame, 0, 40);
  return (
    <AbsoluteFill>
      {/* The wall, warmed by the lamp. */}
      <AbsoluteFill
        style={{
          background: wallBackground(f),
        }}
      />
      {/* Her shadow, cast large on the wall, swaying with the flame. */}
      <div
        style={{
          position: "absolute",
          left: 540,
          top: -80,
          opacity: shadowIn,
          transformOrigin: "20% 100%",
          transform: `scale(${(1 + (f - 0.97) * 0.35).toFixed(4)}) skewX(${((f - 0.97) * 8).toFixed(3)}deg)`,
        }}
      >
        <GirlShadow width={700} opacity={0.9 + (f - 0.97)} penAngle={Math.sin(frame * 0.35) * 5} />
      </div>
      <DiaryDesk frame={abs} lampLit={1} pageIn={1} pageStyle={{ top: 470, height: 430 }}>
        <div style={{ opacity: aOut }}>
          <Handwriting text="Papa says we are Hindu," fontSize={FONT} progress={ramp(frame, a, writeA * 0.55)} style={onLine(0, FONT, 20)} />
          <Handwriting text="so we have to leave." fontSize={FONT} progress={ramp(frame, a + writeA * 0.55, writeA * 0.45)} style={onLine(1, FONT, 20)} />
        </div>
        <Handwriting text="But Mama, you were Muslim." fontSize={FONT} progress={ramp(frame, b, writeB * 0.6)} style={onLine(0, FONT, 20)} />
        <Handwriting text="So what am I?" fontSize={FONT + 8} progress={ramp(frame, b + writeB * 0.6, writeB * 0.4)} style={onLine(1, FONT + 8, 20)} weight={700} />
      </DiaryDesk>
      {/* Mini-map: Mirpur Khas, now inside Pakistan. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: mapIn }}>
        <defs>
          <clipPath id="mini-clip">
            <rect x={BOX.left} y={BOX.top} width={BOX.width} height={BOX.height} rx={10} />
          </clipPath>
        </defs>
        <rect x={BOX.left} y={BOX.top} width={BOX.width} height={BOX.height} rx={10} fill={COLORS.navyDeep} fillOpacity={0.85} stroke={COLORS.gold} strokeOpacity={0.6} strokeWidth={2} />
        <g clipPath="url(#mini-clip)">
        <g transform={cameraTransform(MINI)}>
          <path d={MAP.india} fill={COLORS.sky} fillOpacity={0.18} stroke={COLORS.sky} strokeOpacity={0.6} strokeWidth={1.5 / MINI.k} />
          <path d={MAP.pakistanWest} fill={COLORS.cream} fillOpacity={0.14} stroke={COLORS.sky} strokeOpacity={0.6} strokeWidth={1.5 / MINI.k} />
          <path d={MAP.borderWest.d} fill="none" stroke={COLORS.border} strokeWidth={3.5 / MINI.k} />
        </g>
        </g>
        <circle cx={mk[0]} cy={mk[1]} r={8 + pulse * 30} fill="none" stroke={COLORS.gold} strokeWidth={3} opacity={1 - pulse} />
        <circle cx={mk[0]} cy={mk[1]} r={8} fill={COLORS.gold} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: BOX.left + 20,
          top: BOX.top + BOX.height - 66,
          fontFamily: FONTS.heading,
          fontWeight: 800,
          fontSize: 48,
          color: COLORS.gold,
          opacity: mapIn,
          whiteSpace: "nowrap",
          textShadow: "0 0 10px rgba(6,21,38,1)",
        }}
      >
        Mirpur Khas
      </div>
    </AbsoluteFill>
  );
};
