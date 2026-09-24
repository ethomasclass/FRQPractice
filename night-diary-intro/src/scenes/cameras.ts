import { Camera } from "../components/MapView";

// Shared map framings so the map scenes cut and zoom between each other cleanly.
/** Whole subcontinent, pushed right to leave a text column on the left. */
export const CAM_SUBCONTINENT: Camera = { cx: 960, cy: 545, k: 0.98, sx: 1340, sy: 545 };
/** Wide view: South Asia within the continent. */
export const CAM_WIDE: Camera = { cx: 930, cy: 470, k: 0.34, sx: 1150, sy: 540 };
/** Punjab, Sindh and Rajasthan: where the western border ran. */
export const CAM_WEST: Camera = { cx: 777, cy: 395, k: 2.7, sx: 1210, sy: 555 };

export const mixCamera = (a: Camera, b: Camera, t: number): Camera => {
  // Interpolate zoom geometrically so the push-in feels constant.
  const k = a.k * Math.pow(b.k / a.k, t);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    k,
    cx: lerp(a.cx, b.cx),
    cy: lerp(a.cy, b.cy),
    sx: lerp(a.sx ?? 960, b.sx ?? 960),
    sy: lerp(a.sy ?? 540, b.sy ?? 540),
  };
};
