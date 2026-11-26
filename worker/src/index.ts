import type { Env } from "./env";
export { FlightFeed } from "./flight-feed";
import { spatialObject } from "./heritage";
export { FerryFeed } from "./ais";
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method !== "GET")
      return new Response("GET required", {
        status: 405,
        headers: { Allow: "GET" },
      });
    const url = new URL(request.url);
    let response: Response;
    try {
      if (url.pathname === "/ais")
        response = await env.FERRY_FEED.get(
          env.FERRY_FEED.idFromName("fiji"),
        ).fetch("https://feed.local/");
      else if (url.pathname === "/adsb") {
        response = await env.FLIGHT_FEED.get(
          env.FLIGHT_FEED.idFromName("nadi-fir"),
        ).fetch("https://feed.local/");
      } else response = await spatialObject(url.pathname, env);
    } catch (error) {
      if (url.pathname === "/adsb")
        console.warn(
          "Flights fallback failed",
          error instanceof Error ? error.message : "Unknown failure",
        );
      response = new Response("Data provider unavailable", { status: 502 });
    }
    const headers = new Headers(response.headers);
    headers.set("Vary", "Origin");
    if (request.headers.get("Origin") === env.PAGES_ORIGIN && env.PAGES_ORIGIN)
      headers.set("Access-Control-Allow-Origin", env.PAGES_ORIGIN);
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
