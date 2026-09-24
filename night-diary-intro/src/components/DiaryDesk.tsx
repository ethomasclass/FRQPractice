import React from "react";
import { COLORS, FONTS } from "../theme";
import { DiaryPage } from "./DiaryPage";
import { OilLamp, lampFlicker } from "./OilLamp";

/** Layout shared by the diary scenes, so the page and lamp never jump between scenes. */
export const DESK = {
  page: { left: 420, top: 150, width: 1240, height: 720, rotate: -1.5 },
  lamp: { x: 250, y: 950, scale: 1.4 },
  textLeft: 170,
  lineGap: 84,
  /** Ruled line positions (page-relative y). */
  line: (i: number) => 150 + i * 84,
};

type Props = {
  frame: number;
  lampLit: number;
  /** 0 = page below the frame, 1 = in place. */
  pageIn: number;
  children?: React.ReactNode;
  pageStyle?: React.CSSProperties;
};

export const DiaryDesk: React.FC<Props> = ({ frame, lampLit, pageIn, children, pageStyle }) => {
  const f = lampFlicker(frame);
  const { page, lamp } = DESK;
  const flameX = lamp.x + 86 * lamp.scale;
  const flameY = lamp.y - 150 * lamp.scale;
  const glowFrom: [number, number] = [(flameX - page.left) / page.width, (flameY - page.top) / page.height];
  const offY = (1 - pageIn) * 1000;
  return (
    <>
      <DiaryPage
        width={page.width}
        height={page.height}
        glow={lampLit * f}
        glowFrom={glowFrom}
        style={{
          left: page.left,
          top: page.top + offY,
          transform: `rotate(${page.rotate + (1 - pageIn) * 6}deg)`,
          ...pageStyle,
        }}
      >
        {children}
      </DiaryPage>
      <OilLamp x={lamp.x} y={lamp.y} scale={lamp.scale} lit={lampLit} frame={frame} />
    </>
  );
};

/** Positions a line of handwriting so it sits on ruled line `i`. */
export const onLine = (i: number, fontSize: number, indent = 0): React.CSSProperties => ({
  position: "absolute",
  left: DESK.textLeft + indent,
  top: DESK.line(i) - fontSize * 0.7,
});

export const Caption: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; color?: string; size?: number }> = ({
  children,
  style,
  color = COLORS.gold,
  size = 48,
}) => (
  <div
    style={{
      position: "absolute",
      fontFamily: FONTS.heading,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: 2,
      textTransform: "uppercase",
      color,
      whiteSpace: "nowrap",
      textShadow: "0 2px 12px rgba(6,21,38,0.6)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** The lamp-lit wall behind the diary in scenes 7 and 8 (f = lamp flicker). */
export const wallBackground = (f: number) =>
  `radial-gradient(ellipse 60% 75% at 45% 55%, rgba(230,194,117,${0.3 * f}) 0%, rgba(230,194,117,${0.1 * f}) 45%, rgba(10,32,56,0) 75%), radial-gradient(ellipse 70% 80% at 18% 88%, rgba(230,194,117,${0.18 * f}) 0%, rgba(10,32,56,0) 60%), ${COLORS.navy}`;
