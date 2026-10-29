import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';

const V=(...p)=>new THREE.Vector3(...p);
const crossingCount={31:16,32:4,33:10,34:20,35:0,36:0,37:20,38:0,39:40,40:24};
let game;
before(async()=>{game=await createHeadlessGame();Object.assign(game,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});});
after(()=>disposeLabLevel(game));

function visibleBays(){
 game.scene.updateMatrixWorld(true);
 const drawing=[];
 game.scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material?.name!=='Observatory / recessed structural service bays'||mesh.material.visible===false)return;
  for(let parent=mesh;parent;parent=parent.parent)if(!parent.visible)return;
  drawing.push(mesh);
 });
 return drawing;
}

function singleOuterFace(drawing,point,outward,label){
 const ray=new THREE.Raycaster(point.clone().addScaledVector(outward,.10),outward.clone().negate(),0,.20);
 const hits=ray.intersectObjects(drawing,false).filter(hit=>hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(outward)>.999);
 assert.ok(hits.length,`${label}: the closed bay joint has a visible gap`);
 assert.ok(hits[0].point.distanceTo(point)<1e-4,`${label}: the joint moved off its original exterior plane`);
 const nearest=hits.filter(hit=>Math.abs(hit.distance-hits[0].distance)<1e-6);
 assert.equal(nearest.length,1,`${label}: two painted faces own the same exterior point`);
 return nearest[0];
}

test('the measured room31 crossing has one real painted face, and a duplicated source triangle is rejected',async()=>{
 await game.selectLevel(30,false);
 const drawing=visibleBays(),point=V(-19.8666666667,4.8,5.1999998093),outward=V(0,0,1);
 const hit=singleOuterFace(drawing,point,outward,'measured room31 rail/mullion crossing');
 // Negative control duplicates one actual rendered source triangle. It does
 // not replace the production geometry or any physical/query owner.
 const source=hit.object.geometry.attributes.position,vertices=[];
 for(const i of [hit.face.a,hit.face.b,hit.face.c])vertices.push(...V().fromBufferAttribute(source,i).applyMatrix4(hit.object.matrixWorld).toArray());
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 const duplicate=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xff00ff,side:THREE.DoubleSide}));duplicate.updateMatrixWorld();
 try{assert.throws(()=>singleOuterFace([...drawing,duplicate],point,outward,'duplicated actual triangle'),/two painted faces/);}
 finally{geometry.dispose();duplicate.material.dispose();}
 singleOuterFace(drawing,point,outward,'unchanged production mesh after the negative control');
});

for(let room=31;room<=40;room++)test(`observatory ${room}: both sides of every service-bay crossing and adjoining rail have a single closed exterior`,async t=>{
 await game.selectLevel(room-1,false);
 const drawing=visibleBays(),sources=game.firstLevel.world.root.children.filter(mesh=>{
  const p=mesh.geometry?.parameters;
  // The siphon's original owner has its own authored name. Select the
  // retained structural material and full dimensions, not a generic label.
  return mesh.isMesh&&mesh.material?.visible===false&&mesh.material.name==='Satin enamel / structural shell'&&p
   &&p.height>=4.5&&Math.min(p.width,p.depth)<1.3&&Math.max(p.width,p.depth)>=5.5;
 });
 let crossings=0,probes=0;
 for(const source of sources){
  const p=source.geometry.parameters,axis=p.width<p.depth?'x':'z',w=Math.max(p.width,p.depth),h=p.height,d=Math.min(p.width,p.depth);
  const rim=Math.min(.34,w*.055,h*.055),bar=rim*.44;
  const cols=Math.max(1,Math.min(6,Math.ceil((w-2*rim)/7.5))),rows=Math.max(1,Math.min(4,Math.ceil((h-2*rim)/5.8)));
  const cw=(w-rim*2)/cols,ch=(h-rim*2)/rows;
  const map=(u,v,z)=>{const point=V(u,v,z);if(axis==='x')point.applyAxisAngle(V(0,1,0),Math.PI/2);return source.localToWorld(point);};
  for(const sign of [-1,1]){
   const outward=V(axis==='x'?sign:0,0,axis==='z'?sign:0).transformDirection(source.matrixWorld);
   for(let x=1;x<cols;x++)for(let y=1;y<rows;y++){
    const u=-w/2+rim+x*cw,v=-h/2+rim+y*ch;crossings++;
    // Off-centre points lie inside the crossing, away from either quad's
    // triangulation edge. A shared mesh edge is not an overlapping face.
    for(const [du,dv]of [[.137,.271],[-.219,.113]]){
     singleOuterFace(drawing,map(u+du*bar,v+dv*bar,sign*d/2),outward,`room${room} crossing ${crossings}`);probes++;
    }
    // Both ends must meet the mullion on the very same plane. Merely
    // deleting the horizontal rail or opening a gap cannot pass this test.
    for(const du of [-.61,.61]){
     singleOuterFace(drawing,map(u+du*bar,v+.113*bar,sign*d/2),outward,`room${room} adjoining rail ${crossings}`);probes++;
    }
   }
  }
 }
 assert.equal(crossings,crossingCount[room],'The original measured set of physical partitions must remain present');
 assert.equal(probes,crossings*4);
 t.diagnostic(JSON.stringify({room,partitions:sources.length,crossings,realSurfaceProbes:probes}));
});
