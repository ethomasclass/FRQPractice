import { useSceneFrame } from "../lib/sceneFrame";
import React from "react";
import { AbsoluteFill} from "remotion";
import { DESK, DiaryDesk, onLine, wallBackground } from "../components/DiaryDesk";
import { Handwriting } from "../components/Handwriting";
import { lampFlicker } from "../components/OilLamp";
import { starPath } from "../components/Starfield";
import { EASE, EASE_IN, ramp } from "../lib/anim";
import { s } from "../timeline";
import { COLORS, FONTS } from "../theme";

// Continues exactly from scene 7's page layout.
const PAGE_TOP = 470;
const PAGE_H = 430;
const CLOSE = { from: 18, frames: 30 }; // cover swings shut (book-close SFX lands at its end)
const AWAY = { from: 80, frames: 50 };
const TITLE = { from: 95, frames: 55 };
const AUTHOR = 150;

/** 1:45–1:55 Title. The diary closes; THE NIGHT DIARY writes on in gold; the stars brighten. */
export const S8Title: React.FC = () => {
  const frame = useSceneFrame();
  const abs = frame + s(105);
  const f = lampFlicker(abs);
  const close = ramp(frame, CLOSE.from, CLOSE.frames, EASE_IN);
  const away = ramp(frame, AWAY.from, AWAY.frames, EASE);
  const wall = 1 - ramp(frame, 60, 90);
  const titleP = ramp(frame, TITLE.from, TITLE.frames, EASE);
  const edge = 5;
  const at = titleP * (100 + edge);
  const mask = `linear-gradient(90deg, #000 ${at - edge}%, transparent ${at}%)`;
  const { page } = DESK;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: wall,
          background: wallBackground(f),
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 1 - away,
          transform: `translateY(${away * 160}px) scale(${1 - away * 0.12})`,
          transformOrigin: "50% 80%",
        }}
      >
        <DiaryDesk frame={abs} lampLit={1 - away * 0.6} pageIn={1} pageStyle={{ top: PAGE_TOP, height: PAGE_H }}>
          <Handwriting text="But Mama, you were Muslim." fontSize={76} progress={1} style={onLine(0, 76, 20)} />
          <Handwriting text="So what am I?" fontSize={84} progress={1} style={onLine(1, 84, 20)} weight={700} />
        </DiaryDesk>
        {/* The cover swings over from the left and shuts. */}
        <div style={{ position: "absolute", left: page.left, top: PAGE_TOP, width: page.width, height: PAGE_H, perspective: 2600, transform: `rotate(${page.rotate}deg)` }}>
          <div
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: 10,
              background: `linear-gradient(135deg, #16385C 0%, ${COLORS.navy} 60%, ${COLORS.navyDeep} 100%)`,
              border: `3px solid ${COLORS.gold}`,
              boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
              transformOrigin: "0% 50%",
              transform: `rotateY(${-178 * (1 - close)}deg)`,
              backfaceVisibility: "hidden",
              opacity: close > 0.02 ? 1 : 0,
            }}
          >
            <div style={{ position: "absolute", inset: 22, border: `2px solid ${COLORS.gold}`, borderRadius: 6, opacity: 0.6 }} />
            <svg width={120} height={120} viewBox="-60 -60 120 120" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
              <path d={starPath(44)} fill={COLORS.gold} />
            </svg>
          </div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 350,
          width: "100%",
          textAlign: "center",
          fontFamily: FONTS.heading,
          fontWeight: 800,
          fontSize: 150,
          letterSpacing: 4,
          lineHeight: 1,
          color: COLORS.gold,
          textShadow: "0 0 40px rgba(230,194,117,0.35)",
        }}
      >
        <span style={{ display: "inline-block", WebkitMaskImage: mask, maskImage: mask, padding: "0 10px" }}>THE NIGHT DIARY</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 540,
          width: "100%",
          textAlign: "center",
          fontFamily: FONTS.heading,
          fontWeight: 800,
          fontSize: 56,
          letterSpacing: 6,
          color: COLORS.sky,
          opacity: ramp(frame, AUTHOR, 24),
          transform: `translateY(${(1 - ramp(frame, AUTHOR, 24)) * 20}px)`,
        }}
      >
        VEERA HIRANANDANI
      </div>
    </AbsoluteFill>
  );
};
