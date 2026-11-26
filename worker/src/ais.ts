import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { islands } from "../../shared/fiji";
import { contains, split, type Track } from "../../shared/geo";

export class FerryFeed extends DurableObject<Env> {
  private socket?: WebSocket;
  private connecting?: Promise<void>;
  private tracks = new Map<string, Track>();
  private lastRequest = 0;
  async fetch() {
    const ids = (this.env.FERRY_MMSIS || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{9}$/.test(s));
    if (!ids.length || !this.env.AISSTREAM_KEY)
      return new Response(
        "Ferry feed needs AISstream credentials and fleet MMSIs",
        { status: 503 },
      );
    this.lastRequest = Date.now();
    if (!this.socket) {
      this.connecting ??= this.openFeed(ids).finally(() => {
        this.connecting = undefined;
      });
      await this.connecting;
    }
    return Response.json(
      [...this.tracks.values()].filter(
        (t) => Date.now() / 1000 - t.time < 1800,
      ),
    );
  }
  private async openFeed(ids: string[]) {
    const response = await fetch("https://stream.aisstream.io/v0/stream", {
      headers: { Upgrade: "websocket" },
    });
    const ws = response.webSocket;
    if (!ws) throw Error("AISstream unavailable");
    ws.accept();
    this.socket = ws;
    const closed = () => {
      if (this.socket === ws) this.socket = undefined;
    };
    ws.addEventListener("close", closed);
    ws.addEventListener("error", closed);
    ws.addEventListener("message", (event) => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer);
        const msg = JSON.parse(raw);
        if (msg.error) {
          ws.close(1000, "Upstream subscription rejected");
          closed();
          return;
        }
        const meta = msg.MetaData;
        const id = String(meta?.MMSI);
        if (
          !ids.includes(id) ||
          !contains(islands, meta.longitude, meta.latitude)
        )
          return;
        this.tracks.set(id, {
          id,
          lon: meta.longitude,
          lat: meta.latitude,
          label: String(meta.ShipName || id).trim(),
          height: 0,
          time: Date.now() / 1000,
        });
      } catch {
        /* Ignore malformed upstream messages. */
      }
    });
    ws.send(
      JSON.stringify({
        APIKey: this.env.AISSTREAM_KEY,
        BoundingBoxes: split(islands).map((b) => [
          [b.south, b.west],
          [b.north, b.east],
        ]),
        FiltersShipMMSI: ids,
        FilterMessageTypes: [
          "PositionReport",
          "StandardClassBPositionReport",
          "ExtendedClassBPositionReport",
        ],
      }),
    );
    await this.ctx.storage.setAlarm(Date.now() + 120000);
  }
  async alarm() {
    if (Date.now() - this.lastRequest < 120000) {
      await this.ctx.storage.setAlarm(this.lastRequest + 120001);
      return;
    }
    this.socket?.close(1000, "Idle");
    this.socket = undefined;
    this.tracks.clear();
  }
}
