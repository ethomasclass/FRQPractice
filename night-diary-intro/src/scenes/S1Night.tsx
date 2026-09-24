import { useSceneFrame } from "../lib/sceneFrame";
import React from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { DiaryDesk, onLine } from "../components/DiaryDesk";
import { Handwriting } from "../components/Handwriting";
import { ramp } from "../lib/anim";

// Scene-local timings (frames).
const LAMP_ON = 45;
const PAGE_IN = 95;
const WRITE = { from: 138, frames: 42 };

/** 0:00–0:10 Night. Stars, the lamp flickers on, the diary slides in, "Dear Mama," writes on. */
export const S1Night: React.FC = () => {
  const frame = useSceneFrame();
  const { fps } = useVideoConfig();
  const lit = ramp(frame, LAMP_ON, 30);
  const pageIn = spring({ frame: frame - PAGE_IN, fps, config: { damping: 18, mass: 1.1 } });
  return (
    <AbsoluteFill>
      <DiaryDesk frame={frame} lampLit={lit} pageIn={pageIn}>
        <Handwriting text="Dear Mama," fontSize={88} progress={ramp(frame, WRITE.from, WRITE.frames)} style={onLine(0, 88)} />
      </DiaryDesk>
    </AbsoluteFill>
  );
};
