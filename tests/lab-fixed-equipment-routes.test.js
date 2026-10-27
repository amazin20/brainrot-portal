import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {runExpansion42} from '../src/game/LabExpansionJourneyA.js';
import {installPreciseLateAim} from '../src/game/LabLateCampaignAim.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
const views=[['wide',16/9],['portrait',390/844]];
function distance(p,b){return Math.hypot(Math.max(b.min.x-p.x,0,p.x-b.max.x),Math.max(b.min.z-p.z,0,p.z-b.max.z));}
async function observe(index,view,aspect,kind,scenario){
 const g=await createHeadlessGame();Object.assign(g,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});g.camera.aspect=aspect;g.camera.updateProjectionMatrix();await g.selectLevel(index,true);
 const original={cargo:g.cargo,group:g.cargo.group,body:g.physics.cargoBody,shape:g.physics.cargoBody.shapes[0]},row={index,id:g.firstLevel.id,view,kind,pass:false,physicsUpdates:0,samples:[]};
 const update=g.updatePlaying,reset=g.resetRun;let setupResets=0;
 g.resetRun=function(...a){setupResets++;return reset.apply(this,a);};
 g.updatePlaying=function(...a){assert.equal(g.cargo,original.cargo);assert.equal(g.cargo.group,original.group);assert.equal(g.physics.cargoBody,original.body);assert.equal(original.body.shapes[0],original.shape);row.physicsUpdates++;return update.apply(this,a);};
 try{
  row.route=await runV8Journey(g,{journeyOptions:index<40?{nativeStart:true}:{},scenario:scenario?d=>scenario(d,row):null});
  assert.equal(row.route.resets+row.route.respawns,0);assert.equal(setupResets,index<40?0:1,'Only the legacy pre-observation setup reset is permitted');
  if(!scenario){assert.equal(row.route.pass,true);assert.equal(g.state,'won');}else assert.equal(g.state,'playing');
  row.setupResets=setupResets;row.sameOriginal=true;row.finalPlayer=g.playerPosition.toArray();row.finalCargo=g.cargo.position.toArray();row.pass=true;
 }catch(e){row.failure=String(e.stack||e);throw e;}finally{
  g.updatePlaying=update;g.resetRun=reset;
  if(process.env.FIXED_MOUNT_REPORT)fs.appendFileSync(process.env.FIXED_MOUNT_REPORT,JSON.stringify(row)+'\n');disposeLabLevel(g);
 }
}
for(const [view,aspect]of views)for(const index of [10,41,42])test(`${index+1} ${view}: complete ordinary route with every original actor and all mounted obstacles`,async()=>observe(index,view,aspect,'ordinary'));
function rush(d,x,z,row,frames=240){
 const g=d.game;let highest=g.playerPosition.y,nearest=Infinity;
 for(let i=0;i<frames;i++){
  const dx=x-g.playerPosition.x,dz=z-g.playerPosition.z,len=Math.hypot(dx,dz)||1;d.worldMove(dx/len,dz/len);g.input.keys.add('ShiftLeft');if(i%29===0)g.input.jumpQueued=true;d.frame();highest=Math.max(highest,g.playerPosition.y);nearest=Math.min(nearest,Math.hypot(dx,dz));
  if(i%30===0)row.samples.push({player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),grounded:g.playerGrounded,held:!!g.heldCube});
 }
 d.stop();return{highest,nearest};
}
for(const [view,aspect]of views)for(const side of ['deck','recovery'])test(`launch ${side} ${view}: reached stand cannot become an unpowered shortcut`,async()=>observe(42,view,aspect,`attack-${side}`,async(d,row)=>{
 const g=d.game,l=d.level,shaft=g.colliders.find(c=>c.mesh.name===`Launch panel / ${side} standard shaft`),foot=g.colliders.find(c=>c.mesh.name===`Launch panel / ${side} standard foot`);assert.ok(shaft&&foot);
 if(side==='recovery'){d.walk(-9,25);d.walk(-5,25);d.until(()=>g.playerGrounded&&g.playerPosition.y<-3.8,5,'Actual recovery deck missed');d.walk(-5.2,14);}
 else d.walk(-13.5,17);
 d.walk(shaft.mesh.position.x-.58,shaft.mesh.position.z);d.wait(.3);
 assert.ok(distance(g.playerPosition,foot.box)<.44,'Attack must physically reach the new foot');assert.ok(g.playerPosition.y>=foot.box.max.y-.03,'Attack must stand on the real foot/collar');row.reachedFoot=true;
 const result=rush(d,shaft.mesh.position.x,shaft.mesh.position.z,row);assert.ok(result.highest<foot.box.min.y+3.1,'Stand became a staircase to the rim');row.rush=result;
 installPreciseLateAim(d);
 for(const target of [l.gallery,l.returned]){d.look(target.getFrame().center);assert.ok(g.firePortal(1));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Charge did not resolve');assert.notEqual(g.portals.portals[1]?.surfaceId,target.mesh.uuid,'Stand unlocked an upper address without the actual shutter puzzle');}
 assert.equal(l.button.loaded(),false);assert.equal(l.shutter.pressed,false);assert.equal(g.teleportCount,0);
}));
for(const [view,aspect]of views)test(`wind ${view}: grounded rear bus cannot bypass the unpowered exit`,async()=>observe(10,view,aspect,'attack-bus',async(d,row)=>{
 const g=d.game,l=d.level,bus=g.colliders.find(c=>c.mesh.name==='Wind test service bus / closed power casing'&&Math.abs(c.mesh.position.z+11.4)<1e-5);
 d.walk(-12.7,8);d.walk(-12.7,-10.4);d.walk(-11.6,-10.7);const a=rush(d,-11.6,-11.4,row);row.reachedBus=distance(g.playerPosition,bus.box)<.45;assert.equal(row.reachedBus,true,'Bus attack never reached its actual side');
 const b=rush(d,-11.6,-16,row,180);assert.ok(Math.max(a.highest,b.highest)<3);assert.ok(g.playerPosition.z>-12.3);assert.equal(l.state.ratchet.engaged,false);assert.equal(l.state.blower.enabled,false);assert.equal(g.teleportCount,0);
}));
for(const [view,aspect]of views)test(`pressure ${view}: jumps below the hanger cannot replace the original B valve`,async()=>observe(41,view,aspect,'attack-hanger-reach',async(d,row)=>{
 runExpansion42(d,{stopAfter:'positive'});const g=d.game,l=d.level;d.walk(g.cargo.position.x+1.3,g.cargo.position.z);d.pickup();d.walk(24,3);d.walk(30,3);d.walk(30,8);d.walk(30,32);d.walk(33,34);
 const result=rush(d,32.5,34.2,row);row.rush=result;row.hangerReached=false;
 assert.ok(result.highest+2.4<17.03,'Jump reaches the new suspended casing');assert.equal(l.pressure.coverB,0);assert.equal(l.pressure.right,0);assert.equal(g.heldCube,g.cargo);assert.equal(g.teleportCount,0);
}));
