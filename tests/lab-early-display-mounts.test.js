import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {OpenChamber} from '../src/game/LabOpenArchitecture.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';

const V=(...p)=>new THREE.Vector3(...p),game=await createHeadlessGame();game.chamberEdition='foundation';
const originalDocument=globalThis.document;
// This canvas records real instrument repaint calls; it is not a rendering
// or text-legibility claim. Native WebGL detail fixtures cover appearance.
globalThis.document={...originalDocument,createElement:()=>{
 const calls=[],context=new Proxy({calls,fillText:(...args)=>calls.push(args),measureText:t=>({width:String(t).length*32}),
  createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},
 {get:(target,key)=>key in target?target[key]:()=>{}});
 return{width:0,height:0,getContext:()=>context};
}};
after(()=>{disposeLabLevel(game);globalThis.document=originalDocument;});

const sameSize=(mesh,size)=>size.every((n,i)=>Math.abs(mesh.geometry?.parameters?.[['width','height','depth'][i]]-n)<1e-6);
const bounds=mesh=>{mesh.updateWorldMatrix(true,false);return new THREE.Box3().setFromObject(mesh);};
const positiveIntersection=(a,b)=>['x','y','z'].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>1e-6);
const boxGap=(a,b)=>Math.hypot(...['x','y','z'].map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])));

test('the complete authored gallery lip is mounted on the real observation deck before static batching',async()=>{
 // Keep the production authored members available for measurement. Only the
 // final static merge is deferred; the geometry and all finishing still run.
 const flush=OpenChamber.prototype.flush;OpenChamber.prototype.flush=function(){};
 try{await game.selectLevel(0,true);}finally{OpenChamber.prototype.flush=flush;}
 const level=game.firstLevel,deck=level.world.root.getObjectByName('Upper observation and exit gallery'),meshes=[];
 level.world.root.traverse(m=>{if(m.isMesh)meshes.push(m);});
 const fascia=meshes.find(m=>sameSize(m,[30.8,.96,.28])),cap=meshes.find(m=>sameSize(m,[30.8,.16,.34]));
 assert.ok(deck&&fascia&&cap);
 const deckBox=bounds(deck),fasciaBox=bounds(fascia);
 assert.ok(positiveIntersection(deckBox,fasciaBox),'The fascia must meet the actual closed deck, rather than hang in the former 37cm gap');
 assert.ok(positiveIntersection(deckBox,bounds(cap)),'The upper lip must join the walking slab as well');
 const brackets=meshes.filter(m=>sameSize(m,[.86,.83,.12])&&Math.abs(Math.abs(m.position.x)-14.3)<1e-6);
 const lights=meshes.filter(m=>(sameSize(m,[.13,.61,.075])&&Math.abs(Math.abs(m.position.x)-14.3)<1e-6)||sameSize(m,[7.5,.26,.075]));
 assert.equal(brackets.length,2);assert.equal(lights.length,3);
 for(const bracket of brackets)assert.ok(positiveIntersection(bounds(bracket),fasciaBox));
 for(const light of lights)assert.ok([fascia,...brackets].some(support=>boxGap(bounds(light),bounds(support))<.003),
  'Every light must retain its real fascia/bracket attachment after the complete lip moves');
 for(const mesh of [fascia,cap,...brackets,...lights])assert.equal(game.colliders.some(c=>c.mesh===mesh),false);
});

function mountedSidePicture(){
 const level=game.firstLevel,car=level.state['travelling-address'],side=car.group.getObjectByName('Carriage side berth and cargo readout'),front=car.group.getObjectByName('Carriage front berth and cargo readout');
 const guard=car.group.children.find(m=>m.isMesh&&sameSize(m,[.42,2.05,7.1])&&m.position.x<0);
 assert.ok(side&&front&&guard);assert.equal(side.parent,car.group);
 side.geometry.computeBoundingBox();guard.geometry.computeBoundingBox();car.group.updateWorldMatrix(true,true);
 const inverse=guard.matrixWorld.clone().invert(),b=side.geometry.boundingBox,certificate=[];
 for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){
  const point=V(x,y,0).applyMatrix4(side.matrixWorld).applyMatrix4(inverse);
  // The picture faces +X and sits just ahead of the opaque side guard. Its
  // complete projection, including all corners, must lie on that guard.
  assert.ok(point.y>guard.geometry.boundingBox.min.y&&point.y<guard.geometry.boundingBox.max.y);
  assert.ok(point.z>guard.geometry.boundingBox.min.z&&point.z<guard.geometry.boundingBox.max.z);
  const gap=point.x-guard.geometry.boundingBox.max.x;assert.ok(gap>.02&&gap<.06);
  certificate.push(point.toArray());
 }
 return{level,car,side,front,guard,certificate};
}

test('the side instrument fits its actual opaque guard and preserves the shared reading texture proportions',async()=>{
 await game.selectLevel(2,true);const{side,front}=mountedSidePicture();
 const image=side.material.map.image,p=side.geometry.parameters;
 assert.equal(side.material.map,front.material.map,'Both views must continue to read the same original instrument');
 assert.ok(Math.abs(p.width/p.height-image.width/image.height)<.02,'Letters must retain the shared texture aspect on the side picture');
 assert.equal(game.aimBlockers.includes(side),false);assert.equal(game.cameraBlockers.includes(side),false);
 assert.equal(game.colliders.some(c=>c.mesh===side),false);
});

test('the mounted side reading follows the real interpolated carriage, reports motion and resets without replacing either actor',async()=>{
 await game.selectLevel(2,true);const{level,car,side,front}=mountedSidePicture(),cargo=game.cargo,body=game.physics.cargoBody,shape=body.shapes[0];
 const texture=side.material.map,version=texture.version,initial=side.getWorldPosition(V());
 car.target=1;
 for(let i=0;i<6;i++){
  level.update(.2);level.renderUpdate(.5);mountedSidePicture();
  assert.equal(side.material.map,texture);assert.equal(front.material.map,texture);
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
 }
 assert.ok(side.getWorldPosition(V()).distanceTo(initial)>1,'The test must actually move the source carriage');
 assert.ok(texture.version>version);assert.ok(texture.image.getContext('2d').calls.some(([text])=>String(text).includes('В ПУТИ')));
 level.reset();level.renderUpdate(1);mountedSidePicture();
 assert.equal(side.material.map,texture);assert.ok(side.getWorldPosition(V()).distanceTo(initial)<1e-7);
 assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
});

test('the visual mount repairs preserve the complete pre-change physical, portal, camera and interaction contracts',async()=>{
 // Measured from the existing production source before these two mount
 // changes, not generated from the implementation under test.
 const before=new Map([[0,'c29160cc9e55293ae8bd317fa7036d3fd28059b938de734eb0bd34d5b991cc7b'],[2,'2929cbc42286c7f278d0a86218f3adfed66c37de459d12bdb0f3fe1dd62f95b3']]);
 for(const[index,hash]of before){await game.selectLevel(index,true);assert.equal(digest(gameplayContract(game)),hash,`Room ${index+1} changed an accepted gameplay owner`);}
});
