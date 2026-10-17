import assert from 'node:assert/strict';
import {digest} from './lab-art-contract.js';

export const ROOM15_ORIGINAL_CONTRACT_DIGEST='8204ffc1bed02cf8aa2e27e44c03e3e5d086d47d1b0d8905f135a0e80767ea68';
export const ROOM15_SILL_NAME='Deep freight observation sill';
const SILL_COLLIDER=24,SILL_BLOCKER=52;
const originalBounds={min:[-19,0,-6.950000006],max:[-10,2,-6.649999994]};
const currentBounds={min:[-19,0,-6.950000024],max:[-10,2,-5.249999976]};
const currentMesh=()=>({name:ROOM15_SILL_NAME,visible:true,ancestorsVisible:true,raycastChildren:[],
 matrix:[1,0,0,0,0,1,0,0,0,0,1,0,-14.5,1,-6.1,1],frame:null});

function finiteJSON(value){
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){assert.ok(Number.isFinite(value),'Every retained contract number must be finite');return;}
 assert.ok(value&&typeof value==='object','Only complete JSON contract values are allowed');
 assert.equal(Object.getOwnPropertySymbols(value).length,0,'Contract records cannot hide symbol properties');
 if(Array.isArray(value)){
  assert.equal(Object.keys(value).length,value.length,'Contract arrays must be dense and have no hidden additions');
  for(let i=0;i<value.length;i++){assert.ok(Object.hasOwn(value,i),'Missing contract array entry');finiteJSON(value[i]);}
 }else{
  assert.equal(Object.getPrototypeOf(value),Object.prototype,'Contract records must retain their plain JSON type');
  for(const child of Object.values(value))finiteJSON(child);
 }
}

/** The one audited room15 fix deepens its existing grounded observation sill.
 * Check the complete current solid and its exact camera/aim registrations
 * before restoring only that record's original name, z transform and bounds.
 * The old whole-room golden then still guards every other physical record,
 * portal, actor spawn, interaction, cargo throat, count and registry order.
 * Back-face rounding differs by 18 nm because BoxGeometry stores float32
 * vertices; both exact retained bounds represent the same nominal z=-6.95.
 */
export function originalRoom15Contract(contract){
 finiteJSON(contract);
 assert.equal(contract.room.id,'countercurrent-weave');assert.equal(contract.room.index,14);
 assert.equal(contract.room.puzzle.cargoThroatHeight,1.55,'The inner freight throat must remain unchanged');
 for(const[key,count]of Object.entries({colliders:53,floors:11,camera:89,aim:89,portalRegistry:6,terminals:1}))
  assert.equal(contract[key].length,count,'The sill fix cannot change '+key+' membership');
 assert.deepEqual(contract.colliders[SILL_COLLIDER],{mesh:currentMesh(),box:currentBounds,enabled:true,frontPlane:null},
  'Only the exact enabled grounded sill, with its audited bounds and type, may differ');
 for(const key of ['camera','aim'])assert.deepEqual(contract[key][SILL_BLOCKER],currentMesh(),
  'The same exact sill must retain its original '+key+' registry position');
 for(const key of ['colliders','camera','aim'])assert.equal(contract[key].filter(r=>(r.mesh?.name??r.name)===ROOM15_SILL_NAME).length,1,
  'A naming prefix cannot authorize additional '+key+' records');
 assert.equal(contract.portalRegistry.some(r=>r.name===ROOM15_SILL_NAME),false,'The grounded sill is not a portal surface');
 const baseline=structuredClone(contract);
 for(const mesh of [baseline.colliders[SILL_COLLIDER].mesh,baseline.camera[SILL_BLOCKER],baseline.aim[SILL_BLOCKER]]){
  mesh.name='';mesh.matrix[14]=-6.8;
 }
 baseline.colliders[SILL_COLLIDER].box=structuredClone(originalBounds);
 assert.equal(digest(baseline),ROOM15_ORIGINAL_CONTRACT_DIGEST,
  'Every original physical and interaction record outside the one audited sill delta must remain exact');
 return baseline;
}
