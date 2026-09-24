import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { FilmGrain, Vignette } from "./components/FilmLook";
import { Starfield } from "./components/Starfield";
import { ramp } from "./lib/anim";
import { loadFonts } from "./lib/fonts";
import { SceneOffset } from "./lib/sceneFrame";
import { S1Night } from "./scenes/S1Night";
import { S2Nisha } from "./scenes/S2Nisha";
import { S3World } from "./scenes/S3World";
import { S4Names } from "./scenes/S4Names";
import { S5Line } from "./scenes/S5Line";
import { S6Movement } from "./scenes/S6Movement";
import { S7Question } from "./scenes/S7Question";
import { S8Title } from "./scenes/S8Title";
import { S9Hook } from "./scenes/S9Hook";
import { Soundtrack } from "./Soundtrack";
import { COLORS } from "./theme";
import { SCENES, TOTAL_FRAMES, TRANSITION } from "./timeline";

loadFonts();

const ORDER = [
  ["night", S1Night],
  ["nisha", S2Nisha],
  ["world", S3World],
  ["names", S4Names],
  ["line", S5Line],
  ["movement", S6Movement],
  ["question", S7Question],
  ["title", S8Title],
  ["hook", S9Hook],
] as const;

/** Star brightness through the piece (absolute frames). */
const starBrightness = (f: number) => {
  const on = ramp(f, 0, 60);
  const mapDim = 1 - 0.5 * ramp(f, SCENES.world.from - 24, 40);
  const title = 0.7 * ramp(f, SCENES.title.from + 90, 90);
  return on * (f < SCENES.title.from ? mapDim : 1 + title);
};

export const NightDiaryIntro: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.navy }}>
      <Starfield brightness={starBrightness(frame)} />
      {ORDER.map(([id, Scene], i) => {
        const { from, duration } = SCENES[id];
        const tIn = TRANSITION[id];
        const next = ORDER[i + 1]?.[0];
        const tOut = next ? TRANSITION[next] : 0;
        const start = from - tIn;
        const length = duration + tIn;
        // Crossfade: fade in over our transition, fade out over the next scene's.
        const opacity = Math.min(tIn ? ramp(frame, start, tIn) : 1, tOut ? 1 - ramp(frame, from + duration - tOut, tOut) : 1);
        return (
          <Sequence key={id} from={start} durationInFrames={length} name={id}>
            <AbsoluteFill style={{ opacity }}>
              <SceneOffset offset={tIn}>
                <Scene />
              </SceneOffset>
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <Vignette />
      <FilmGrain opacity={0.07} />
      {/* Fade to navy at the very end. */}
      <AbsoluteFill style={{ backgroundColor: COLORS.navy, opacity: ramp(frame, TOTAL_FRAMES - 45, 45) }} />
      <Soundtrack />
    </AbsoluteFill>
  );
};
