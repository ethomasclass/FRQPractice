import React from "react";
import { AbsoluteFill, Img, random, staticFile, useCurrentFrame } from "remotion";

/** Light film grain: a different pre-made noise frame, shifted randomly, every frame. */
export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.08 }) => {
  const frame = useCurrentFrame();
  const tile = Math.floor(random(`grain-${frame}`) * 8);
  const ox = Math.floor(random(`gx-${frame}`) * 60) - 30;
  const oy = Math.floor(random(`gy-${frame}`) * 60) - 30;
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity, pointerEvents: "none", overflow: "hidden" }}>
      <Img
        src={staticFile(`images/textures/grain-${tile}.png`)}
        style={{ position: "absolute", left: -40 + ox, top: -40 + oy, width: 2000, height: 1160 }}
      />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(6,21,38,0) 55%, rgba(6,21,38,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);
