import type { Viewer } from "cesium";
import type { Bounds } from "../../shared/geo";
export interface LayerContext {
  readonly viewer: Viewer;
  readonly apiBase: URL;
  readonly signal: AbortSignal;
  queryBounds(): readonly Bounds[];
}
export interface LayerHandle {
  dispose(): void;
}
export interface LayerPlugin {
  readonly id: string;
  readonly label: string;
  activate(context: LayerContext): Promise<LayerHandle>;
}
