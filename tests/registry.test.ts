import test from "node:test";
import assert from "node:assert/strict";
import { LayerRegistry } from "../src/layers/registry.ts";
test("late activation cannot replace a newer activation", async () => {
  const handles: Array<(h: { dispose(): void }) => void> = [];
  const changes: boolean[] = [];
  const registry = new LayerRegistry({} as never, (_, enabled) =>
    changes.push(enabled),
  );
  const plugin = {
    id: "test",
    label: "Test",
    activate: () =>
      new Promise<{ dispose(): void }>((resolve) => handles.push(resolve)),
  };
  let released = 0;
  const first = registry.toggle(plugin);
  await registry.toggle(plugin);
  const second = registry.toggle(plugin);
  handles[1]({
    dispose() {
      released++;
    },
  });
  await second;
  handles[0]({
    dispose() {
      released++;
    },
  });
  await first;
  assert.equal(released, 1);
  await registry.toggle(plugin);
  assert.equal(released, 2);
  assert.deepEqual(changes, [true, false, true, false]);
});
