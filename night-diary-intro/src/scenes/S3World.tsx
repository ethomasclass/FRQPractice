import { useSceneFrame } from "../lib/sceneFrame";
import React from "react";
import { AbsoluteFill, random} from "remotion";
import { MAP, MapView } from "../components/MapView";
import { Heading } from "../components/Title";
import { EASE, ramp } from "../lib/anim";
import { COLORS } from "../theme";
import { CAM_SUBCONTINENT, CAM_WIDE, mixCamera } from "./cameras";

/** 0:22–0:35 The world outside. Title card, then a slow zoom onto the subcontinent. */
export const S3World: React.FC = () => {
  const frame = useSceneFrame();
  const zoom = ramp(frame, 20, 330, EASE);
  const cam = mixCamera(CAM_WIDE, CAM_SUBCONTINENT, zoom);
  const mapIn = ramp(frame, 10, 45);
  // Towns: many small lights across one land, lighting up as the narrator describes it.
  const townsIn = ramp(frame, 150, 90);
  return (
    <AbsoluteFill>
      <div style={{ opacity: mapIn }}>
        <MapView camera={cam}>
          {MAP.towns.map(([x, y], i) => {
            const delay = random(`town-${i}`);
            const o = Math.min(1, Math.max(0, townsIn * 1.6 - delay * 0.6)) * (0.55 + 0.45 * Math.sin(frame * 0.08 + i));
            return <circle key={i} cx={x} cy={y} r={2.6 / Math.sqrt(cam.k)} fill={i % 3 === 0 ? COLORS.gold : COLORS.cream} opacity={o} />;
          })}
        </MapView>
      </div>
      <Heading
        lines={["British India,", "1947."]}
        size={80}
        style={{ left: 130, top: 420 }}
        reveal={[ramp(frame, 18, 26), ramp(frame, 30, 26)]}
      />
    </AbsoluteFill>
  );
};
