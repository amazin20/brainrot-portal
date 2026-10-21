import assert from 'node:assert/strict';
import fs from 'node:fs';
import {digest} from './lab-art-contract.js';

export const ROOM10_ORIGINAL_CONTRACT_DIGEST='6cb58c509dc8b7c3f6d803f02ac3e7439e2d9669d6aadac32548edd9a1cc68f4';
const original=JSON.parse(fs.readFileSync(new URL('../fixtures/room10-before-rigid-deck.json',import.meta.url)));
assert.equal(original.originalGolden,ROOM10_ORIGINAL_CONTRACT_DIGEST);
assert.equal(original.sourceCommit,'8eee93c02d4d6da18107ba9882c5656939257938');
const prefix='Freight receiving frame / ',round=n=>Math.round(n*1e9)/1e9;
const matrix=p=>[1,0,0,0,0,1,0,0,0,0,1,0,...p,1];
const mesh=(p,name='',visible=true)=>({name,visible,ancestorsVisible:visible,raycastChildren:[],matrix:matrix(p),frame:null});
function section(p,size,role=''){
 const half=size.map(n=>Math.fround(n/2));
 return{mesh:mesh(p,role?prefix+role:''),box:{min:p.map((n,a)=>round(n-half[a])),max:p.map((n,a)=>round(n+half[a]))},enabled:true,frontPlane:null};
}

// These are the reviewed manufacturing dimensions, independent of the room
// builder. Enlarged sections retain every old inner opening plane; shoes
// stand on the real floor 0 or receiving bank 1.82. No arbitrary prefix is free.
const upper=[];
for(const x of [.37,4.63])for(const z of [-.63,3.63])upper.push(section([x,8.98,z],[.30,6.04,.30],'overhead hanger'));
for(const y of [6.09,11.81]){
 for(const z of [-.63,3.63])upper.push(section([2.5,y,z],[4.56,.30,.30],'overhead cross-head'));
 for(const x of [.37,4.63])upper.push(section([x,y,1.5],[.30,.30,4.56],'overhead side tie'));
}
for(const x of [.29,4.71])for(const z of [-.71,3.71]){
 upper.push(section([x,6.14,z],[.46,.40,.46],'overhead lower shoe'));
 upper.push(section([x,11.735,z],[.46,.45,.46],'overhead upper junction'));
}
const lower=[];
for(const x of [-.68,8.28])for(const z of [-.18,3.18])lower.push(section([x,3.7,z],[.30,7.4,.30],'founded hood upright'));
for(const z of [-.18,3.18])lower.push(section([3.8,7.32,z],[9.26,.30,.30],'hood load girder'));
for(const x of [-.83,8.43])for(const z of [-.33,3.33])lower.push(section([x,x<0?.12:1.94,z],[.60,.24,.60],'founded hood shoe'));
for(const x of [-.76,8.36])for(const z of [-.26,3.26])lower.push(section([x,7.255,z],[.46,.45,.46],'hood upper junction'));

const oldUpper=[];
for(const x of [.44,4.56])for(const z of [-.56,3.56])oldUpper.push(section([x,8.98,z],[.16,6.04,.16]));
for(const y of [6.02,11.88]){
 for(const z of [-.56,3.56])oldUpper.push(section([2.5,y,z],[4.28,.16,.16]));
 for(const x of [.44,4.56])oldUpper.push(section([x,y,1.5],[.16,.16,4.28]));
}
const oldLower=[];
for(const x of [-.6,8.2])for(const z of [-.1,3.1])oldLower.push(section([x,3.7,z],[.14,7.4,.14]));
for(const z of [-.1,3.1])oldLower.push(section([3.8,7.32,z],[9,.16,.16]));

// The cassette remains in its original envelope. Its procedural float32
// triangles differ from the scan's old bounds by at most 23 nm, retained here
// exactly rather than relaxing tolerances for other solids.
const fixed={mesh:mesh([-6.75929201,1.212588333,1.5],'',false),
 box:{min:[-9.000000122,.000000023,-1.263991117],max:[-4.518583897,2.425176643,4.263991117]},enabled:true,kinematic:false,frontPlane:null};
