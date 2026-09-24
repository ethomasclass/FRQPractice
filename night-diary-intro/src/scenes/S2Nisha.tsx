import { useSceneFrame } from "../lib/sceneFrame";
import React from "react";
import { AbsoluteFill} from "remotion";
import { Caption, DiaryDesk, onLine } from "../components/DiaryDesk";
import { Handwriting } from "../components/Handwriting";
import { ramp } from "../lib/anim";
import { localCue, s, VOICE, VoiceId } from "../timeline";

type Chunk = { voice: VoiceId; lines: string[] };

// Nisha's first entry, one short chunk at a time (≤12 words on screen), synced to her voice.
const CHUNKS: Chunk[] = [
  { voice: "s2-a", lines: ["My name is Nisha. I'm twelve."] },
  { voice: "s2-b", lines: ["I live in Mirpur Khas", "with Papa, Amil, and Dadi."] },
  { voice: "s2-c", lines: ["I never met you, Mama."] },
  { voice: "s2-d", lines: ["So I'm going to write to you", "every night."] },
];
const FONT = 80;

/** 0:10–0:22 Nisha. Diary text writes on line by line; the place and date caption fades in. */
export const S2Nisha: React.FC = () => {
  const frame = useSceneFrame();
  const starts = CHUNKS.map((c) => localCue("nisha", c.voice));
  return (
    <AbsoluteFill>
      <DiaryDesk frame={frame + s(10)} lampLit={1} pageIn={1}>
        <Handwriting text="Dear Mama," fontSize={88} progress={1} style={onLine(0, 88)} />
        {CHUNKS.map((c, i) => {
          const start = starts[i];
          const next = starts[i + 1] ?? 100000;
          const writeFrames = Math.max(24, VOICE[c.voice].seconds * 30 * 0.8);
          const perLine = writeFrames / c.lines.length;
          // Previous chunk lifts off the page just before the next is written.
          const out = 1 - ramp(frame, next - 10, 10);
          return (
            <div key={c.voice} style={{ opacity: out }}>
              {c.lines.map((line, j) => (
                <Handwriting
                  key={j}
                  text={line}
                  fontSize={FONT}
                  progress={ramp(frame, start + j * perLine, perLine)}
                  style={onLine(2 + j, FONT, 20)}
                />
              ))}
            </div>
          );
        })}
      </DiaryDesk>
      <Caption
        style={{
          right: 140,
          top: 900,
          opacity: ramp(frame, starts[0], 18) * (1 - ramp(frame, starts[1] - 12, 12)),
        }}
      >
        Mirpur Khas, Sindh · July 1947
      </Caption>
    </AbsoluteFill>
  );
};
