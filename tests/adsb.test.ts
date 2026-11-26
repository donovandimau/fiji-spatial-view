import test from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../worker/src/adsb.ts";
test("aircraft are clipped, fresh and deduplicated across the seam", () => {
  const row = (lon: number, t: number) => [
    "id",
    " FJ ",
    null,
    t,
    null,
    lon,
    -17,
    700,
  ];
  const result = normalize(
    [row(180, 990), row(-180, 995), row(20, 999), row(178, 1)],
    1000,
  );
  assert.deepEqual(result, [
    { id: "id", label: "FJ", lon: -180, lat: -17, height: 700, time: 995 },
  ]);
});
