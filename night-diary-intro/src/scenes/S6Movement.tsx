import { useSceneFrame } from "../lib/sceneFrame";
import React, { useMemo } from "react";
import { AbsoluteFill} from "remotion";
import { HalftoneFlow } from "../components/HalftoneFlow";
import { MAP, MapView, cameraTransform, project } from "../components/MapView";
import { Heading } from "../components/Title";
import { EASE, ramp } from "../lib/anim";
import { COLORS, FONTS, HEIGHT, WIDTH } from "../theme";
import { CAM_SUBCONTINENT, CAM_WEST, mixCamera } from "./cameras";

const ZOOM = { from: 0, frames: 100 };
const TIMING = {
  tearOpen: 105,
  tearFrames: 50,
  photosUntil: 350,
  dissolve: 330,
  dissolveFrames: 100,
  particlesIn: 330,
};
const COUNT = { from: 150, frames: 250 };
const CITIES_IN = 70;

type Side = "left" | "right" | "below" | "above";
const CITY_LABELS: Record<string, Side> = {
  Lahore: "left",
  Amritsar: "right",
  Delhi: "right",
  Jodhpur: "right",
  "Mirpur Khas": "above",
  Karachi: "left",
};

const CityLabel: React.FC<{ at: [number, number]; name: string; side: Side; opacity: number }> = ({ at, name, side, opacity }) => {
  const offset: Record<Side, React.CSSProperties> = {
    left: { right: WIDTH - at[0] + 18, top: at[1] - 30 },
    right: { left: at[0] + 18, top: at[1] - 30 },
    below: { left: at[0], top: at[1] + 14, transform: "translateX(-50%)" },
    above: { left: at[0], top: at[1] - 76, transform: "translateX(-50%)" },
  };
  return (
    <div
      style={{
        position: "absolute",
        ...offset[side],
        fontFamily: FONTS.heading,
        fontWeight: 800,
        fontSize: 48,
        color: COLORS.cream,
        opacity,
        whiteSpace: "nowrap",
        textShadow: "0 0 10px rgba(6,21,38,1), 0 2px 18px rgba(6,21,38,0.9)",
      }}
    >
      {name}
    </div>
  );
};

/** 1:12–1:30 Movement. The map tears open on the border; people stream across it. */
export const S6Movement: React.FC = () => {
  const frame = useSceneFrame();
  const cam = mixCamera(CAM_SUBCONTINENT, CAM_WEST, ramp(frame, ZOOM.from, ZOOM.frames, EASE));
  const spine = useMemo(() => MAP.tearSpine.map((p) => project(p, CAM_WEST)), []);
  const cities = ramp(frame, CITIES_IN, 30);
  const count = ramp(frame, COUNT.from, COUNT.frames, EASE);
  const millions = 14 * count;
  const counterIn = ramp(frame, COUNT.from - 10, 20);
  return (
    <AbsoluteFill>
      <MapView camera={cam} split={1} neighbours={0.8} />
      {frame >= ZOOM.frames ? <HalftoneFlow frame={frame} spinePoints={spine} timing={TIMING} /> : null}
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <g transform={cameraTransform(cam)}>
          <path d={MAP.borderWest.d} fill="none" stroke={COLORS.border} strokeWidth={5 / cam.k} strokeLinejoin="round" strokeLinecap="round" />
          <path d={MAP.borderEast.d} fill="none" stroke={COLORS.border} strokeWidth={5 / cam.k} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {Object.keys(CITY_LABELS).map((name) => {
          const [x, y] = project(MAP.cities[name as keyof typeof MAP.cities], cam);
          return (
            <g key={name} opacity={cities}>
              <circle cx={x} cy={y} r={11} fill={COLORS.navyDeep} opacity={0.7} />
              <circle cx={x} cy={y} r={7} fill={COLORS.gold} />
            </g>
          );
        })}
      </svg>
      {Object.entries(CITY_LABELS).map(([name, side]) => (
        <CityLabel key={name} name={name} side={side} at={project(MAP.cities[name as keyof typeof MAP.cities], cam)} opacity={cities} />
      ))}
      <div style={{ position: "absolute", left: 130, top: 400, opacity: counterIn }}>
        <div
          style={{
            fontFamily: FONTS.heading,
            fontWeight: 800,
            fontSize: 120,
            lineHeight: 1,
            color: COLORS.gold,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count >= 1 ? "14" : millions.toFixed(1)}
        </div>
        <Heading lines={["Million people", "displaced"]} size={52} style={{ position: "relative" }} />
      </div>
    </AbsoluteFill>
  );
};