const deck={mesh:mesh([-4.74,1.7,1.5],'',false),box:{min:[-8.4,1.58,.06],max:[-1.08,1.82,2.94]},enabled:true,kinematic:true,frontPlane:null};
const deckName='Rigid single-surface telescoping load deck';
const pose=[0,0,-1,0,0,1,0,0,1,0,0,0,-6.6,0,1.5,1];
const moving={name:'Bridge rigid telescoping span',visible:true,ancestorsVisible:true,
 raycastChildren:[{name:deckName,visible:true,matrix:pose}],matrix:pose,frame:null};

/** Verify only the separately approved rigid load plate and manufactured
 * frame delta, restore their retained 8eee records, and compare the unchanged
 * old whole-room golden. Portal/freight openings, hood travel, latch/contact,
 * controls, actor spawns, registry order and every other solid remain guarded.
 * This helper cannot approve a changed physical route or its animation: the
 * production route, negative hood and real contact tests cover those claims. */
export function originalRoom10Contract(contract){
 assert.equal(contract.room.id,'freight-ferry');assert.equal(contract.room.index,9);
 for(const [key,count]of Object.entries({colliders:92,camera:137,aim:137,floors:12,portalRegistry:7,terminals:1}))
  assert.equal(contract[key].length,count,'Only the exact approved room10 structure may change '+key);
 for(const [key,start]of [['colliders',34],['camera',59],['aim',59]]){
  const expected=key==='colliders'?upper:upper.map(r=>r.mesh);
  assert.deepEqual(contract[key].slice(start,start+20),expected,'Exact upper receiver sections and '+key+' membership');
 }
 for(const [key,start]of [['colliders',67],['camera',92],['aim',92]]){
  const expected=key==='colliders'?lower:lower.map(r=>r.mesh);
  assert.deepEqual(contract[key].slice(start,start+14),expected,'Exact founded hood sections and '+key+' membership');
 }
 for(const key of ['colliders','camera','aim'])assert.equal(contract[key].filter(r=>(r.mesh?.name??r.name).startsWith(prefix)).length,34);
 assert.equal(contract.portalRegistry.some(r=>r.name.startsWith(prefix)),false,'Structural steel cannot become a portal target');
 assert.deepEqual(contract.colliders[9],fixed,'The cassette may only retain its exact approved envelope');
 assert.deepEqual(contract.colliders[54],deck,'One real planar 24 cm plate replaces only the twelve scanned slab proxies');
 for(const key of ['camera','aim']){
  assert.deepEqual(contract[key][33],fixed.mesh);
  assert.deepEqual(contract[key][34],moving,'The new deck has exactly one real raycast child, without old scan triangles');
  assert.deepEqual(contract[key][79],deck.mesh,'The same single moving contact plate remains a blocker');
 }
 assert.deepEqual(contract.floors[11],{minX:-8.4,maxX:-1.08,minZ:.06,maxZ:2.94,y:1.82,enabled:true,mesh:deckName});
 assert.deepEqual(contract.state.freight.position,[-4.74,1.82,1.5]);
 const baseline=structuredClone(contract);
 baseline.colliders.splice(67,14,...structuredClone(oldLower));
 baseline.colliders.splice(34,21,...structuredClone(oldUpper),...structuredClone(original.deckColliders));
 baseline.colliders[9]=structuredClone(original.fixedProxy);
 for(const key of ['camera','aim']){
  baseline[key].splice(92,14,...structuredClone(oldLower.map(r=>r.mesh)));
  baseline[key].splice(59,21,...structuredClone(oldUpper.map(r=>r.mesh)),...structuredClone(original.deckColliders.map(r=>r.mesh)));
  baseline[key][33]=structuredClone(original.fixedProxy.mesh);baseline[key][34]=structuredClone(original.movingRayOwner);
 }
 baseline.floors[11].mesh=original.floorMeshName;baseline.state.freight.position[1]=original.freightCenterY;
 assert.equal(digest(baseline),ROOM10_ORIGINAL_CONTRACT_DIGEST,
  'Every original record outside the approved deck and receiver frame delta must retain its old exact golden');
 return baseline;
}
