import { DurableObject } from "cloudflare:workers";
import { flights } from "./adsb";
import type { Env } from "./env";
interface Snapshot {
  body: string;
  source: string;
  fetched: number;
}
export class FlightFeed extends DurableObject<Env> {
  private pending?: Promise<Snapshot>;
  private async refresh(): Promise<Snapshot> {
    const r = await flights(this.env, this.ctx.storage);
    const snapshot = {
      body: await r.text(),
      source: r.headers.get("X-Flight-Source")!,
      fetched: Date.now(),
    };
    await this.ctx.storage.put("snapshot", snapshot);
    return snapshot;
  }
  async fetch() {
    let snapshot = await this.ctx.storage.get<Snapshot>("snapshot");
    const ttl = snapshot?.source === "OpenSky" ? 60000 : 180000;
    let delayed = false;
    if (!snapshot || Date.now() - snapshot.fetched >= ttl) {
      try {
        if (((await this.ctx.storage.get<number>("retry")) ?? 0) > Date.now())
          throw Error("Retry pending");
        this.pending ??= this.refresh()
          .catch(async (e) => {
            console.warn(
              "Regional flight refresh failed",
              e instanceof Error ? e.message : "unknown",
            );
            await this.ctx.storage.put("retry", Date.now() + 30000);
            throw e;
          })
          .finally(() => {
            this.pending = undefined;
          });
        snapshot = await this.pending;
      } catch {
        if (!snapshot || Date.now() - snapshot.fetched > 600000)
          return new Response("Flight providers unavailable", {
            status: 503,
            headers: { "Retry-After": "30", "Cache-Control": "no-store" },
          });
        delayed = true;
      }
    }
    const tracks = JSON.parse(snapshot.body) as { time: number }[];
    return Response.json(
      tracks.filter((t) => Date.now() / 1000 - t.time <= 600),
      {
        headers: {
          "X-Flight-Source": snapshot.source,
          "X-Flight-Snapshot": new Date(snapshot.fetched).toISOString(),
          "X-Flight-Delayed": String(delayed),
          "Access-Control-Expose-Headers":
            "X-Flight-Source,X-Flight-Snapshot,X-Flight-Delayed",
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
