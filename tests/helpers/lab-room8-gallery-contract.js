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
export const isGalleryBrace = row => (row.mesh?.name ?? row.name)?.startsWith('Receiving gallery knee brace / ');
function assertKneeBraces(contract){
 const colliders=contract.colliders.filter(isGalleryBrace);
 assert.equal(colliders.length,4,'Exactly four elevated gallery knee braces are approved');
 for(const [i,row]of colliders.entries()){
  const x=i<2?-3.65:3.65,rear=i%2===1,z=rear?-10.55:-6.25,sign=rear?1:-1;
  assert.deepEqual(row.mesh,{name:'Receiving gallery knee brace / closed steel section',visible:true,ancestorsVisible:true,raycastChildren:[],
   matrix:[1,0,0,0,0,.634079588,sign*.77326779,0,0,-sign*.77326779,.634079588,0,x,5.765,z,1],frame:null});
  const round=n=>Math.round(n*1e9)/1e9;
  assert.deepEqual(row.box,{min:[round(x-.090000004),5.080405898,rear?-11.357067163:-7.057067163],max:[round(x+.090000004),6.449594102,rear?-9.742932837:-5.442932837]});
  assert.equal(row.enabled,true);assert.equal(row.frontPlane,null);
 }
 for(const key of ['camera','aim'])assert.deepEqual(contract[key].filter(isGalleryBrace),colliders.map(c=>c.mesh),`The four visible braces must participate in ${key}`);
 assert.equal(contract.portalRegistry.filter(isGalleryBrace).length,0);
}
export function originalRoom8Contract(contract) {
  assertKneeBraces(contract);
  const additions = Object.fromEntries(['colliders', 'camera', 'aim'].map(key => [key, contract[key].filter(isGallery)]));
  assert.deepEqual(additions.colliders.map(c => [c.mesh.name.slice(GALLERY_PREFIX.length), c.box.min, c.box.max]), GALLERY_BOUNDS,
    'Only the exact fifteen audited gallery supports and guards may extend collision');
  assert.equal(additions.camera.length, 15);
  assert.equal(additions.aim.length, 15);
  assert.equal(contract.portalRegistry.filter(isGallery).length, 0, 'Structural steel cannot become a portal surface');
  assert.equal(digest(additions), '73a7d5e5e57fc5091eff4110df5802fd924f86089481fc7e508b1ac8cafcf2f2',
    'Gallery visibility, transforms and collision/camera/aim registrations must keep their exact audited contract');
  const baseline = structuredClone(contract);
  for (const key of ['colliders', 'camera', 'aim']) baseline[key] = baseline[key].filter(row => !isGallery(row)&&!isGalleryBrace(row));
  assert.equal(baseline.colliders.length, 18, 'All eighteen original collision records must remain');
  return baseline;
}
