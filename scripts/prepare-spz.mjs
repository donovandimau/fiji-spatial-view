// Build small glTF/3D Tiles descriptors next to a local, Y-up SPZ v2/v3 scan.
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
const [file, extent] = process.argv.slice(2);
const radius = Number(extent);
if (!file || !/^[\w-]+\.spz$/.test(basename(file)) || !(radius > 0))
  throw Error(
    "Usage: node scripts/prepare-spz.mjs scan.spz boundingRadiusMetres",
  );
const bytes = await readFile(file),
  header = gunzipSync(bytes);
if (header.readUInt32LE(0) !== 0x5053474e || ![2, 3].includes(header.readUInt32LE(4)))
  throw Error("Expected gzip-compressed SPZ version 2 or 3");
const count = header.readUInt32LE(8),
  degree = header[12];
if (!count || degree > 3) throw Error("Invalid SPZ header");
const ext = "KHR_gaussian_splatting",
  codec = ext + "_compression_spz_2",
  required = [ext, codec];
const accessors = [],
  attributes = {};
function attr(name, type, extra = {}) {
  attributes[name] = accessors.length;
  accessors.push({ count, componentType: 5126, type, ...extra });
}
attr("POSITION", "VEC3", {
  min: [-radius, -radius, -radius],
  max: [radius, radius, radius],
});
attr("COLOR_0", "VEC4", { componentType: 5121, normalized: true });
attr(ext + ":SCALE", "VEC3");
attr(ext + ":ROTATION", "VEC4");
for (let d = 1; d <= degree; d++)
  for (let i = 0; i < 2 * d + 1; i++)
    attr(ext + ":SH_DEGREE_" + d + "_COEF_" + i, "VEC4");
const gltf = {
  asset: { version: "2.0" },
  extensionsUsed: required,
  extensionsRequired: required,
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  buffers: [{ uri: basename(file), byteLength: bytes.length }],
  bufferViews: [{ buffer: 0, byteLength: bytes.length }],
  accessors,
  meshes: [
    {
      primitives: [
        {
          mode: 0,
          attributes,
          extensions: { [ext]: { extensions: { [codec]: { bufferView: 0 } } } },
        },
      ],
    },
  ],
};
const tiles = {
  asset: { version: "1.1" },
  extensionsUsed: ["3DTILES_content_gltf"],
  extensions: {
    "3DTILES_content_gltf": {
      extensionsUsed: required,
      extensionsRequired: required,
    },
  },
  geometricError: radius,
  root: {
    boundingVolume: { sphere: [0, 0, 0, radius] },
    geometricError: 0,
    refine: "REPLACE",
    content: { uri: "scan.gltf" },
  },
};
for (const [name, data] of [
  ["scan.gltf", gltf],
  ["tileset.json", tiles],
])
  await writeFile(join(dirname(file), name), JSON.stringify(data));
