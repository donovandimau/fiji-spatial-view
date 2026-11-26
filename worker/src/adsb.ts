import { fir, inFir } from "../../shared/fiji.ts";
import { split, type Track } from "../../shared/geo.ts";
import type { Env } from "./env";
let auth: { token: string; expires: number } | undefined;
async function token(env: Env) {
  if (!env.OPENSKY_CLIENT_ID && !env.OPENSKY_CLIENT_SECRET) return;
  if (auth && auth.expires > Date.now()) return auth.token;
  const res = await fetch(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    {
      method: "POST",
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
export async function flights(env: Env) {
  const bearer = await token(env);
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
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw Error("OpenSky unavailable");
      return (await res.json<{ states: unknown[][] | null }>()).states || [];
    }),
  );
  return Response.json(normalize(rows.flat(), Date.now() / 1000), {
    headers: { "Cache-Control": "public,max-age=60" },
  });
}
