import { tracks } from "./tracks";
import type { LayerPlugin } from "./types";
export const ferries: LayerPlugin = {
  id: "ais-ferries",
  label: "Ferries",
  activate: (ctx) => tracks(ctx, "ais", "#63e2d2"),
};
