import type { Env } from "./env";
export async function spatialObject(path: string, env: Env) {
  const key = path.slice(1);
  if (
    key !== "leases.geojson" &&
    !/^heritage\/(?:[\w-]+\/)*[\w-]+\.(?:json|gltf|bin|spz|glb)$/.test(key)
  )
    return new Response("Unknown asset", { status: 404 });
  const obj = await env.SPATIAL_DATA.get(key);
  if (!obj) return new Response("Dataset unavailable", { status: 404 });
  const headers = new Headers({
    "Content-Type": /\.(json|geojson|gltf)$/.test(key)
      ? "application/json"
      : "application/octet-stream",
    ETag: obj.httpEtag,
    "Cache-Control": "public,max-age=300",
  });
  return new Response(obj.body, { headers });
}
