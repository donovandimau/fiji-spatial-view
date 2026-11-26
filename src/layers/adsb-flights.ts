import { tracks } from "./tracks";
import type { LayerPlugin } from "./types";
export const flights: LayerPlugin = {
  id: "adsb-flights",
  label: "Flights",
  activate: (ctx) => tracks(ctx, "adsb", "#f5bf70"),
};
