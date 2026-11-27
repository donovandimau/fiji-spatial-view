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
  await assert.rejects(flights({}), /adsb.fi HTTP 503/);
});

test("429 cooldown skips the exhausted provider and uses a fresh regional snapshot", async (t) => {
  const { flights } = await import("../worker/src/adsb.ts");
  const storage = new Map<string, number>();
  const cooldown = {
    get: async (k: string) => storage.get(k),
    put: async (k: string, v: number) => {
      storage.set(k, v);
    },
  };
  let limited = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("opensky-network")) throw new Error("timeout");
    if (String(url).includes("adsb.lol")) {
      limited++;
      return new Response(null, {
        status: 429,
        headers: { "Retry-After": "3600" },
      });
    }
    return Response.json({ now: Date.now(), ac: [] });
  });
  for (let i = 0; i < 2; i++) {
    const r = await flights({}, cooldown);
    assert.equal(r.headers.get("X-Flight-Source"), "adsb.fi");
    assert.deepEqual(await r.json(), []);
  }
  assert.equal(limited, 1);
});

test("AirLabs trial reads both Fiji boxes and keeps only recent local positions", async (t) => {
  const { flights } = await import("../worker/src/adsb.ts");
  const now = Math.floor(Date.now() / 1000);
  const boxes = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const bbox = url.searchParams.get("bbox");
    boxes.push(bbox);
    const lng = bbox.startsWith("-22,-180") ? -179.5 : 178;
    return Response.json({response: [
      {hex: "A", flight_icao: "FJ1", updated: now - 5, lng, lat: -17, alt: 200},
      {hex: "B", updated: now - 650, lng, lat: -17},
      {hex: "C", updated: now, lng: 12, lat: -17},
    ]});
  });
  const response = await flights({AIRLABS_API_KEY:"test", AIRLABS_TRIAL_UNTIL:new Date((now+60)*1000).toISOString()});
  assert.deepEqual(boxes.sort(), ["-22,-180,-12,-178", "-22,176,-12,180"]);
  assert.equal(response.headers.get("X-Flight-Source"), "AirLabs");
  const [track, ...others] = await response.json();
  assert.equal(track.label, "FJ1");
  assert.equal(track.time, now - 5);
  assert.equal(others.length, 0);
});
