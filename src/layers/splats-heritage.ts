import { C } from "../cesium";
import type { Cesium3DTileset } from "cesium";
import type { LayerPlugin } from "./types";
import { getJson } from "./tracks";
interface Site {
  id: string;
  lon: number;
  lat: number;
  height: number;
  radius: number;
}
export const heritage: LayerPlugin = {
  id: "splats-heritage",
  label: "Heritage",
  async activate(ctx) {
    const sites = await getJson<Site[]>(ctx, "heritage/index.json");
    const locations = sites.map((site) => {
      if (
        !/^[\w-]+$/.test(site.id) ||
        ![site.lon, site.lat, site.height, site.radius].every(
          Number.isFinite,
        ) ||
        site.radius <= 0
      )
        throw Error("Invalid heritage site");
      return {
        ...site,
        position: C.Cartesian3.fromDegrees(site.lon, site.lat, site.height),
      };
    });
    let selected: string | undefined,
      active: Cesium3DTileset | undefined,
      generation = 0;
    const { viewer } = ctx;
    function update() {
      const p = viewer.camera.positionCartographic;
      const ground = viewer.scene.globe.getHeight(p);
      let nearest: string | undefined,
        min = Infinity;
      if (
        ground !== undefined &&
        !(viewer.terrainProvider instanceof C.EllipsoidTerrainProvider) &&
        p.height - ground < 150
      ) {
        for (const site of locations) {
          const distance = C.Cartesian3.distance(
            viewer.camera.positionWC,
            site.position,
          );
          if (distance < site.radius && distance < min) {
            nearest = site.id;
            min = distance;
          }
        }
      }
      if (selected === nearest) return;
      selected = nearest;
      const version = ++generation;
      if (active) {
        viewer.scene.primitives.remove(active);
        active = undefined;
      }
      if (!nearest) return;
      const site = locations.find((s) => s.id === nearest)!;
      const url = new URL("heritage/" + site.id + "/tileset.json", ctx.apiBase);
      void C.Cesium3DTileset.fromUrl(url.href, {
        modelMatrix: C.Transforms.eastNorthUpToFixedFrame(site.position),
      })
        .then((tiles) => {
          if (ctx.signal.aborted || version !== generation) {
            tiles.destroy();
            return;
          }
          active = tiles;
          viewer.scene.primitives.add(tiles);
          viewer.scene.requestRender();
        })
        .catch(() => {
          if (version === generation && !ctx.signal.aborted)
            window.dispatchEvent(
              new CustomEvent("spatial-status", {
                detail: "Heritage scan unavailable",
              }),
            );
        });
    }
    ctx.signal.throwIfAborted();
    const off = viewer.scene.postRender.addEventListener(update);
    update();
    return {
      dispose() {
        off();
        generation++;
        if (active) viewer.scene.primitives.remove(active);
        viewer.scene.requestRender();
      },
    };
  },
};
