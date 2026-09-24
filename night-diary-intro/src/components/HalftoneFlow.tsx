import React, { useEffect, useMemo, useRef } from "react";
import { noise2D } from "@remotion/noise";
import { random } from "remotion";
import halftones from "../data/halftone.json";
import { EASE, EASE_IN, clamp01, lerp, ramp } from "../lib/anim";
import { HEIGHT, WIDTH } from "../theme";

type Pt = [number, number];

export type FlowTiming = {
  tearOpen: number; // frame the map starts to rip open
  tearFrames: number;
  photosUntil: number; // last frame photos are shown before dissolving
  dissolve: number; // frame the halftone dots start to become particles
  dissolveFrames: number;
  particlesIn: number;
};

type Props = {
  frame: number;
  /** Control points along the western border in screen space, north to south. */
  spinePoints: Pt[];
  timing: FlowTiming;
  tearWidth?: number;
  particleCount?: number;
};

const GOLD = [230, 194, 117];
const CREAM = [246, 239, 226];
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(lerp(v, b[i], t)));

/**
 * A smooth spine for the rip: a Catmull-Rom curve through a few points along the
 * border, resampled evenly.
 */
const spine = (cp: Pt[], samples = 90): Pt[] => {
  const controls = cp.length;
  const out: Pt[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * (controls - 1);
    const k = Math.min(controls - 2, Math.floor(t));
    const u = t - k;
    const p0 = cp[Math.max(0, k - 1)];
    const p1 = cp[k];
    const p2 = cp[k + 1];
    const p3 = cp[Math.min(controls - 1, k + 2)];
    const f = (a: number, b: number, cc: number, d: number) =>
      0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
    out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
};

/**
 * Smoothed unit normals along the border, pointing east (toward India). Tangents are taken
 * over a wide window and kept consistently oriented, so the tear edges never cross.
 */
const normals = (pts: Pt[], window = 3) => {
  const out: Pt[] = [];
  pts.forEach((_, i) => {
    const a = pts[Math.max(0, i - window)];
    const b = pts[Math.min(pts.length - 1, i + window)];
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const prev = out[i - 1];
    if (prev ? nx * prev[0] + ny * prev[1] < 0 : nx < 0) {
      nx = -nx;
      ny = -ny;
    }
    out.push([nx, ny]);
  });
  return out;
};

/**
 * Scene 6's canvas layer: the map tears open along the border to show refugee photos
 * as gold halftone dots; the dots then drift off and become a two-way stream of people.
 */
export const HalftoneFlow: React.FC<Props> = ({ frame, spinePoints, timing, tearWidth = 165, particleCount = 700 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const border = useMemo(() => spine(spinePoints), [spinePoints]);
  const norms = useMemo(() => normals(border), [border]);

  // The torn edges: a lens-shaped rip along the border with ragged, fibrous edges.
  const tear = useMemo(() => {
    const n = border.length;
    const west: Pt[] = [];
    const east: Pt[] = [];
    for (let i = 0; i < n; i++) {
      // Lens-shaped rip that closes before the border's southern hook (Rann of Kutch).
      const taper = Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 0.5);
      const [px, py] = border[i];
      const [nx, ny] = norms[i];
      // Smooth variation along the rip, plus a little high-frequency raggedness.
      const w1 = tearWidth * taper * (0.85 + 0.3 * noise2D("tear-w", i * 0.1, 0)) + (random(`tj-${i}`) - 0.5) * 12;
      const w2 = tearWidth * taper * (0.85 + 0.3 * noise2D("tear-e", i * 0.1, 5)) + (random(`tk-${i}`) - 0.5) * 12;
      west.push([px - nx * w1, py - ny * w1]);
      east.push([px + nx * w2, py + ny * w2]);
    }
    return { west, east };
  }, [border, norms, tearWidth]);

  const photoRect = useMemo(() => {
    const all = [...tear.west, ...tear.east];
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }, [tear]);

  const particles = useMemo(
    () =>
      new Array(particleCount).fill(0).map((_, i) => ({
        dir: i % 2 === 0 ? 1 : -1,
        at: Math.floor(random(`pb-${i}`) * border.length),
        from: 90 + random(`pf-${i}`) * 240,
        to: 90 + random(`pt-${i}`) * 240,
        drift: (random(`pd-${i}`) - 0.5) * 120,
        period: 150 + random(`pp-${i}`) * 170,
        phase: random(`ph-${i}`),
        size: 1.8 + random(`ps-${i}`) * 1.8,
        gold: random(`pg-${i}`) > 0.85,
      })),
    [particleCount, border.length],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const t = timing;
    const open = ramp(frame, t.tearOpen, t.tearFrames, EASE);
    const tearFade = 1 - ramp(frame, t.dissolve + t.dissolveFrames * 0.6, 40);
    const n = border.length;

    const tearPath = (o: number) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const [bx, by] = border[i];
        const [wx, wy] = tear.west[i];
        const x = lerp(bx, wx, o);
        const y = lerp(by, wy, o);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = n - 1; i >= 0; i--) {
        const [bx, by] = border[i];
        const [ex, ey] = tear.east[i];
        ctx.lineTo(lerp(bx, ex, o), lerp(by, ey, o));
      }
      ctx.closePath();
    };

    if (open > 0 && tearFade > 0) {
      // The dark space under the map.
      ctx.save();
      ctx.globalAlpha = tearFade;
      tearPath(open);
      ctx.fillStyle = "#061526";
      ctx.fill();
      ctx.restore();
    }

    // Halftone photos.
    const grids = halftones as { cols: number; rows: number; v: number[] }[];
    const dissolve = clamp01((frame - t.dissolve) / t.dissolveFrames);
    if (open > 0 && grids.length && dissolve < 1) {
      const span = t.photosUntil - t.tearOpen;
      const each = span / grids.length;
      const { x0, y0, x1, y1 } = photoRect;
      const bw = x1 - x0;
      const bh = y1 - y0;
      ctx.save();
      // Before the dissolve the photo is clipped to the tear; during it, only dots that
      // started inside the tear are drawn (so they can drift out past the edges).
      tearPath(open);
      if (dissolve <= 0) ctx.clip();
      grids.forEach((g, gi) => {
        const start = t.tearOpen + gi * each;
        const isLast = gi === grids.length - 1;
        const vis = Math.min(ramp(frame, start - (gi === 0 ? 0 : 24), 24), isLast ? 1 : 1 - ramp(frame, start + each - 12, 24));
        if (vis <= 0) return;
        const gap = Math.max(bw / g.cols, bh / g.rows);
        // Slow Ken Burns push-in on the dots (≈5%).
        const kb = 1 + 0.05 * ramp(frame, start - 24, each + 48);
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const ox = cx - (g.cols * gap * kb) / 2;
        const oy = cy - (g.rows * gap * kb) / 2;
        for (let r = 0; r < g.rows; r++) {
          for (let c = 0; c < g.cols; c++) {
            const b = g.v[r * g.cols + c] / 99;
            if (b < 0.06) continue;
            let x = ox + (c + 0.5) * gap * kb;
            let y = oy + (r + 0.5) * gap * kb;
            if (dissolve > 0 && !ctx.isPointInPath(x, y)) continue;
            let rad = gap * kb * 0.5 * Math.sqrt(b) * 0.95;
            let col = GOLD;
            let alpha = vis;
            if (dissolve > 0) {
              const id = `${gi}-${r}-${c}`;
              const delay = random(`dd-${id}`) * 0.45;
              const p = EASE_IN(clamp01((dissolve - delay) / 0.55));
              const side = random(`ds-${id}`) > 0.5 ? 1 : -1;
              // Nearest border normal is close enough: the border is almost straight here.
              const [nx, ny] = norms[Math.floor(n / 2)];
              const dist = 160 + random(`dl-${id}`) * 300;
              x += nx * side * dist * p + ny * (random(`dt-${id}`) - 0.5) * 80 * p;
              y += ny * side * dist * p - nx * (random(`dt-${id}`) - 0.5) * 80 * p;
              rad = lerp(rad, 2.2, p);
              col = mix(GOLD, CREAM, p);
              alpha *= 1 - p;
            }
            ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
      ctx.restore();
    }

    // Torn paper edges: two ragged cream strokes, drawn over the photo.
    if (open > 0 && tearFade > 0) {
      ctx.save();
      ctx.globalAlpha = tearFade;
      ctx.lineJoin = "round";
      for (const side of [tear.west, tear.east]) {
        for (const [w, a] of [
          [7, 0.25],
          [3, 0.9],
        ] as const) {
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const x = lerp(border[i][0], side[i][0], open);
            const y = lerp(border[i][1], side[i][1], open);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(246,239,226,${a})`;
          ctx.lineWidth = w;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // The stream of people, in both directions across the border.
    const pin = ramp(frame, t.particlesIn, 60);
    if (pin > 0) {
      for (const pt of particles) {
        const u = ((frame / pt.period + pt.phase) % 1 + 1) % 1;
        const [bx, by] = border[pt.at];
        const [nx, ny] = norms[pt.at];
        const off = lerp(-pt.dir * pt.from, pt.dir * pt.to, u);
        const wob = Math.sin(u * Math.PI * 2 + pt.phase * 6) * 14 + pt.drift;
        const x = bx + nx * off + ny * wob;
        const y = by + ny * off - nx * wob;
        const a = Math.pow(Math.sin(Math.PI * u), 0.7) * pin;
        const c = pt.gold ? GOLD : CREAM;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [frame, border, norms, tear, photoRect, particles, timing]);

  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }} />;
};
