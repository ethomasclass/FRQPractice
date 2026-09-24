import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { COLORS, HEIGHT, WIDTH } from "../theme";

/** A four-point star, like the motif in the unit materials. */
export const starPath = (r: number) => {
  const k = r * 0.16;
  return `M0,${-r} Q${k},${-k} ${r},0 Q${k},${k} 0,${r} Q${-k},${k} ${-r},0 Q${-k},${-k} 0,${-r}Z`;
};

type Props = {
  /** 0 = hidden, 1 = normal, >1 = brighter (title card). */
  brightness: number;
  count?: number;
  seed?: string;
};

export const Starfield: React.FC<Props> = ({ brightness, count = 190, seed = "stars" }) => {
  const frame = useCurrentFrame();
  const stars = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => {
        const big = random(`${seed}-big-${i}`) > 0.93;
        return {
          x: random(`${seed}-x-${i}`) * WIDTH,
          y: random(`${seed}-y-${i}`) * HEIGHT,
          r: big ? 7 + random(`${seed}-r-${i}`) * 6 : 1.6 + random(`${seed}-r-${i}`) * 3.4,
          phase: random(`${seed}-p-${i}`) * Math.PI * 2,
          speed: 0.02 + random(`${seed}-s-${i}`) * 0.05,
          base: 0.35 + random(`${seed}-b-${i}`) * 0.55,
          gold: random(`${seed}-c-${i}`) > 0.8,
          big,
        };
      }),
    [count, seed],
  );
  if (brightness <= 0.001) return null;
  return (
    <AbsoluteFill>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <defs>
          <radialGradient id="star-glow">
            <stop offset="0%" stopColor={COLORS.cream} stopOpacity={0.55} />
            <stop offset="100%" stopColor={COLORS.cream} stopOpacity={0} />
          </radialGradient>
        </defs>
        {stars.map((st, i) => {
          const tw = 0.65 + 0.35 * Math.sin(frame * st.speed + st.phase);
          const o = Math.min(1, st.base * tw * brightness);
          const scale = 1 + (brightness > 1 ? (brightness - 1) * 0.35 : 0);
          return (
            <g key={i} transform={`translate(${st.x.toFixed(1)} ${st.y.toFixed(1)}) scale(${scale.toFixed(3)})`} opacity={o}>
              {st.big ? <circle r={st.r * 2.6} fill="url(#star-glow)" /> : null}
              <path d={starPath(st.r)} fill={st.gold ? COLORS.gold : COLORS.cream} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
