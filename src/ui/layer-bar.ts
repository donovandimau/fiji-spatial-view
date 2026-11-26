import type { LayerPlugin } from "../layers/types";
import { LayerRegistry } from "../layers/registry";
const icons: Record<string, string> = {
  "ais-ferries":
    "M3 14l9-4 9 4-3 5H6z M7 12V6h10v6 M10 6V3h4v3 M3 21q3-2 6 0t6 0t6 0",
  "adsb-flights":
    "M12 2l2 8 7 5v2l-8-3v5l2 2v1l-3-1-3 1v-1l2-2v-5l-8 3v-2l7-5z",
  "splats-heritage": "M3 10l9-6 9 6z M5 20h14 M7 12v6 M12 12v6 M17 12v6",
  "itltb-leases": "M2 6l7-3 6 3 7-3v15l-7 3-6-3-7 3z M9 3v15 M15 6v15",
};
export function layerBar(plugins: LayerPlugin[], registry: LayerRegistry) {
  const bar = document.querySelector("nav")!;
  for (const plugin of plugins) {
    const button = document.createElement("button");
    const ns = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(ns, "svg"),
      path = document.createElementNS(ns, "path");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    path.setAttribute("d", icons[plugin.id] || "M3 12h18");
    icon.append(path);
    button.id = plugin.id;
    button.setAttribute("aria-pressed", "false");
    button.append(icon, plugin.label);
    button.onclick = () => void registry.toggle(plugin);
    bar.append(button);
  }
}
