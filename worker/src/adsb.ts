import { fir, inFir } from "../../shared/fiji.ts";
import { split, type Track } from "../../shared/geo.ts";
import type { Env } from "./env";
let auth: { token: string; expires: number } | undefined;
async function token(env: Env, signal: AbortSignal) {
  if (!env.OPENSKY_CLIENT_ID && !env.OPENSKY_CLIENT_SECRET) return;
  if (auth && auth.expires > Date.now()) return auth.token;
  const res = await fetch(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    {
      method: "POST",
      signal,
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.OPENSKY_CLIENT_ID || "",
        client_secret: env.OPENSKY_CLIENT_SECRET || "",
      }),
    },
  );
  if (!res.ok) throw Error("OpenSky authentication failed");
  const data = await res.json<{ access_token: string; expires_in: number }>();
  auth = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 30) * 1000,
  };
  return auth.token;
}
export function normalize(rows: unknown[][], now: number) {
  const tracks = new Map<string, Track>();
  for (const row of rows) {
    const [id, label, , time, , lon, lat, baro] = row;
    if (
      typeof id !== "string" ||
      typeof time !== "number" ||
      time < now - 600 ||
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      !inFir(lon, lat)
    )
      continue;
    const height =
      typeof row[13] === "number"
        ? row[13]
        : typeof baro === "number"
          ? baro
          : 0;
    if ((tracks.get(id)?.time ?? 0) <= time)
      tracks.set(id, {
        id,
        label: String(label || id).trim(),
        lon,
        lat,
        height,
        time,
      });
  }
  return [...tracks.values()];
}
async function openSky(env: Env, signal: AbortSignal) {
  const bearer = await token(env, signal);
  const rows = await Promise.all(
    split(fir).map(async (b) => {
      const url = new URL("https://opensky-network.org/api/states/all");
      for (const [k, v] of Object.entries({
        lamin: b.south,
        lamax: b.north,
        lomin: b.west,
        lomax: b.east,
      }))
        url.searchParams.set(k, String(v));

      const res = await fetch(url, {
        headers: bearer ? { Authorization: "Bearer " + bearer } : {},
        signal,
      });
      if (!res.ok) throw Error("OpenSky HTTP " + res.status);
      const { states } = await res.json<{ states: unknown[][] | null }>();
      if (states !== null && !Array.isArray(states))
        throw Error("Invalid OpenSky snapshot");
      return states ?? [];
    }),
  );
  return normalize(rows.flat(), Date.now() / 1000);
}

interface Aircraft {
  hex: string;
  flight?: string;
  seen_pos?: number;
  lat?: number;
  lon?: number;
  alt_geom?: number;
  alt_baro?: number | "ground";
}

async function islandFlights() {
  const res = await fetch("https://api.adsb.lol/v2/point/-17.8/178/250", {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw Error("adsb.lol HTTP " + res.status);
  const data = await res.json<{ now: number; ac: Aircraft[] }>();
  const now = Date.now() / 1000;
  const stamp = data.now / 1000;
  if (
    !Number.isFinite(stamp) ||
    stamp < now - 600 ||
    stamp > now + 60 ||
    !Array.isArray(data.ac)
  ) {
    throw Error("Invalid or stale adsb.lol snapshot");
  }
  const rows = data.ac
    .filter((a) => Number.isFinite(a.seen_pos) && a.seen_pos! >= 0)
    .map((a) => {
      const feet = typeof a.alt_geom === "number" ? a.alt_geom : a.alt_baro;
      return [
        a.hex,
        a.flight,
        null,
        stamp - a.seen_pos!,
        null,
        a.lon,
        a.lat,
        typeof feet === "number" ? feet * 0.3048 : 0,
      ];
    });
  return normalize(rows, now);
}

export async function flights(env: Env) {
  let tracks: Track[];
  let source = "OpenSky";
  try {
    tracks = await openSky(env, AbortSignal.timeout(4000));
  } catch (error) {
    console.warn(
      "OpenSky FIR request failed",
      error instanceof Error
        ? error.name + ": " + error.message
        : "Unknown failure",
    );
    tracks = await islandFlights();
    source = "adsb.lol";
  }
  return Response.json(tracks, {
    headers: {
      "X-Flight-Source": source,
      "Access-Control-Expose-Headers": "X-Flight-Source",
      "Cache-Control":
        source === "OpenSky" ? "public,max-age=60" : "public,max-age=180",
    },
  });
}
