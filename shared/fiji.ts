import type { Bounds } from "./geo.ts";
export const islands: Bounds = {
  west: 176,
  south: -22,
  east: -178,
  north: -12,
};
export const fir: Bounds = { west: 161.25, south: -30, east: -171, north: 3.5 };
// ICAO APAC ANP Vol I, NFFF lateral limits. Longitudes unwrapped eastward.
const outline = [
  [180, 3.5],
  [180, -5],
  [189, -5],
  [360 - (175 + 40 / 60 + 31.2 / 3600), -(15 + 32 / 60 + 45.1 / 3600)],
  [180, -25],
  [171 + 25 / 60, -25],
  [168, -28],
  [163, -30],
  [163, -(17 + 40 / 60)],
  [161.25, -14],
  [163, -14],
  [170, -10],
  [170, 3.5],
];
export function inFir(lon: number, lat: number) {
  const x = lon < 0 ? lon + 360 : lon;
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [a, b] = outline[i],
      [c, d] = outline[j];
    const cross = (x - a) * (d - b) - (lat - b) * (c - a);
    if (
      Math.abs(cross) < 1e-9 &&
      x >= Math.min(a, c) &&
      x <= Math.max(a, c) &&
      lat >= Math.min(b, d) &&
      lat <= Math.max(b, d)
    )
      return true;
    if (b > lat !== d > lat && x < ((c - a) * (lat - b)) / (d - b) + a)
      inside = !inside;
  }
  return inside;
}
export const cities: Bounds[] = [
  { west: 178.38, south: -18.17, east: 178.51, north: -18.07 },
  { west: 177.35, south: -17.84, east: 177.49, north: -17.73 },
];
