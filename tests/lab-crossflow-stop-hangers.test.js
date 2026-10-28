import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {gameplayContract,digest} from './helpers/lab-art-contract.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';
const V=(...p)=>new THREE.Vector3(...p);
let g;before(async()=>{g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});});after(()=>disposeLabLevel(g));
function opaque(hit){
 for(let n=hit.object;n;n=n.parent)if(!n.visible)return false;
 const m=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
 return m?.visible!==false&&!m?.transparent&&!hit.object.userData.collisionProxy;
}
const bounds=m=>new THREE.Box3().setFromObject(m);
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-5,`${label}: ${a} != ${b}`);
function validate(){
 const layer=g.firstLevel.stopHangers;assert.equal(layer.parts.length,12);assert.equal(layer.castings.length,4);
 assert.equal(g.colliders.filter(c=>c.mesh.userData.crossflowStopHanger).length,12);
 for(const [i,c]of layer.castings.entries()){
  const first=i<2,cx=first?-12:12,z=first?8:-8,top=first?14:23.2,x=cx+(i%2===0?-2.45:2.45);
  assert.deepEqual(c.side,i%2===0?-1:1);
  const stop=bounds(c.stop);close(stop.max.y,top,'Unchanged stop top');
  close(stop.getSize(V()).x,5.5,'Unchanged stop width');close(stop.getSize(V()).y,.4,'Unchanged stop depth');
  for(const [role,m,sx,sz]of [['shoe',c.shoe,.44,.46],['tie',c.rod,.16,.20],['roof',c.plate,.44,.46]]){
   close(m.position.x,x,'Exact hanger X');close(m.position.z,z,'Exact hanger Z');
   assert.deepEqual(m.userData.crossflowStopHanger,{role,stop:first?0:1});
   assert.equal(m.visible,true);assert.equal(m.material.visible,true);assert.equal(m.material.transparent,false);
   for(let n=m;n;n=n.parent)assert.equal(n.visible,true);
   const b=bounds(m),size=b.getSize(V());close(size.x,sx,'Width');close(size.z,sz,'Depth');
   assert.ok(b.min.y>=top-.02001,'Added support enters the active ascent below its existing cap');
   const colliders=g.colliders.filter(c=>c.mesh===m);assert.equal(colliders.length,1);assert.equal(colliders[0].enabled,true);
   assert.ok(b.min.distanceTo(colliders[0].box.min)<1e-6&&b.max.distanceTo(colliders[0].box.max)<1e-6);
   for(const list of [g.aimBlockers,g.cameraBlockers])assert.equal(list.filter(n=>n===m).length,1);
   assert.equal(g.portalPanels.includes(m),false);
   const body=g.physics.solids.get(m.uuid)?.body;assert.ok(body);assert.equal(body.mass,0);assert.notEqual(body.collisionFilterMask,0);
   assert.ok(V(body.position.x,body.position.y,body.position.z).distanceTo(b.getCenter(V()))<1e-6);
   const h=body.shapes[0].halfExtents;assert.ok(V(h.x,h.y,h.z).distanceTo(size.multiplyScalar(.5))<1e-6);
  }
  assert.ok(bounds(c.shoe).intersectsBox(stop));assert.ok(bounds(c.shoe).intersectsBox(bounds(c.rod)));assert.ok(bounds(c.rod).intersectsBox(bounds(c.plate)));
 }
 return layer;
}
test('room26 only adds twelve exact closed hangers; every previous gameplay record is unchanged',async()=>{
 await g.selectLevel(25,true);const layer=validate(),names=new Set(layer.parts.map(m=>m.name)),contract=gameplayContract(g);
 assert.equal(names.size,12);
 for(const key of ['colliders','camera','aim'])contract[key]=contract[key].filter(row=>!names.has(row.mesh?.name??row.name));
 // Captured by independently executing the original e3a3a2f source before
 // installing this layer; b71e8dc changes tools only, not the game source.
 assert.equal(digest(contract),'b88397816986f592e29c8698ce0d78e082b02b74288a50ab3f6fd173e8c973f9');
});
test('all suspension shoes meet the finite stop faces and all roof plates meet actual visible roof triangles',async()=>{
 await g.selectLevel(25,true);const layer=validate(),ceiling=g.firstLevel.world.surfaces.find(s=>s.name==='Non-portal ceiling tiles');g.scene.updateMatrixWorld(true);
 for(const c of layer.castings){
  const shoe=bounds(c.shoe),plate=bounds(c.plate);
  for(const [dx,dz]of [[0,0],[-.20,-.21],[-.20,.21],[.20,-.21],[.20,.21]]){
   const owner=g.firstLevel.biosphereArt.mounts.find(owner=>owner.target===c.stop);assert.ok(owner);
   const down=new THREE.Raycaster(V(c.shoe.position.x+dx,shoe.max.y+.05,c.shoe.position.z+dz),V(0,-1,0),0,.3).intersectObject(g.firstLevel.biosphereArt,true).find(hit=>opaque(hit)&&owner.parts.some(part=>part.mesh===hit.object&&part.index===hit.instanceId));
   assert.ok(down);assert.ok(down.point.y>shoe.min.y&&down.point.y<shoe.max.y);
   const up=new THREE.Raycaster(V(c.plate.position.x+dx,25,c.plate.position.z+dz),V(0,1,0),0,.7).intersectObject(ceiling.group,true).find(opaque);
   assert.ok(up);assert.ok(up.point.y>plate.min.y&&up.point.y<plate.max.y,'Plate ends below a roof relief, or misses its tile');
  }
 }
});
test('hanger registries reject hidden, displaced, duplicated and nonphysical substitutes',async()=>{
 await g.selectLevel(25,true);const m=g.firstLevel.stopHangers.parts[0],body=g.physics.solids.get(m.uuid).body;
 m.visible=false;assert.throws(validate);m.visible=true;
 m.position.x+=.15;assert.throws(validate);m.position.x-=.15;m.updateWorldMatrix(true,false);
 const mask=body.collisionFilterMask;body.collisionFilterMask=0;assert.throws(validate);body.collisionFilterMask=mask;
 g.cameraBlockers.push(m);assert.throws(validate);g.cameraBlockers.pop();validate();
});
test('all new ties and plates are removed from physics and queries; each geometry disposes exactly once',async()=>{
 await g.selectLevel(25,true);const layer=validate(),counts=new Map(layer.parts.map(m=>[m.geometry,0]));
 for(const geometry of counts.keys())geometry.addEventListener('dispose',()=>counts.set(geometry,counts.get(geometry)+1));
 await g.selectLevel(0,true);
 for(const m of layer.parts){assert.ok(!g.colliders.some(c=>c.mesh===m));assert.ok(!g.aimBlockers.includes(m)&&!g.cameraBlockers.includes(m));assert.ok(!g.physics.solids.has(m.uuid));assert.equal(counts.get(m.geometry),1);}
});
for(const [view,aspect]of [['wide',16/9],['portrait',390/844]])for(const [name,options]of [['original',{}],['free-freight',{route:'air-freight'}],['recovery',{firstFall:true,reverse:true}]]){
 test(`room26 ${view} ${name}: ordinary original-actor route with all real hangers`,async()=>{
  g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(25,true);validate();
  const original={cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0]},update=g.updatePlaying,reset=g.resetRun;let steps=0,resets=0;
  g.resetRun=function(...a){resets++;return reset.apply(this,a);};
  g.updatePlaying=function(...a){assert.equal(g.cargo,original.cargo);assert.equal(g.cargo.group,original.group);assert.equal(g.physics.cargoBody,original.body);assert.equal(original.body.shapes[0],original.shape);steps++;return update.apply(this,a);};
  const row={view,name,options,pass:false};
  try{
   row.route=await runV8Journey(g,{journeyOptions:{...options,nativeStart:true}});assert.equal(row.route.pass,true);assert.equal(g.state,'won');assert.equal(resets+row.route.resets+row.route.respawns,0);
   row.steps=steps;row.originalActorPreserved=true;row.pass=true;
  }catch(e){row.failure=String(e.stack||e);throw e;}finally{
   g.updatePlaying=update;g.resetRun=reset;
   if(process.env.CROSSFLOW_HANGER_REPORT)fs.appendFileSync(process.env.CROSSFLOW_HANGER_REPORT,JSON.stringify(row)+'\n');
  }
 });
}
for(const [view,aspect]of [['wide',16/9],['portrait',390/844]])test(`room26 ${view}: live ascent and jump attempts still stop below the supported first plate`,async()=>{
 g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(25,true);validate();
 const cargo=g.cargo,body=g.physics.cargoBody,shape=body.shapes[0],row={view,kind:'first-stop-ascent-attempt',pass:false};
 try{
  row.route=await runV8Journey(g,{journeyOptions:{nativeStart:true},scenario:d=>{
   const p=d.level.panels;
   d.walk(g.cargo.position.x+1,g.cargo.position.z);d.pickup();d.walk(-17,23);d.look(p['valve-load'].getFrame().center.clone().add(V(0,2,0)));d.walk(-17,22);g.interact();d.wait(2);
   assert.ok(d.level.state.load.loaded());d.walk(-12,14);d.aim(1,p['first-shaft'].getFrame().center);d.walk(-12,-6);d.aim(0,p['pressure-intake'].getFrame().center);d.walk(-12,8);
   d.until(()=>g.playerPosition.y>10.6,12,'Actual powered shaft must be reached');
   let highest=g.playerPosition.y,undersideSteps=0;const samples=[];
   for(let i=0;i<300;i++){
    if(i%25===0)g.input.jumpQueued=true;
    // Steer toward each real attachment inside the original stop perimeter.
    const target=i<150?-14.45:-9.55,dx=target-g.playerPosition.x,dz=8-g.playerPosition.z,length=Math.hypot(dx,dz)||1;
    d.worldMove(dx/length*.35,dz/length*.35);d.frame();
    highest=Math.max(highest,g.playerPosition.y);
    if(Math.abs(g.playerPosition.y+2.4-13.6)<.08)undersideSteps++;
    assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);assert.equal(body.shapes[0],shape);
    if(i%30===0)samples.push(g.playerPosition.toArray());
   }d.stop();
   assert.ok(undersideSteps>0,'The attempt must actually reach the old stop underside');assert.ok(highest<11.3,'The new shoe/tie became a way through the existing stop');assert.equal(g.state,'playing');assert.ok(d.level.state.load.loaded());
   row.highest=highest;row.undersideSteps=undersideSteps;row.samples=samples;row.hangerReached=false;
  }});
  assert.equal(row.route.resets+row.route.respawns,0);row.pass=true;
 }catch(e){row.failure=String(e.stack||e);throw e;}finally{if(process.env.CROSSFLOW_HANGER_REPORT)fs.appendFileSync(process.env.CROSSFLOW_HANGER_REPORT,JSON.stringify(row)+'\n');}
});
