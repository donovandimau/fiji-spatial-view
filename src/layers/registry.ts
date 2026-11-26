import type { LayerContext, LayerHandle, LayerPlugin } from "./types";
interface Slot {
  controller: AbortController;
  handle?: LayerHandle;
}
export class LayerRegistry {
  private active = new Map<string, Slot>();
  private context: Omit<LayerContext, "signal">;
  private changed: (id: string, enabled: boolean, error?: string) => void;
  constructor(
    context: Omit<LayerContext, "signal">,
    changed: (id: string, enabled: boolean, error?: string) => void,
  ) {
    this.context = context;
    this.changed = changed;
  }
  async toggle(plugin: LayerPlugin) {
    const slot = this.active.get(plugin.id);
    if (slot) {
      this.active.delete(plugin.id);
      slot.controller.abort();
      slot.handle?.dispose();
      this.changed(plugin.id, false);
      return;
    }
    const current: Slot = { controller: new AbortController() };
    this.active.set(plugin.id, current);
    this.changed(plugin.id, true);
    try {
      const handle = await plugin.activate({
        ...this.context,
        signal: current.controller.signal,
      });
      if (this.active.get(plugin.id) === current) current.handle = handle;
      else handle.dispose();
    } catch (error) {
      if (this.active.get(plugin.id) !== current) return;
      this.active.delete(plugin.id);
      current.controller.abort();
      this.changed(
        plugin.id,
        false,
        error instanceof Error ? error.message : "Layer unavailable",
      );
    }
  }
}
