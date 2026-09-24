import React from "react";
import map from "../data/map.json";
import { COLORS, HEIGHT, WIDTH } from "../theme";

export type Camera = {
  /** Map-space point that sits at the screen anchor. */
  cx: number;
  cy: number;
  /** Zoom factor (1 = the subcontinent fills the frame). */
  k: number;
  /** Screen anchor. Defaults to frame centre. */
  sx?: number;
  sy?: number;
};

export const MAP = map;

export const project = (pt: number[], cam: Camera): [number, number] => [
  (cam.sx ?? WIDTH / 2) + (pt[0] - cam.cx) * cam.k,
  (cam.sy ?? HEIGHT / 2) + (pt[1] - cam.cy) * cam.k,
];

export const cameraTransform = (cam: Camera) =>
  `translate(${cam.sx ?? WIDTH / 2} ${cam.sy ?? HEIGHT / 2}) scale(${cam.k}) translate(${-cam.cx} ${-cam.cy})`;

type Props = {
  camera: Camera;
  /** Opacity of neighbouring countries. */
  neighbours?: number;
  /** Opacity of the undivided British India shape. */
  britishIndia?: number;
  /** 0 = one shape, 1 = India and Pakistan shaded separately. */
  split?: number;
  /** Children are drawn inside the map transform, in map coordinates. */
  children?: React.ReactNode;
  /** Children drawn in screen space above the map. */
  overlay?: React.ReactNode;
};

/** The subcontinent in sky blue on navy, built from Natural Earth data. */
export const MapView: React.FC<Props> = ({ camera, neighbours = 1, britishIndia = 1, split = 0, children, overlay }) => {
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <filter id="map-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={6} />
        </filter>
      </defs>
      <g transform={cameraTransform(camera)}>
        <g opacity={neighbours}>
          {map.neighbours.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={COLORS.sky}
              fillOpacity={0.06}
              stroke={COLORS.sky}
              strokeOpacity={0.22}
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g opacity={britishIndia}>
          <path d={map.britishIndia} fill={COLORS.sky} fillOpacity={0.12} stroke={COLORS.sky} strokeWidth={8} strokeOpacity={0.25} vectorEffect="non-scaling-stroke" filter="url(#map-glow)" />
          <path d={map.britishIndia} fill={COLORS.sky} fillOpacity={0.2 * (1 - split)} stroke={COLORS.sky} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          {split > 0 ? (
            <g opacity={split}>
              <path d={map.india} fill={COLORS.sky} fillOpacity={0.24} />
              <path d={map.pakistanWest} fill={COLORS.cream} fillOpacity={0.14} />
              <path d={map.pakistanEast} fill={COLORS.cream} fillOpacity={0.14} />
            </g>
          ) : null}
        </g>
        {children}
      </g>
      {overlay}
    </svg>
  );
};

/** A path that draws itself: progress 0→1 reveals the stroke from its start. */
export const DrawnPath: React.FC<{
  d: string;
  length: number;
  progress: number;
  color: string;
  width: number;
  glow?: boolean;
}> = ({ d, length, progress, color, width, glow }) => {
  if (progress <= 0) return null;
  const dash = `${length} ${length}`;
  const offset = length * (1 - Math.min(1, progress));
  return (
    <g>
      {glow ? (
        <path d={d} fill="none" stroke={color} strokeWidth={width * 4} strokeOpacity={0.35} strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" strokeLinejoin="round" filter="url(#map-glow)" />
      ) : null}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};
