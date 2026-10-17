import assert from 'node:assert/strict';
import {digest} from './lab-art-contract.js';

// Independently retained from the audited before/after geometry receipts.
// The original eighteen colliders and all portal/load/interaction records
// keep their original digest below. Only this closed fifteen-part structure
// may be subtracted, after checking its exact bounds and complete registries.
export const GALLERY_PREFIX = 'Air receiving gallery / ';
const GALLERY_BOUNDS = [
  ['founded column', [-3.809999996, -.000000057, -5.659999996], [-3.490000004, 6.380000057, -5.340000004]],
  ['column footing', [-4.029999995, -.000000001, -5.879999995], [-3.270000005, .200000001, -5.120000005]],
  ['founded column', [-3.809999996, -.000000057, -11.459999996], [-3.490000004, 6.380000057, -11.140000004]],
  ['column footing', [-4.029999995, -.000000001, -11.679999995], [-3.270000005, .200000001, -10.920000005]],
  ['founded column', [3.490000004, -.000000057, -5.659999996], [3.809999996, 6.380000057, -5.340000004]],
  ['column footing', [3.270000005, -.000000001, -5.879999995], [4.029999995, .200000001, -5.120000005]],
  ['founded column', [3.490000004, -.000000057, -11.459999996], [3.809999996, 6.380000057, -11.140000004]],
  ['column footing', [3.270000005, -.000000001, -11.679999995], [4.029999995, .200000001, -10.920000005]],
  ['underdeck cross-girder', [-4.050000191, 6.380000007, -5.670000002], [4.050000191, 6.799999993, -5.329999998]],
  ['underdeck cross-girder', [-4.050000191, 6.380000007, -11.470000002], [4.050000191, 6.799999993, -11.129999998]],
  ['underdeck longitudinal girder', [-3.820000002, 6.380000007, -12.999999809], [-3.479999998, 6.799999993, -3.100000191]],
  ['underdeck longitudinal girder', [3.479999998, 6.380000007, -12.999999809], [3.820000002, 6.799999993, -3.100000191]],
  ['solid side guard', [-4.25, 7.000000017, -12.999999809], [-4.11, 8.159999983, -3.100000191]],
  ['solid side guard', [4.11, 7.000000017, -12.999999809], [4.25, 8.159999983, -3.100000191]],
  ['solid rear guard', [-4.199999809, 7.000000017, -12.91], [4.199999809, 8.159999983, -12.77]],
];
export const isGallery = row => (row.mesh?.name ?? row.name)?.startsWith(GALLERY_PREFIX);
export function originalRoom8Contract(contract) {
  const additions = Object.fromEntries(['colliders', 'camera', 'aim'].map(key => [key, contract[key].filter(isGallery)]));
  assert.deepEqual(additions.colliders.map(c => [c.mesh.name.slice(GALLERY_PREFIX.length), c.box.min, c.box.max]), GALLERY_BOUNDS,
    'Only the exact fifteen audited gallery supports and guards may extend collision');
  assert.equal(additions.camera.length, 15);
  assert.equal(additions.aim.length, 15);
  assert.equal(contract.portalRegistry.filter(isGallery).length, 0, 'Structural steel cannot become a portal surface');
  assert.equal(digest(additions), '73a7d5e5e57fc5091eff4110df5802fd924f86089481fc7e508b1ac8cafcf2f2',
    'Gallery visibility, transforms and collision/camera/aim registrations must keep their exact audited contract');
  const baseline = structuredClone(contract);
  for (const key of ['colliders', 'camera', 'aim']) baseline[key] = baseline[key].filter(row => !isGallery(row));
  assert.equal(baseline.colliders.length, 18, 'All eighteen original collision records must remain');
  return baseline;
}
