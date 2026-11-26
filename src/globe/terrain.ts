import type { Viewer, Cesium3DTileset } from "cesium";
import { C } from "../cesium";
import { cities } from "../../shared/fiji";
import { contains } from "../../shared/geo";
export async function setupTerrain(
  viewer: Viewer,
  report: (message: string) => void,
) {
  const token = import.meta.env.VITE_CESIUM_TOKEN;
  const outlines = C.GeoJsonDataSource.load("/fiji.geojson", {
    stroke: C.Color.fromCssColorString("#88ada1"),
    fill: C.Color.fromCssColorString("#476f62"),
    strokeWidth: 1,
  });
  const base = viewer.dataSources.add(outlines);
  if (token) {
    C.Ion.defaultAccessToken = token;
    void C.createWorldTerrainAsync()
      .then((p) => {
        viewer.terrainProvider = p;
        viewer.scene.requestRender();
      })
      .catch(() => report("World Terrain unavailable"));
    void C.IonImageryProvider.fromAssetId(3954)
      .then(async (p) => {
        viewer.imageryLayers.addImageryProvider(p);
        viewer.dataSources.remove(await base, true);
        viewer.scene.requestRender();
      })
      .catch(() => report("Sentinel-2 imagery unavailable"));
  } else report("Terrain and imagery need a Cesium token");
  const key = import.meta.env.VITE_GOOGLE_TILES_KEY;
  if (!key) return;
  let current = -1,
    generation = 0,
    tiles: Cesium3DTileset | undefined;
  function update() {
    const p = viewer.camera.positionCartographic;
    const city =
      p.height < 4000
        ? cities.findIndex((b) =>
            contains(
              b,
              C.Math.toDegrees(p.longitude),
              C.Math.toDegrees(p.latitude),
            ),
          )
        : -1;
    if (city === current) return;
    current = city;
    const version = ++generation;
    if (tiles) {
      viewer.scene.primitives.remove(tiles);
      tiles = undefined;
    }
    if (city < 0) return;
    const b = cities[city];
    const positions = C.Cartesian3.fromDegreesArray([
      b.west,
      b.south,
      b.east,
      b.south,
      b.east,
      b.north,
      b.west,
      b.north,
    ]);
    void C.Cesium3DTileset.fromUrl(
      "https://tile.googleapis.com/v1/3dtiles/root.json?key=" +
        encodeURIComponent(key),
      {
        showCreditsOnScreen: true,
        maximumScreenSpaceError: 24,
        clippingPolygons: new C.ClippingPolygonCollection({
          inverse: true,
          polygons: [new C.ClippingPolygon({ positions })],
        }),
      },
    )
      .then((result) => {
        if (version !== generation) {
          result.destroy();
          return;
        }
        tiles = result;
        viewer.scene.primitives.add(result);
        viewer.scene.requestRender();
      })
      .catch(() => report("City 3D unavailable · using base terrain"));
  }
  viewer.camera.changed.addEventListener(update);
  viewer.camera.moveEnd.addEventListener(update);
  update();
}
