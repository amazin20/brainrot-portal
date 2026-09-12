import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createMachinedProjector, createMachinedTurbine, createMachinedChassis, createMachinedGimbal } from '../src/game/LabMachinedModels.js';

// The exporter only uses Blob/FileReader for binary assembly: no DOM or textures.
globalThis.FileReader ??= class FileReader {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.({ target: this }); }
  async readAsDataURL(blob) { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.({ target: this }); }
};

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(repo, process.argv[2] || 'public/models/art');
await fs.mkdir(out, { recursive: true });
const assets = [
  ['hard-light-projector', createMachinedProjector, { radius: 1.15, accent: 0x7ee9ef }, 'Optical origin, forward +Z; casing extends behind origin.'],
  ['transfer-field-turbine', createMachinedTurbine, { radius: 2.15, accent: 0x7edee8 }, 'Field origin, forward +Z. transfer-rotor rotates about local Z, independently of its fixed duct.'],
  ['lift-pressure-chassis', createMachinedChassis, { width: 4, depth: 4, height: .62, y: -.34, accent: 0x7edee8 }, 'Deck local origin; body is below surface. Attach to original moving surface group.'],
  ['optical-trunnion-gimbal', createMachinedGimbal, { accent: 0xffc879 }, 'Mirror optical center; clear aperture radius 1.66m. optical-ring follows existing mirror yaw; optical-cradle stays stationary.'],
];

function inspect(root) {
  let vertices = 0, triangles = 0, primitives = 0, nonFinite = 0, zeroArea = 0, nonUnitNormals = 0;
  const mats = new Set(), a = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  root.traverse(node => {
    if (!node.isMesh) return;
    const g = node.geometry, p = g.attributes.position, n = g.attributes.normal, indices = g.index;
    if (!p || !n || !indices) throw new Error(`${node.name}: expected indexed geometry with normals`);
    vertices += p.count; triangles += indices.count / 3; primitives++; mats.add(node.material);
    for (const value of p.array) if (!Number.isFinite(value)) nonFinite++;
    for (const value of n.array) if (!Number.isFinite(value)) nonFinite++;
    for (let i = 0; i < n.count; i++) {
      const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
      if (Math.abs(length - 1) > .005) nonUnitNormals++;
    }
    for (let i = 0; i < indices.count; i += 3) {
      a.fromBufferAttribute(p, indices.getX(i));
      ab.fromBufferAttribute(p, indices.getX(i + 1)).sub(a); ac.fromBufferAttribute(p, indices.getX(i + 2)).sub(a);
      if (ab.cross(ac).lengthSq() <= 1e-18) zeroArea++;
    }
  });
  const bounds = new THREE.Box3().setFromObject(root);
  if (nonFinite || zeroArea || nonUnitNormals) throw new Error(`Invalid geometry: ${JSON.stringify({ nonFinite, zeroArea, nonUnitNormals })}`);
  return { vertices, triangles, primitives, materials: mats.size, textures: 0, bones: 0, animations: 0,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, nonFinite, zeroArea, nonUnitNormals };
}

const reports = [];
let validator = null;
try { validator = await import(process.env.GLTF_VALIDATOR_MODULE || 'gltf-validator'); } catch { /* Full validator is optional; never mislabel structural checks as validation. */ }
const sourcePath = path.join(repo, 'src/game/LabMachinedModels.js');
const sourceSha256 = crypto.createHash('sha256').update(await fs.readFile(sourcePath)).digest('hex');
for (const [name, builder, options, contract] of assets) {
  const model = builder(options), before = inspect(model);
  const buffer = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true, trs: true });
  if (buffer.byteLength >= 4_000_000) throw new Error(`${name} exceeds per-asset limit`);
  const filename = `${name}.glb`; await fs.writeFile(path.join(out, filename), Buffer.from(buffer));
  // Re-import the exact bytes written to disk; this exercises the project's GLTFLoader.
  const bytes = await fs.readFile(path.join(out, filename));
  const exact = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const imported = await new GLTFLoader().parseAsync(exact, '');
  const after = inspect(imported.scene);
  for (const field of ['triangles', 'vertices', 'primitives', 'materials']) if (before[field] !== after[field]) throw new Error(`${name}: round-trip changed ${field}`);
  let fullValidation = { status: 'not_tested', reason: 'Khronos gltf-validator package is not installed.' };
  if (validator) {
    const report = await validator.validateBytes(bytes, { uri: filename });
    await fs.writeFile(path.join(out, `${name}.validator.json`), JSON.stringify(report, null, 2) + '\n');
    if (report.issues.numErrors) throw new Error(`${name}: Khronos validation failed`);
    fullValidation = { status: 'pass', version: report.validatorVersion, errors: report.issues.numErrors, warnings: report.issues.numWarnings };
  }
  const report = { name, file: filename, bytes: bytes.byteLength, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    source: 'src/game/LabMachinedModels.js', sourceSha256, reproducibleCommand: 'node scripts/export-machined-models.mjs',
    generator: { three: THREE.REVISION, node: process.version }, options, contract, ...after,
    requiredExtensions: [], externalResources: [], fileBudgetBytes: 4_000_000, units: 'metres', upAxis: '+Y',
    originalDesign: true, geometryCheck: 'pass', roundTripImport: 'pass', fullValidation,
    browserVisualCheck: 'not_tested_by_exporter', integrationCheck: 'not_tested_by_exporter', hardwarePerformance: 'not_tested' };
  reports.push(report);
  await fs.writeFile(path.join(out, `${name}.report.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(`${filename}: ${bytes.byteLength} bytes, ${after.triangles} triangles, ${after.primitives} primitives; exported and re-imported.`);
}
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ revision: 1, assets: reports }, null, 2) + '\n');
