import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {finishManufacturedChamber,manufacturedMaterials} from '../src/game/LabManufacturedFinish.js';
import {renderedTopArea} from './helpers/lab-deck-top-proof.js';

const rectangle={minX:14.2,maxX:25.8,minZ:-13.8,maxZ:-12.2};
const expected=(rectangle.maxX-rectangle.minX)*(rectangle.maxZ-rectangle.minZ);
function fixture(exclude){
 const root=new THREE.Group(),m=manufacturedMaterials({paint:0x4f9993,secondary:0xbd7f65,floor:0x9db6b0,accent:0xf4b98a});
 const decks=[],colliders=[],floors=[],meshes=[];
 for(const [name,minX,maxX,minZ,maxZ]of [['Suspended transverse receiving bay',6,26,-20,-12],['Lower side exit landing',14,26,-14,-4]]){
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(maxX-minX,.6,maxZ-minZ,1,.035),m.floor);mesh.name=name;mesh.position.set((minX+maxX)/2,14.7,(minZ+maxZ)/2);root.add(mesh);meshes.push(mesh);
  const proxy=new THREE.Mesh(new THREE.BoxGeometry(maxX-minX,.6,maxZ-minZ),m.dark);proxy.position.copy(mesh.position);proxy.visible=false;proxy.userData.collisionProxy=true;root.add(proxy);
  proxy.updateWorldMatrix(true,false);const collider={mesh:proxy,box:new THREE.Box3().setFromObject(proxy),enabled:true,kinematic:false};colliders.push(collider);
  const floor={minX,maxX,minZ,maxZ,y:15,mesh:proxy,enabled:true};floors.push(floor);decks.push({name,...floor});
 }
 if(exclude)decks[1].visibleTopExclusions=[{minX:6.035,maxX:25.965,minZ:-19.965,maxZ:-12.035}];
 const k={world:{root},m,decks,solidModels:[],artBins:new Map([[m.floor,meshes]]),game:{colliders,floors}};
 const dispose=()=>{root.traverse(o=>o.geometry?.dispose());for(const material of Object.values(m))material.dispose();};
 return{k,dispose};
}

test('the raised-deck probe detects the real duplicate top before exclusion',()=>{
 const f=fixture(false);try{finishManufacturedChamber(f.k);assert.ok(Math.abs(renderedTopArea(f.k.world.root,rectangle,15)-expected*2)<.0001);}finally{f.dispose();}
});

test('one raised deck owns every rendered overlap triangle while both complete physical supports stay intact',()=>{
 const f=fixture(true),{k}=f,colliders=k.game.colliders.slice(),floors=k.game.floors.slice();
 const before=colliders.map(c=>({c,mesh:c.mesh,geometry:c.mesh.geometry,box:c.box.clone(),position:c.mesh.position.clone(),children:c.mesh.children.slice()}));
 try{
  finishManufacturedChamber(k);assert.equal(k.manufacturedFinish.coplanarFields,1);
  assert.ok(Math.abs(renderedTopArea(k.world.root,rectangle,15)-expected)<.0001,'Coincident top triangles remain in the overlap');
  assert.deepEqual(k.game.colliders,colliders);assert.deepEqual(k.game.floors,floors);
  for(const s of before){assert.equal(s.c.mesh,s.mesh);assert.equal(s.mesh.geometry,s.geometry);assert.deepEqual(s.c.box,s.box);assert.deepEqual(s.mesh.position,s.position);assert.deepEqual(s.mesh.children,s.children);assert.equal(s.c.enabled,true);}
  for(const point of [[21.17,-13.37],[15.2,-12.8],[24.8,-13.7],[22,-5.3],[7,-19]]){
   const ray=new THREE.Raycaster(new THREE.Vector3(point[0],16,point[1]),new THREE.Vector3(0,-1,0));
   const tops=ray.intersectObjects(k.world.root.children).filter(h=>h.object.visible&&Math.abs(h.point.y-15)<.0001&&h.face.normal.y>.999);
   assert.equal(tops.length,1,`Expected one visible top at ${point}`);
  }
 }finally{f.dispose();}
});
