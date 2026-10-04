import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SingularityKit,V} from '../src/game/LabSingularityKit.js';
import {SINGULARITY_ROOMS} from '../src/game/LabSingularityLayout.js';
import {buildCastleMechanismDetails} from '../src/game/LabCastleMechanismDetails.js';

// Geometry/visual fixture only. Height and volumes are explicit input samples,
// never a substitute for the castle's separate ordinary-input playthrough.
function fixture(){
 const game={scene:new THREE.Scene(),colliders:[],floors:[],cameraBlockers:[],aimBlockers:[],portalPanels:[],
  playerPosition:V(2,18,54),previousPlayerPosition:V(2,18,54),playerVelocity:V(1,-2,3),
  cargo:{position:V(4,18.4,54),velocity:V(3,2,1)},playerGrounded:true};
 const k=new SingularityKit(game),rooms=new Map();
 for(const def of SINGULARITY_ROOMS){const[x,y,z]=def.at;rooms.set(def.id,{def,b:{x0:x-def.w/2,x1:x+def.w/2,z0:z-def.d/2,z1:z+def.d/2},P:(a,c=0,h=0)=>[x+a,y+h,z+c]});}
 const a=k.box(rooms.get('archive').P(3,0,4.7),[.6,9.4,21],k.m.rose,{dynamic:true});
 const b=k.box(rooms.get('archive').P(-10,-3,4.7),[17,9.4,.6],k.m.steel,{dynamic:true});
 let height=0,flowing=false;const volumes=[10,0,0];
 const hoist=Object.freeze({get height(){return height;}}),sluice=Object.freeze({volumes,get flowing(){return flowing;}});
 const machines=new Map([['hoist',{state:hoist}],['sluice',{state:sluice}]]);
 const details=buildCastleMechanismDetails({game,k,rooms,machines});
 return {game,k,rooms,machines,details,a,b,sampleHeight(h){height=h;},sampleFlow(v){volumes.splice(0,3,...v);flowing=true;},dispose(){k.dispose();}};
}
const region=(r,x0,x1,z0,z1,y0,y1)=>new THREE.Box3(V(...r.P(x0,z0,y0)),V(...r.P(x1,z1,y1)));
function assertClear(details,box,name){
 for(const collider of details.solids)assert.equal(collider.box.intersectsBox(box),false,`${collider.mesh.name} enters ${name}`);
}

test('Castle fittings retain the central hoist, freight aperture and all valve-console approaches',()=>{
 const f=fixture();try{
  const h=f.rooms.get('hoist'),s=f.rooms.get('sluice'),a=f.rooms.get('archive');
  assertClear(f.details,region(h,-3.25,3.25,-3.25,3.25,0,20.4),'the full moving hoist and carried-player envelope');
  assertClear(f.details,region(h,-14.55,-9.45,15.7,18.3,17.95,22.85),'the original upper cargo portal aperture');
  for(const [x,z]of [[-18,-11],[0,-7],[0,0]])assertClear(f.details,region(h,x-.9,x+.9,z-.9,z+.9,.01,2.8),'the lower hoist loading and lift approach');
  for(const [x,z]of [[0,10],[-12,9],[-12,6.45],[-18,10],[-18,6],[-18,0]])assertClear(f.details,region(h,x-.8,x+.8,z-.8,z+.8,18.01,20.8),'the upper receiving route and exit corridor');
  const deckPosts=f.details.solids.filter(c=>c.mesh.name.includes('upper receiving deck founded post'));
  assert.equal(deckPosts.length,4,'The independent receiving deck must have four real founded supports');
  for(const c of deckPosts){
   assert.equal(c.box.min.y,h.def.at[1],'A receiving deck support must meet its real ground floor');
   assert.ok(c.box.max.y<18,'A receiving deck support must remain below the walking surface');
  }
  assert.equal(f.game.floors.length,0,'Connections must not create additional climbable gameplay floors');
  for(const x of [-15,0,15])for(const z of [2,10])assertClear(f.details,region(s,x-1.3,x+1.3,z-1.5,z+2.2,0,2.8),'a valve-control approach');
  for(const [x,z]of [[14,9],[12,-7],[-7,-7],[-7,-13],[-5,7],[-15,7]])assertClear(f.details,region(a,x-.8,x+.8,z-.8,z+.8,0,2.8),'the archive ground route');
  assert.equal(f.details.batches.length,5,'Moving fittings must stay in five shared draws');
 }finally{f.dispose();}
});

test('Archive rails and closed wall-borne cassettes clear both physical sections over their complete strokes',()=>{
 const f=fixture();try{
  const r=f.rooms.get('archive');
  for(let step=0;step<=40;step++){
   const t=step/40;
   f.k.move(f.a,r.P(3,15*t,4.7),0);f.k.move(f.b,r.P(-10-9*t,-3,4.7),0);f.details.update(0);
   for(const wall of [f.a,f.b]){
    // Contact at the casing's floor skin is intentional; no solid occupies
    // the interior swept metal section or jams its player/cargo collision.
    const interior=wall.userData.collider.box.clone().expandByScalar(-.002);
    assertClear(f.details,interior,'a moving archive wall');
   }
  }
  const pocketEnds=f.details.solids.filter(c=>c.mesh.name.includes('blind end'));
  assert.equal(pocketEnds.length,2,'Each slide pocket needs a real closed back');
 }finally{f.dispose();}
});

test('Tension legs and routing wheels read real machine samples without moving either actor or writing machine state',()=>{
 const f=fixture();try{
  const actor=JSON.stringify({player:f.game.playerPosition.toArray(),velocity:f.game.playerVelocity.toArray(),cargo:f.game.cargo.position.toArray(),cargoVelocity:f.game.cargo.velocity.toArray()});
  const ropes=f.details.batches.find(b=>b.name.includes('tension legs')),matrix=new THREE.Matrix4(),h=f.rooms.get('hoist');
  for(const height of [0,9,18]){
   f.sampleHeight(height);f.details.update(1/60);
   for(const [index,lower]of [[0,24.05-height*.8],[1,height+.25]]){
    ropes.getMatrixAt(index,matrix);
    const bottom=V(0,-.5,0).applyMatrix4(matrix),top=V(0,.5,0).applyMatrix4(matrix);
    assert.ok(Math.abs(bottom.y-h.P(0,0,lower)[1])<.00001);
    assert.ok(Math.abs(top.y-h.P(0,0,24.97)[1])<.00001);
   }
   assert.equal(f.machines.get('hoist').state.height,height);
  }
  f.sampleFlow([8.75,1.25,0]);f.details.update(1/60);
  assert.equal(f.details.diagnostics().flowFrom,0);assert.equal(f.details.diagnostics().flowTo,1);
  assert.deepEqual(f.machines.get('sluice').state.volumes,[8.75,1.25,0]);
  assert.equal(JSON.stringify({player:f.game.playerPosition.toArray(),velocity:f.game.playerVelocity.toArray(),cargo:f.game.cargo.position.toArray(),cargoVelocity:f.game.cargo.velocity.toArray()}),actor);
  assert.equal(f.details.diagnostics().writesMachineState,false);
 }finally{f.dispose();}
});
