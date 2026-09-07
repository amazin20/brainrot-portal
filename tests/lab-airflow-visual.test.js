import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LabAirflowVisual} from '../src/game/LabAirflowVisual.js';
import {transformPortalDirection} from '../src/game/LabPortals.js';
const V=(...p)=>new THREE.Vector3(...p);
const segment=(a,d,length,kind='wall')=>({a:V(...a),direction:V(...d),length,kind});
function fx(){return new LabAirflowVisual(new THREE.Group());}
function dispose(f){f.mesh.geometry.dispose();f.mesh.material.dispose();}
function run(f,time=1){f.step(0,1);f.step(time,1);f.render(1);}
test('air trails use one bounded instanced draw and no solid sphere geometry',()=>{
 const f=fx();assert.ok(f.mesh.geometry.isInstancedBufferGeometry);assert.equal(f.mesh.material.transparent,true);assert.equal(f.mesh.material.depthWrite,false);assert.equal(f.mesh.material.depthTest,true);
 f.setPath([segment([0,2,0],[1,0,0],20)]);run(f);
 assert.equal(f.mesh.geometry.instanceCount,180);assert.ok(f.shape.array.some(n=>n>0));dispose(f);
});
test('same world speed is used for short and long air segments, not proportional to length',()=>{
 const a=fx(),b=fx();a.setPath([segment([0,2,0],[1,0,0],12)]);b.setPath([segment([0,2,0],[1,0,0],30)]);run(a,1);run(b,1);
 assert.ok(a.shape.getZ(0)>0&&b.shape.getZ(0)>0);assert.equal(a.center.getX(0),b.center.getX(0));dispose(a);dispose(b);
});
test('ribbons never span the space between linked portals or extend past blocked endpoints',()=>{
 const f=fx();f.setPath([segment([0,2,0],[1,0,0],10,'portal'),segment([50,2,5],[-1,0,0],9)]);run(f,3);
 for(let i=0;i<f.capacity;i++)if(f.shape.getZ(i)>0){
  const x=f.center.getX(i),span=f.shape.getX(i),first=x>=0&&x<=10,last=x>=41&&x<=50;
  assert.ok(first||last,`Particle in portal gap ${x}`);
  const min=first?0:41,max=first?10:50;assert.ok(x-span/2>=min-1e-6&&x+span/2<=max+1e-6);
 }dispose(f);
});
test('portal twist maps the plume basis with the same transform as physical travel',()=>{
 const f=fx();
 const a={position:V(10,2,0),normal:V(-1,0,0),right:V(0,0,1),up:V(0,1,0),width:1,height:2};
 const b={position:V(50,2,5),normal:V(-1,0,0),right:V(0,1,0),up:V(0,0,-1),width:1,height:2};
 for(const p of [a,b])p.quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(p.right,p.up,p.normal));
 f.setPath([segment([0,2,0],[1,0,0],10,'portal'),segment([49.93,2,5],[-1,0,0],9)],[a,b]);
 assert.ok(f.path[1].right.distanceTo(transformPortalDirection(f.path[0].right,a,b))<1e-9);
 assert.ok(f.path[1].up.distanceTo(transformPortalDirection(f.path[0].up,a,b))<1e-9);dispose(f);
});
test('vertical flow, short segments and missing pair remain finite',()=>{
 const f=fx();f.setPath([segment([0,0,0],[0,1,0],.02,'portal'),segment([3,4,0],[0,-1,0],18)]);run(f,10);
 for(const a of [f.center.array,f.tangent.array,f.shape.array])assert.ok(a.every(Number.isFinite));dispose(f);
});
test('repeated render calls do not advance time, rewrite state or allocate buffers',()=>{
 const f=fx();f.setPath([segment([0,2,0],[1,0,0],20)]);run(f);const center=f.center.array,shape=f.shape.array,time=f.time;
 f.render(.37);const before=Array.from(shape);for(let i=0;i<100;i++)f.render(.37);
 assert.equal(f.time,time);assert.equal(center,f.center.array);assert.equal(shape,f.shape.array);assert.deepEqual(Array.from(shape),before);dispose(f);
});
test('removing portals replaces the path immediately, not leaving a ghost outlet',()=>{
 const f=fx();f.setPath([segment([0,2,0],[1,0,0],10,'portal'),segment([50,2,5],[-1,0,0],9)]);run(f,2);
 f.setPath([segment([0,2,0],[1,0,0],10)]);f.render(1);
 for(let i=0;i<f.capacity;i++)if(f.shape.getZ(i)>0)assert.ok(f.center.getX(i)<=10);
 f.setPath([]);f.render(1);assert.equal(f.mesh.visible,false);dispose(f);
});
test('low graphics samples the entire path, reset is complete, invalid budgets fail early',()=>{
 const f=fx();f.setPath([segment([0,2,0],[1,0,0],80)]);run(f);f.render(1,'low');
 assert.equal(f.mesh.geometry.instanceCount,99);assert.ok(Array.from({length:99},(_,i)=>f.shape.getZ(i)>0?f.center.getX(i):0).some(x=>x>65));
 f.reset();f.render();assert.equal(f.mesh.visible,false);assert.equal(f.distance,0);assert.ok(f.shape.array.every(n=>n===0));
 assert.throws(()=>f.step(-1,1),RangeError);assert.throws(()=>new LabAirflowVisual(new THREE.Group(),{capacity:0}),RangeError);dispose(f);
});
