import { Easing, interpolate } from "remotion";

export const EASE = Easing.bezier(0.33, 0, 0.2, 1); // smooth in-out
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 0.8, 0.2);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 over [start, start+duration] with easing. */
export const ramp = (frame: number, start: number, duration: number, easing = EASE) =>
  interpolate(frame, [start, start + Math.max(1, duration)], [0, 1], { ...clamp, easing });

/** Fade in at `start`, hold, fade out ending at `end`. */
export const fadeInOut = (frame: number, start: number, end: number, fadeIn = 15, fadeOut = 15) =>
  Math.min(ramp(frame, start, fadeIn), 1 - ramp(frame, end - fadeOut, fadeOut));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
