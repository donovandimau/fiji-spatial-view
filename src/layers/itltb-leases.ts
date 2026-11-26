import { C } from "../cesium";
import type { LayerPlugin } from "./types";
import { getJson } from "./tracks";
export const leases: LayerPlugin = {
  id: "itltb-leases",
  label: "Land",
  async activate(ctx) {
    const data = await getJson<object>(ctx, "leases.geojson");
    const source = await C.GeoJsonDataSource.load(data, {
      clampToGround: true,
      stroke: C.Color.TURQUOISE,
      fill: C.Color.TURQUOISE.withAlpha(0.22),
    });
    ctx.signal.throwIfAborted();
    await ctx.viewer.dataSources.add(source);
    ctx.viewer.scene.requestRender();
    return {
      dispose() {
        ctx.viewer.dataSources.remove(source, true);
        ctx.viewer.scene.requestRender();
      },
    };
  },
};
