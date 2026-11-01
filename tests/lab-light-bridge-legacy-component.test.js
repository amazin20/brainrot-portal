import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {LabPortals} from '../src/game/LabPortals.js';
import {createLightBridge} from '../src/game/LabLightBridge.js';

// Generic cardinal/stepped LightBridge regressions formerly exercised through
// the retired room14 island layout. Current14 uses a different oriented field;
// these tests intentionally claim no current14 route or geometry acceptance.
const V=(...p)=>new THREE.Vector3(...p);
function fixture(){
 const scene=new THREE.Scene(),game={scene,colliders:[],floors:[],cameraBlockers:[],aimBlockers:[]};
 game.portals=new LabPortals({scene,camera:new THREE.PerspectiveCamera(),renderer:null,maxResolution:64,samples:0});
 const world={floors:[],box(position,size,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.fromArray(position);scene.add(mesh);return mesh;}};
 const kit={game,world,ticks:[],resets:[],state:{}},bridge=createLightBridge(kit,{origin:[-5,2,0],direction:[1,0,0],span:[0,0,1],width:2.2,length:24,name:'Legacy cardinal light component'});
 game.physics=new LabPhysics();game.physics.createCargo({position:V(-20,.4,0),size:.78,mass:3.2});
 for(const p of bridge.pieces)game.physics.addStaticBox(p.mesh.uuid,p.collider.box,{enabled:p.collider.enabled});
 const source=()=>game.portals.place(0,V(0,2,0),V(-1,0,0),V(0,1,0));
 const horizontal=()=>{source();game.portals.place(1,V(5,4,0),V(1,0,0),V(0,1,0));bridge.update();};
 const vertical=(angle=0)=>{source();game.portals.place(1,V(5,0,0),V(0,1,0),V(Math.sin(angle),0,Math.cos(angle)));bridge.update();};
 const floorAt=(x,z)=>Math.max(0,...game.floors.filter(f=>f.enabled&&x>=f.minX&&x<=f.maxX&&z>=f.minZ&&z<=f.maxZ).map(f=>f.y));
 return{game,world,bridge,horizontal,vertical,floorAt,dispose(){bridge.dispose();game.physics.dispose();game.portals.dispose();}};
}

test('legacy LightBridge rerouting removes horizontal walking support while retaining the actual vertical solid',()=>{
 const f=fixture();try{
  f.horizontal();const old=f.bridge.pieces[1];assert.equal(old.floor.enabled,true);assert.equal(old.collider.enabled,true);assert.ok(f.floorAt(6,0)>3.9);assert.ok(f.game.physics.solids.get(old.mesh.uuid).body.collisionFilterMask);
  f.vertical();assert.equal(old.floor.enabled,false);assert.equal(old.collider.enabled,true);assert.equal(f.floorAt(6,0),0,'The retired horizontal support must not survive readdress');
  f.game.portals.clear();f.bridge.update();assert.equal(old.floor.enabled,false);assert.equal(old.collider.enabled,false);assert.equal(f.game.physics.solids.get(old.mesh.uuid).body.collisionFilterMask,0);
 }finally{f.dispose();}
});

test('legacy LightBridge diagonal floor twist keeps12finite strips and physically empty enclosing-AABB corners',()=>{
 const f=fixture();try{
  f.vertical(Math.PI/4);const curtain=f.bridge.pieces.filter(p=>p.collider.enabled&&!p.floor.enabled);assert.equal(curtain.length,12);
  for(const p of curtain){assert.ok(p.mesh.visible);assert.ok(f.game.physics.solids.get(p.mesh.uuid).body.collisionFilterMask);}
  const minX=Math.min(...curtain.map(p=>p.collider.box.min.x)),maxX=Math.max(...curtain.map(p=>p.collider.box.max.x)),minZ=Math.min(...curtain.map(p=>p.collider.box.min.z)),maxZ=Math.max(...curtain.map(p=>p.collider.box.max.z)),y=(curtain[0].collider.box.min.y+curtain[0].collider.box.max.y)/2;
  const corners=[[minX+.015,minZ+.015],[maxX-.015,minZ+.015],[minX+.015,maxZ-.015],[maxX-.015,maxZ-.015]];
  assert.ok(corners.filter(([x,z])=>!curtain.some(p=>p.collider.box.containsPoint(V(x,y,z)))).length>=2,'A stepped diagonal must not fill its enclosing rectangle');
  let calls=0;const update=f.game.physics.updateStaticBox;f.game.physics.updateStaticBox=function(...args){calls++;return update.apply(this,args);};f.bridge.update();assert.equal(calls,0,'Unchanged field must reuse its real bodies');
 }finally{f.dispose();}
});

test('legacy LightBridge disposal removes every owned floor/body/query registration and cannot resurrect through a retained reference',()=>{
 const f=fixture();f.horizontal();const pieces=[...f.bridge.pieces],physics=f.game.physics,originalCargo=physics.cargoBody;
 f.bridge.dispose();f.bridge.dispose();f.bridge.update();
 for(const {mesh,collider,floor} of pieces){
  assert.equal(collider.enabled,false);assert.equal(floor.enabled,false);assert.equal(mesh.visible,false);assert.equal(mesh.parent,null);assert.equal(physics.solids.has(mesh.uuid),false);assert.equal(f.world.floors.includes(floor),false);assert.equal(f.game.colliders.includes(collider),false);assert.equal(f.game.floors.includes(floor),false);assert.equal(f.game.cameraBlockers.includes(mesh),false);assert.equal(f.game.aimBlockers.includes(mesh),false);
 }
 assert.equal(physics.cargoBody,originalCargo);assert.ok(physics.world.bodies.includes(originalCargo));physics.dispose();f.game.portals.dispose();
});
