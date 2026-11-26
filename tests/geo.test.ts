import test from "node:test";
import assert from "node:assert/strict";
import { split, contains } from "../shared/geo.ts";
import { fir, islands, inFir } from "../shared/fiji.ts";
test("provider rectangles and exact dateline", () => {
  assert.equal(split(islands).length, 2);
  for (const b of split(fir)) assert.ok(b.west <= b.east);
  for (const lon of [177.4, 179.9, -179.95, -178.8, 180, -180])
    assert.ok(contains(islands, lon, -17));
  assert.equal(contains(islands, 0, -17), false);
  assert.equal(contains(islands, 178, 1), false);
});
test("Nadi FIR includes Taveuni and Lau and excludes bbox corners", () => {
  for (const lon of [177.4, 179.9, -179.95, -178.8]) assert.ok(inFir(lon, -17));
  for (const [lon, lat] of [
    [0, -17],
    [-172, -24],
    [162, 3],
    [178, -40],
  ])
    assert.equal(inFir(lon, lat), false);
  assert.equal(inFir(-180, -25), true);
});
