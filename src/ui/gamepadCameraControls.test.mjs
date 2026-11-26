import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGamepadDeadzone,
  installGamepadCameraControls,
  readGamepadCameraInput,
} from './gamepadCameraControls.js';

function fakeTarget() {
  const listeners = new Map();
  return {
    tabIndex: -1,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
    listenerCount() {
      return [...listeners.values()].reduce(
        (count, entries) => count + entries.size,
        0,
      );
    },
  };
}

function gamepadFixture() {
  const canvas = fakeTarget();
  const windowRef = fakeTarget();
  const documentRef = fakeTarget();
  const intervals = new Map();
  let nextInterval = 1;
  windowRef.setInterval = (callback) => {
    const id = nextInterval++;
    intervals.set(id, callback);
    return id;
  };
  windowRef.clearInterval = (id) => intervals.delete(id);
  const cameraCalls = [];
  const camera = {
    view: {
      lon: 0,
      lat: 0,
      height: 10_000,
      heading: 0,
      pitch: -0.5,
      roll: 0,
    },
    pose() {
      return { ...this.view };
    },
    cancelFlight() {
      cameraCalls.push(['cancelFlight']);
    },
    setView({ destination, orientation }) {
      cameraCalls.push(['setView', { ...destination, ...orientation }]);
      Object.assign(this.view, destination, orientation);
    },
  };
  const viewer = {};
  let time = 1000;
  const gamepads = [];
  const dispose = installGamepadCameraControls(viewer, {
    windowRef,
    documentRef,
    navigatorRef: { getGamepads: () => gamepads },
    now: () => time,
    interrupt: (reason) => cameraCalls.push(['interrupt', reason]),
    cameraFor: () => camera,
    canvasFor: () => canvas,
    following: () => false,
    requestRender: () => cameraCalls.push(['requestRender']),
  });
  return {
    camera,
    cameraCalls,
    canvas,
    dispose,
    documentRef,
    gamepads,
    intervals,
    setTime(value) {
      time = value;
    },
    viewer,
    windowRef,
  };
}

test('Xbox stick axes use a remapped deadzone and standard trigger indices', () => {
  assert.equal(applyGamepadDeadzone(0.1), 0);
  assert.equal(applyGamepadDeadzone(-1), -1);
  const input = readGamepadCameraInput({
    axes: [0.5, -0.5, -0.25, 0.25],
    buttons: [...Array(6).fill({ value: 0 }), { value: 0.2 }, { value: 0.8 }],
  });
  assert.ok(Math.abs(input.panX - (0.5 - 0.18) / 0.82) < 1e-12);
  assert.ok(Math.abs(input.panY + (0.5 - 0.18) / 0.82) < 1e-12);
  assert.ok(Math.abs(input.orbitX + (0.25 - 0.18) / 0.82) < 1e-12);
  assert.ok(Math.abs(input.orbitY - (0.25 - 0.18) / 0.82) < 1e-12);
  assert.ok(Math.abs(input.zoom - 0.6) < 1e-12);
});

test('a connected Xbox controller pans, orbits, and zooms the camera', () => {
  const f = gamepadFixture();
  f.gamepads.push({
    connected: true,
    axes: [1, 0, -1, 0],
    buttons: [...Array(6).fill({ value: 0 }), { value: 0 }, { value: 1 }],
  });
  f.windowRef.dispatch('gamepadconnected');
  const tick = [...f.intervals.values()][0];
  assert.equal(typeof tick, 'function');
  tick();
  const calls = f.cameraCalls.filter(([name]) => name !== 'requestRender');
  assert.deepEqual(calls.slice(0, 2), [
    ['interrupt', 'manual-input'],
    ['cancelFlight'],
  ]);
  const [, view] = calls[2];
  // Left stick right: east along a north heading. Right stick left: the
  // heading turns. Right trigger: closer to the ground.
  assert.ok(view.lon > 0 && Math.abs(view.lat) < 1e-9);
  assert.ok(Math.abs(view.heading + 1 / 60) < 1e-12);
  assert.ok(view.height < 10_000 && view.height > 120);
  assert.ok(f.cameraCalls.some(([name]) => name === 'requestRender'));
  f.dispose();
});

test('keyboard input is enabled only on the focused globe and cleans up', () => {
  const f = gamepadFixture();
  f.canvas.focus = () => {
    f.documentRef.activeElement = f.canvas;
  };
  f.canvas.dispatch('pointerdown');
  assert.equal(f.documentRef.activeElement, f.canvas);
  assert.equal(f.canvas.tabIndex, 0);
  f.canvas.dispatch('keydown', {
    key: 'w',
    target: f.canvas,
    preventDefault() {},
  });
  const tick = [...f.intervals.values()][0];
  tick();
  // W slides forward: north along a north heading.
  assert.ok(f.camera.view.lat > 0);
  f.dispose();
  assert.equal(f.canvas.tabIndex, -1);
  assert.equal(f.canvas.listenerCount(), 0);
  assert.equal(f.windowRef.listenerCount(), 0);
  assert.equal(f.documentRef.listenerCount(), 0);
  assert.equal(f.intervals.size, 0);
});
