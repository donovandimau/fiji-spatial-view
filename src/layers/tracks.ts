import { C } from "../cesium";
import { contains, type Track } from "../../shared/geo";
import type { LayerContext } from "./types";
export async function getJson<T>(
  ctx: LayerContext,
  path: string,
  onResponse?: (r: Response) => void,
): Promise<T> {
  const response = await fetch(new URL(path, ctx.apiBase), {
    signal: ctx.signal,
  });
  if (!response.ok)
    throw Error(
      response.status === 503 || response.status === 404
        ? "Dataset is not configured"
        : "Data provider unavailable",
    );
  onResponse?.(response);
  return response.json();
}
export async function tracks(ctx: LayerContext, path: string, color: string) {
  const source = new C.CustomDataSource(path);
  let timer: ReturnType<typeof setTimeout>;
  let disposed = false;
  let records: Track[] = [];
  async function refresh() {
    let provider: string | null = null;
    records = await getJson<Track[]>(ctx, path, (r) => {
      provider = r.headers.get("X-Flight-Source");
    });
    ctx.signal.throwIfAborted();
    if (path === "adsb" && provider) {
      const area =
        provider === "adsb.lol" ? "250 NM around Viti Levu" : "Nadi FIR";
      window.dispatchEvent(
        new CustomEvent("spatial-status", {
          detail: records.length + " aircraft · " + area + " · " + provider,
        }),
      );
    }
    render();
  }
  function render() {
    const bounds = ctx.queryBounds();
    source.entities.suspendEvents();
    try {
      source.entities.removeAll();
      for (const t of records) {
        if (!bounds.some((b) => contains(b, t.lon, t.lat))) continue;
        source.entities.add({
          id: t.id,
          name: t.label,
          position: C.Cartesian3.fromDegrees(t.lon, t.lat, t.height),
          point: {
            pixelSize: 9,
            color: C.Color.fromCssColorString(color),
            outlineColor: C.Color.BLACK,
            outlineWidth: 1,
          },
          label: {
            text: t.label,
            font: "12px sans-serif",
            pixelOffset: new C.Cartesian2(0, -17),
            distanceDisplayCondition: new C.DistanceDisplayCondition(0, 120000),
            showBackground: true,
          },
        });
      }
    } finally {
      source.entities.resumeEvents();
    }
    ctx.viewer.scene.requestRender();
  }
  async function poll() {
    try {
      await refresh();
    } catch {
      if (!ctx.signal.aborted) {
        records = [];
        source.entities.removeAll();
        ctx.viewer.scene.requestRender();
        window.dispatchEvent(
          new CustomEvent("spatial-status", {
            detail: path + " feed unavailable · retrying",
          }),
        );
      }
    } finally {
      if (!disposed && !ctx.signal.aborted) timer = setTimeout(poll, 60000);
    }
  }
  await refresh();
  await ctx.viewer.dataSources.add(source);
  const off = ctx.viewer.camera.moveEnd.addEventListener(render);
  timer = setTimeout(poll, 60000);
  return {
    dispose() {
      off();
      disposed = true;
      clearTimeout(timer);
      ctx.viewer.dataSources.remove(source, true);
      ctx.viewer.scene.requestRender();
    },
  };
}
