import React from "react";
import { Composition } from "remotion";
import { NightDiaryIntro } from "./NightDiaryIntro";
import { HEIGHT, WIDTH } from "./theme";
import { FPS, TOTAL_FRAMES } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NightDiaryIntro"
    component={NightDiaryIntro}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
