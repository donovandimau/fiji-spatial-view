import type { Env } from "./env";
import { flights } from "./adsb";
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
        const key = new Request(new URL("/adsb", url.origin));
        const cached = await caches.default.match(key);
        response = cached ?? (await flights(env));
        if (!cached) ctx.waitUntil(caches.default.put(key, response.clone()));
      } else response = await spatialObject(url.pathname, env);
    } catch {
      response = new Response("Data provider unavailable", { status: 502 });
    }
    const headers = new Headers(response.headers);
    headers.set("Vary", "Origin");
    if (request.headers.get("Origin") === env.PAGES_ORIGIN && env.PAGES_ORIGIN)
      headers.set("Access-Control-Allow-Origin", env.PAGES_ORIGIN);
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
