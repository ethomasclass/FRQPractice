// Builds src/data/map.json: projected SVG paths for the subcontinent map.
// Source: Natural Earth 1:50m admin-0 countries via the world-atlas npm package (public domain).
// Everything is projected once into a 1920×1080 "map space"; scenes zoom with transforms.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoContains, geoMercator, geoPath } from "d3-geo";
import { feature, merge, mesh } from "topojson-client";

const require = createRequire(import.meta.url);
const topo = require("world-atlas/countries-50m.json");
const topoLow = require("world-atlas/countries-110m.json");
const W = 1920, H = 1080;

// Frame the subcontinent (with room for labels) inside the 120px safe area.
const projection = geoMercator().fitExtent(
  [[160, 150], [W - 160, H - 130]],
  { type: "MultiPoint", coordinates: [[61, 6], [97.5, 6], [61, 36.5], [97.5, 36.5]] },
);
const round = (s) => s.replace(/(\d+\.\d)\d+/g, "$1");
const path = (f) => round(geoPath(projection)(f) ?? "");

const geoms = topo.objects.countries.geometries;
const byId = (id) => geoms.find((g) => g.id === id);
const IND = "356", PAK = "586", BGD = "050";
const partitioned = new Set([IND, PAK, BGD]);

// Neighbouring countries for context (wide box so the zoom-out in scene 3 has land around it).
const inBox = (f) => {
  const [[x0, y0], [x1, y1]] = geoPath().bounds(f); // lon/lat bounds
  return x1 > 15 && x0 < 140 && y1 > -15 && y0 < 62;
};
// Immediate neighbours at 1:50m; everything further away at 1:110m to keep frames light.
const NEAR = new Set(["004", "364", "156", "524", "064", "104", "144"]); // AFG IRN CHN NPL BTN MMR LKA
const near = feature(topo, { type: "GeometryCollection", geometries: geoms.filter((g) => NEAR.has(g.id)) }).features;
const far = feature(topoLow, {
  type: "GeometryCollection",
  geometries: topoLow.objects.countries.geometries.filter((g) => !partitioned.has(g.id) && !NEAR.has(g.id)),
}).features.filter(inBox);
const neighbours = [...near, ...far].map(path).filter(Boolean);

const britishIndia = path(merge(topo, [byId(IND), byId(PAK), byId(BGD)]));
const india = path(feature(topo, byId(IND)));
const pakistanWest = path(feature(topo, byId(PAK)));
const pakistanEast = path(feature(topo, byId(BGD)));

// New borders. The western line is clipped south of Jammu & Kashmir (lat 32.5), where the
// 1947 boundary ends; the eastern line is the full India–East Pakistan boundary.
const clipNorth = (ml, maxLat) => {
  const out = [];
  for (const line of ml.coordinates) {
    let cur = [];
    for (const p of line) {
      if (p[1] <= maxLat) cur.push(p);
      else if (cur.length) { out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
  }
  return { type: "MultiLineString", coordinates: out };
};
const pair = (a, b) => (x, y) => (x.id === a && y.id === b) || (x.id === b && y.id === a);
const westGeo = clipNorth(mesh(topo, topo.objects.countries, pair(IND, PAK)), 32.5);
const eastGeo = mesh(topo, topo.objects.countries, pair(IND, BGD));

// Order west segments north→south and join into one continuous polyline so it draws in one stroke.
const westLines = westGeo.coordinates.slice().sort((a, b) => Math.max(...b.map((p) => p[1])) - Math.max(...a.map((p) => p[1])));
const orient = (l) => (l[0][1] < l[l.length - 1][1] ? l.slice().reverse() : l);
const westJoined = westLines.map(orient).flat();
// East: keep the longest continuous piece (drops tiny enclave outlines).
const eastMain = eastGeo.coordinates.slice().sort((a, b) => b.length - a.length)[0];

// Polylines in map space, with lengths for the self-drawing stroke.
const polyline = (coords) => {
  const pts = coords.map((p) => projection(p));
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const d = "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L");
  return { d, length: +len.toFixed(1) };
};
const borderWest = polyline(westJoined);
const borderEast = polyline(eastMain);

// Points along the western border in map space (for the torn-paper mask and particle flow).
const westPts = westJoined.map((p) => projection(p).map((v) => +v.toFixed(1)));
const sample = [];
for (let i = 0; i < westPts.length; i += Math.max(1, Math.floor(westPts.length / 80))) sample.push(westPts[i]);

// A smooth spine along the western border (Punjab → Sindh/Rajasthan) for the tear in scene 6.
const tearSpine = [
  [74.62, 32.05], [74.55, 31.1], [73.6, 29.9], [72.2, 28.2], [70.7, 26.7], [70.1, 25.2],
].map((p) => projection(p).map((v) => +v.toFixed(1)));

const cities = {
  Karachi: [67.01, 24.86],
  "Mirpur Khas": [69.01, 25.53],
  Lahore: [74.34, 31.55],
  Amritsar: [74.87, 31.63],
  Delhi: [77.21, 28.61],
  Jodhpur: [73.02, 26.24],
};
const citiesXY = Object.fromEntries(Object.entries(cities).map(([k, v]) => [k, projection(v).map((n) => +n.toFixed(1))]));

// Scattered "towns" inside British India (scene 3: people living side by side).
const biFeature = merge(topo, [byId(IND), byId(PAK), byId(BGD)]);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const towns = [];
while (towns.length < 420) {
  const lon = 61 + rand() * 36, lat = 7 + rand() * 29;
  if (geoContains(biFeature, [lon, lat])) towns.push(projection([lon, lat]).map((n) => +n.toFixed(1)));
}

const centroid = (f) => geoPath(projection).centroid(f).map((n) => +n.toFixed(1));

const out = {
  width: W, height: H,
  neighbours, britishIndia, india, pakistanWest, pakistanEast, borderWest, borderEast,
  borderWestPoints: sample,
  tearSpine,
  towns,
  cities: citiesXY,
  labels: {
    india: centroid(feature(topo, byId(IND))),
    pakistan: projection([69.5, 29.3]).map((n) => +n.toFixed(1)),
    eastPakistan: projection([90.3, 23.8]).map((n) => +n.toFixed(1)),
  },
};
writeFileSync(new URL("../src/data/map.json", import.meta.url), JSON.stringify(out));
console.log("map.json", (JSON.stringify(out).length / 1024).toFixed(0) + "KB", "cities", citiesXY, "labels", out.labels);
