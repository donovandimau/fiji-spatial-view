import { C } from "../cesium";
import type { Viewer } from "cesium";
import { split } from "../../shared/geo";
export function makeViewer() {
  const viewer = new C.Viewer("globe", {
    baseLayer: false,
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    selectionIndicator: false,
    infoBox: false,
    requestRenderMode: true,
  });
  viewer.scene.globe.baseColor = C.Color.fromCssColorString("#12333e");
  // Hold camera altitude and local pitch fixed while aiming the center ray at Viti Levu.
  let south = -25,
    north = -17.8;
  for (let i = 0; i < 28; i++) {
    const lat = (south + north) / 2;
    viewer.camera.setView({
      destination: C.Cartesian3.fromDegrees(178, lat, 350000),
      orientation: { heading: 0, pitch: -Math.PI / 4, roll: 0 },
    });
    const ray = new C.Ray(viewer.camera.positionWC, viewer.camera.directionWC);
    const hit = C.IntersectionTests.rayEllipsoid(ray, C.Ellipsoid.WGS84)!;
    const center = C.Cartographic.fromCartesian(C.Ray.getPoint(ray, hit.start));
    if (C.Math.toDegrees(center.latitude) > -17.8) north = lat;
    else south = lat;
  }
  return viewer;
}
export function queryBounds(viewer: Viewer) {
  const rect = viewer.camera.computeViewRectangle();
  if (!rect) return [];
  const deg = C.Math.toDegrees;
  return split({
    west: deg(rect.west),
    south: deg(rect.south),
    east: deg(rect.east),
    north: deg(rect.north),
  });
}
