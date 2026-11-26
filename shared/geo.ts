export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}
export function split(b: Bounds): Bounds[] {
  if (b.west <= b.east) return [b];
  return [
    { ...b, east: 180 },
    { ...b, west: -180 },
  ];
}
export function contains(b: Bounds, lon: number, lat: number) {
  return (
    lat >= b.south &&
    lat <= b.north &&
    split(b).some(
      (p) =>
        (lon >= p.west && lon <= p.east) ||
        (Math.abs(lon) === 180 && (p.west === -180 || p.east === 180)),
    )
  );
}
export interface Track {
  id: string;
  label: string;
  lon: number;
  lat: number;
  height: number;
  time: number;
}
