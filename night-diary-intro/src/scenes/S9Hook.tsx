import { useSceneFrame } from "../lib/sceneFrame";
import React from "react";
import { AbsoluteFill} from "remotion";
import { Heading } from "../components/Title";
import { ramp } from "../lib/anim";
import { COLORS } from "../theme";

/** 1:55–2:00 Hook. "Borders move people. Tonight, we start reading." Then fade to navy. */
export const S9Hook: React.FC = () => {
  const frame = useSceneFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Heading
        lines={["Borders move people."]}
        size={104}
        align="center"
        style={{ top: 380, left: 0, width: "100%" }}
        reveal={[ramp(frame, 4, 20)]}
      />
      <Heading
        lines={["Tonight, we start reading."]}
        size={68}
        color={COLORS.gold}
        align="center"
        style={{ top: 520, left: 0, width: "100%" }}
        reveal={[ramp(frame, 14, 20)]}
      />
    </AbsoluteFill>
  );
};
