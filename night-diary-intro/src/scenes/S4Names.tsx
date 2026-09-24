import { useSceneFrame } from "../lib/sceneFrame";
import React from "react";
import { AbsoluteFill, spring, useVideoConfig } from "remotion";
import { DiaryPage } from "../components/DiaryPage";
import { Postmark, STAMP_H, STAMP_W, Stamp } from "../components/Stamp";
import { EASE, lerp, ramp } from "../lib/anim";
import { COLORS, FONTS, HEIGHT, WIDTH } from "../theme";

type Leader = {
  key: string;
  name: string;
  postmark: string;
  caption: string;
  drop: number; // scene-local frame the stamp lands
  rotate: number;
  row: [number, number]; // position while they arrive
  final: [number, number]; // position after the split
  finalScale: number;
};

const SPLIT = 420; // leaders split apart: the gap foreshadows the border
const THREAD = 470; // red thread drops from Mountbatten into the gap
const ROW_Y = 400;
const BASE_SCALE = 0.85;

const LEADERS: Leader[] = [
  {
    key: "gandhi",
    name: "Gandhi",
    postmark: "GANDHI · CONGRESS",
    caption: "Freedom through nonviolence. One India.",
    drop: 30,
    rotate: -3,
    row: [1150, ROW_Y],
    final: [1320, 610],
    finalScale: 0.85,
  },
  {
    key: "nehru",
    name: "Nehru",
    postmark: "NEHRU · CONGRESS",
    caption: "Leader of Congress. Future prime minister.",
    drop: 120,
    rotate: 4,
    row: [1530, ROW_Y],
    final: [1640, 610],
    finalScale: 0.85,
  },
  {
    key: "jinnah",
    name: "Jinnah",
    postmark: "JINNAH · MUSLIM LEAGUE",
    caption: "A separate homeland for Muslims.",
    drop: 210,
    rotate: -4,
    row: [390, ROW_Y],
    final: [520, 610],
    finalScale: 0.85,
  },
  {
    key: "mountbatten",
    name: "Mountbatten",
    postmark: "MOUNTBATTEN · VICEROY",
    caption: "Sent by Britain to hand over power.",
    drop: 300,
    rotate: 2,
    row: [770, ROW_Y],
    final: [960, 290],
    finalScale: 0.68,
  },
];

const CAPTION_Y = 752;

/** 0:35–0:55 The names. Four leaders as postage stamps, postmarked, then split apart. */
export const S4Names: React.FC = () => {
  const frame = useSceneFrame();
  const { fps } = useVideoConfig();
  const split = spring({ frame: frame - SPLIT, fps, config: { damping: 20, stiffness: 60, mass: 1.2 } });

  const positions = LEADERS.map((l) => {
    const land = spring({ frame: frame - l.drop, fps, config: { damping: 14, stiffness: 90, mass: 0.9 } });
    const x = lerp(l.row[0], l.final[0], split);
    const y = lerp(l.row[1], l.final[1], split) - (1 - land) * 760;
    const scale = lerp(BASE_SCALE, l.finalScale, split) * (1 + (1 - land) * 0.18);
    return { x, y, scale, land };
  });
  const mb = positions[3];
  const threadP = ramp(frame, THREAD, 60, EASE);
  const threadTop = mb.y + (STAMP_H / 2) * mb.scale + 70;
  const threadBottom = lerp(threadTop, 900, threadP);
  const sway = Math.sin(frame * 0.05) * 10 * threadP;

  return (
    <AbsoluteFill>
      <DiaryPage
        width={WIDTH + 80}
        height={HEIGHT + 80}
        glowFrom={[0.05, 1.05]}
        glow={1}
        shade={0.3}
        style={{ left: -40, top: -40, borderRadius: 0, boxShadow: "none" }}
      />
      {/* The thread: hangs from Mountbatten's stamp down into the gap. */}
      {threadP > 0 ? (
        <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
          <path
            d={`M${mb.x},${threadTop} Q${mb.x + sway},${(threadTop + threadBottom) / 2} ${mb.x + sway * 0.4},${threadBottom}`}
            stroke={COLORS.border}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      {LEADERS.map((l, i) => {
        const p = positions[i];
        if (frame < l.drop - 25) return null;
        const pmFrame = frame - (l.drop + 30);
        const pm = spring({ frame: pmFrame, fps, config: { damping: 12, stiffness: 220 } });
        const impact = pmFrame >= 0 && pmFrame < 6 ? Math.sin((pmFrame / 6) * Math.PI) * 4 : 0;
        const zoom = 1 + 0.05 * ramp(frame, l.drop, 540);
        const nameOpacity = ramp(frame, l.drop + 8, 14);
        return (
          <div
            key={l.key}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y + impact,
              transform: `translate(-50%, -50%) scale(${p.scale}) rotate(${l.rotate + (1 - p.land) * 14}deg)`,
              width: STAMP_W,
              height: STAMP_H,
            }}
          >
            <Stamp image={`images/stamps/${l.key}-duotone.png`} zoom={zoom} />
            {pmFrame >= 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: STAMP_W - 118,
                  top: -52,
                  transform: `scale(${lerp(1.5, 1, pm)}) rotate(${-10 + i * 7}deg)`,
                  transformOrigin: "26% 50%",
                  opacity: Math.min(1, pm * 1.4) * 0.92,
                }}
              >
                <Postmark text={l.postmark} id={l.key} size={180} />
              </div>
            ) : null}
            <div
              style={{
                position: "absolute",
                top: STAMP_H + 22,
                left: "50%",
                transform: `translateX(-50%) rotate(${-l.rotate}deg) scale(${1 / p.scale})`,
                transformOrigin: "50% 0%",
                fontFamily: FONTS.heading,
                fontWeight: 800,
                fontSize: 48,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: COLORS.navy,
                opacity: nameOpacity,
                whiteSpace: "nowrap",
              }}
            >
              {l.name}
            </div>
          </div>
        );
      })}
      {/* Caption for the stamp that just landed, joined to it by a short gold rule. */}
      {LEADERS.map((l, i) => {
        const end = (LEADERS[i + 1]?.drop ?? SPLIT) - 15;
        const o = Math.min(ramp(frame, l.drop + 10, 16), 1 - ramp(frame, end - 12, 12));
        if (o <= 0) return null;
        const x = positions[i].x;
        return (
          <React.Fragment key={l.key}>
            <div
              style={{
                position: "absolute",
                left: x - 2,
                top: ROW_Y + (STAMP_H / 2) * BASE_SCALE + 92,
                width: 4,
                height: CAPTION_Y - (ROW_Y + (STAMP_H / 2) * BASE_SCALE + 92) - 12,
                background: COLORS.gold,
                opacity: o,
                transformOrigin: "50% 0%",
                transform: `scaleY(${o})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: CAPTION_Y,
                left: 0,
                width: WIDTH,
                textAlign: "center",
                fontFamily: FONTS.heading,
                fontWeight: 800,
                fontSize: 52,
                color: COLORS.navy,
                opacity: o,
                transform: `translateY(${(1 - o) * 16}px)`,
              }}
            >
              {l.caption}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
