import "./ui/theme.css";
import { makeViewer, queryBounds } from "./globe/viewer";
import { setupTerrain } from "./globe/terrain";
import { LayerRegistry } from "./layers/registry";
import { ferries } from "./layers/ais-ferries";
import { flights } from "./layers/adsb-flights";
import { heritage } from "./layers/splats-heritage";
import { leases } from "./layers/itltb-leases";
import { layerBar } from "./ui/layer-bar";
const status = document.querySelector("output")!;
function report(text: string) {
  status.textContent = text;
}
try {
  const viewer = makeViewer();
  void setupTerrain(viewer, report);
  const apiBase = new URL(import.meta.env.VITE_API_BASE || "/", location.href);
  const registry = new LayerRegistry(
    { viewer, apiBase, queryBounds: () => queryBounds(viewer) },
    (id, on, error) => {
      document.getElementById(id)?.setAttribute("aria-pressed", String(on));
      report(error || "");
    },
  );
  window.addEventListener("spatial-status", (e) =>
    report((e as CustomEvent<string>).detail),
  );
  layerBar([ferries, flights, heritage, leases], registry);
} catch {
  report("The globe needs a browser with WebGL 2 enabled.");
}
