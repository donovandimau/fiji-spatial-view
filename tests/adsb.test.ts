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

test("timeout uses a real fallback snapshot and filters outside-FIR tracks", async (t) => {
  const { flights } = await import("../worker/src/adsb.ts");
  const seen = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    seen.push(String(url));
    if (!String(url).includes("api.adsb.lol"))
      throw new DOMException("timeout", "TimeoutError");
    return Response.json({
      now: Date.now(),
      ac: [
        {
          hex: "test",
          flight: " FJ ",
          lat: -17.8,
          lon: 178,
          seen_pos: 1,
          alt_geom: 1000,
        },
        { hex: "outside", lat: 0, lon: 0, seen_pos: 1 },
      ],
    });
  });
  const response = await flights({});
  assert.equal(response.headers.get("X-Flight-Source"), "adsb.lol");
  const [track, ...other] = await response.json();
  assert.equal(track.height, 304.8);
  assert.equal(track.label, "FJ");
  assert.equal(other.length, 0);
  assert.equal(seen.length, 3);
});

test("a valid empty OpenSky snapshot stays empty without fallback", async (t) => {
  const { flights } = await import("../worker/src/adsb.ts");
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ states: null }),
  );
  const response = await flights({});
  assert.equal(response.headers.get("X-Flight-Source"), "OpenSky");
  assert.deepEqual(await response.json(), []);
  assert.equal(fetch.mock.callCount(), 2);
});

test("failed providers do not produce an empty success", async (t) => {
  const { flights } = await import("../worker/src/adsb.ts");
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 503 }),
  );
  await assert.rejects(flights({}), /adsb.lol HTTP 503/);
});
