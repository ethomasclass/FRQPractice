import { useSceneFrame } from "../lib/sceneFrame";
import React from "react";
import { AbsoluteFill} from "remotion";
import { DrawnPath, MAP, MapView, project } from "../components/MapView";
import { Heading } from "../components/Title";
import { EASE, fadeInOut, ramp } from "../lib/anim";
import { COLORS, FONTS } from "../theme";
import { CAM_SUBCONTINENT, mixCamera } from "./cameras";

const DRAW_WEST = { from: 12, frames: 100 };
const DRAW_EAST = { from: 70, frames: 90 };
const DATE = { from: 30, to: 215 };
const TWO = { from: 225 };
const SPLIT = { from: 230, frames: 60 };

const CountryLabel: React.FC<{ at: [number, number]; text: string; opacity: number; size?: number; color?: string }> = ({
  at,
  text,
  opacity,
  size = 52,
  color = COLORS.cream,
}) => (
  <div
    style={{
      position: "absolute",
      left: at[0],
      top: at[1],
      transform: "translate(-50%, -50%)",
      fontFamily: FONTS.heading,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: 4,
      color,
      opacity,
      whiteSpace: "nowrap",
      textShadow: "0 2px 14px rgba(6,21,38,0.9)",
    }}
  >
    {text}
  </div>
);

/** 0:55–1:12 The line. Hard cut, one drum hit, and the border draws itself in red. */
export const S5Line: React.FC = () => {
  const frame = useSceneFrame();
  // A slow push-in across the scene (≈5%).
  const cam = mixCamera(CAM_SUBCONTINENT, { ...CAM_SUBCONTINENT, k: CAM_SUBCONTINENT.k * 1.05 }, ramp(frame, 0, 510, EASE));
  const split = ramp(frame, SPLIT.from, SPLIT.frames);
  const labels = ramp(frame, SPLIT.from + 20, 30);
  const w = 5 / cam.k;
  const india = project(MAP.labels.india, cam);
  const pak = project(MAP.labels.pakistan, cam);
  const east = project(MAP.labels.eastPakistan, cam);
  return (
    <AbsoluteFill>
      <MapView camera={cam} neighbours={0.8} split={split}>
        <DrawnPath d={MAP.borderWest.d} length={MAP.borderWest.length} progress={ramp(frame, DRAW_WEST.from, DRAW_WEST.frames, EASE)} color={COLORS.border} width={w} glow />
        <DrawnPath d={MAP.borderEast.d} length={MAP.borderEast.length} progress={ramp(frame, DRAW_EAST.from, DRAW_EAST.frames, EASE)} color={COLORS.border} width={w} glow />
      </MapView>
      <CountryLabel at={[india[0] + 30, india[1] + 40]} text="INDIA" opacity={labels} size={60} />
      <CountryLabel at={[pak[0] - 20, pak[1] + 10]} text="PAKISTAN" opacity={labels} />
      {/* East Pakistan: labelled out in the Bay of Bengal with a short leader line. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: labels }}>
        <line x1={east[0] + 6} y1={east[1] + 34} x2={east[0] + 30} y2={east[1] + 100} stroke={COLORS.cream} strokeWidth={2.5} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: east[0] + 30,
          top: east[1] + 108,
          transform: "translateX(-40%)",
          fontFamily: FONTS.heading,
          fontWeight: 800,
          fontSize: 48,
          lineHeight: 1,
          letterSpacing: 4,
          color: COLORS.cream,
          opacity: labels,
          textAlign: "center",
          textShadow: "0 2px 14px rgba(6,21,38,0.9)",
        }}
      >
        EAST
        <br />
        PAKISTAN
      </div>
      <Heading
        lines={["August 14–15,", "1947"]}
        size={80}
        style={{ left: 130, top: 400, opacity: fadeInOut(frame, DATE.from, DATE.to, 20, 16) }}
        reveal={[ramp(frame, DATE.from, 24), ramp(frame, DATE.from + 10, 24)]}
      />
      <Heading
        lines={["One country", "becomes two."]}
        size={80}
        color={COLORS.gold}
        style={{ left: 130, top: 400 }}
        reveal={[ramp(frame, TWO.from, 24), ramp(frame, TWO.from + 14, 24)]}
      />
    </AbsoluteFill>
  );
};
