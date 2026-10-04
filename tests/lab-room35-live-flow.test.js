import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';

async function room(){const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(34,false);return g;}
function close(g){g.physics.dispose();g.portals.dispose();}
function first(d,latch=false){
 const l=d.level,p=l.panels;d.walk(0,21);aimLateSurface(d,0,p['air-origin']);aimLateSurface(d,1,p['first-receiver']);
 d.until(()=>l.powered()[0]&&l.first.progress>.94,5,'First actual airflow');d.walk(0,11);d.walk(0,0);
 if(latch){d.walk(-6,1.3);assert.ok(d.game.interact());assert.ok(l.isFirstLatched());}
}
function second(d,latch=false){
 aimLateSurface(d,1,d.level.panels['second-receiver']);d.until(()=>d.level.powered()[1]&&d.level.second.progress>.94,5,'Second actual airflow');
 if(latch){d.walk(6,-5.1);assert.ok(d.game.interact());assert.ok(d.level.isLatched());}
}
function visitBay(d){for(const [x,z]of [[0,-5],[0,-12],[8,-12],[8,-24.4],[d.level.bay.aim[0],d.level.bay.aim[2]]])d.walk(x,z);}
function leaveBay(d){for(const [x,z]of [[8,-24.4],[8,-12],[0,-12],[0,-5],[0,0]])d.walk(x,z);}
function push(d,x,z,seconds=6){for(let n=0;n<seconds*60;n++){
 const dx=x-d.game.playerPosition.x,dz=z-d.game.playerPosition.z,len=Math.hypot(dx,dz)||1;
 d.worldMove(dx/len,dz/len);d.game.input.keys.add('ShiftLeft');if(n%45===0)d.game.input.jumpQueued=true;d.frame();
}d.stop();}
function rawShot(d,slot,surface){d.look(surface.getFrame().center);assert.ok(d.game.firePortal(slot),'The negative attack must really fire');d.until(()=>!d.game.portalShots.queue.length&&!d.game.portalShots.active.length,3,'Real negative shot flight');return d.game.portalShots.lastImpact;}
function dispatch(d){
 d.walk(0,0);aimLateSurface(d,1,d.level.panels['center-return']);visitBay(d);
 const count=d.game.physics.portalTransports;aimLateSurface(d,0,d.level.panels['companion-address']);
 d.until(()=>d.game.physics.portalTransports>count&&d.game.physics.grounded&&d.game.cargo.position.z>-7,8,'Real free cargo dispatch');
}

for(const route of ['latches-before-freight','scout-before-second-latch'])for(const aspect of [16/9,1.6,390/844,844/390])test(`35: ${route}, aspect ${aspect.toFixed(3)} uses both physical latches and the original free cargo`,async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody,seen=[];g.camera.aspect=aspect;g.camera.updateProjectionMatrix();
 try{
  const report=await runV8Journey(g,{journeyOptions:{route},onMilestone:m=>seen.push({name:m.name,powered:g.firstLevel.powered(),first:g.firstLevel.isFirstLatched(),second:g.firstLevel.isLatched(),transports:g.physics.portalTransports,held:!!g.heldCube})});
  assert.ok(report.pass);assert.equal(g.state,'won');assert.equal(report.resets+report.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
  assert.ok(g.firstLevel.isFirstLatched()&&g.firstLevel.isLatched());assert.equal(g.physics.portalTransports,1);assert.equal(g.teleportCount,0);
  const freight=seen.find(s=>s.name.includes('original free companion leaves'));assert.ok(freight);assert.ok(freight.first&&freight.second);assert.equal(freight.transports,1);assert.equal(freight.held,false);assert.deepEqual(freight.powered,[false,false]);
  assert.equal(g.portals.portals[0].surfaceId,g.firstLevel.dispatch.surface.mesh.uuid);assert.equal(g.portals.portals[1].surfaceId,g.firstLevel.returnMouth.mesh.uuid);
  assert.equal(g.firstLevel.goal.position.z,19);assert.ok(g.heldCube);
  g.resetRun(true);assert.equal(g.physics.cargoBody,body);assert.equal(g.cargo,cargo);assert.equal(g.firstLevel.isFirstLatched(),false);assert.equal(g.firstLevel.isLatched(),false);assert.equal(g.cargo.position.z,-20);assert.equal(g.portals.ready,false);
 }finally{close(g);}
});

test('35: cargo returned through its real aperture cannot cross the first door without its first latch',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;
 try{const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);first(d,false);second(d,true);dispatch(d);leaveBay(d);
  const c=g.cargo.position;d.walk(c.x+1.25,c.z);assert.ok(g.interact()&&g.heldCube);d.wait(.5);d.walk(0,0);push(d,0,19,8);
  assert.equal(g.firstLevel.isFirstLatched(),false);assert.ok(g.firstLevel.isLatched());assert.ok(g.firstLevel.first.progress<.02);assert.ok(g.playerPosition.z<8.6);assert.equal(g.state,'playing');assert.equal(g.physics.portalTransports,1);
 }});assert.equal(r.resets+r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);}finally{close(g);}
});

test('35: the old live-flow carry route cannot collect cargo or return from the far bay without its second latch',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;
 try{const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);first(d,true);second(d,false);visitBay(d);push(d,0,-20,4);
  assert.equal(g.interact(),false);assert.equal(g.heldCube,null);assert.ok(g.cargo.position.z<-16);assert.equal(g.physics.portalTransports,0);
  d.walk(d.level.bay.aim[0],d.level.bay.aim[2]);aimLateSurface(d,0,d.level.panels['companion-address']);d.wait(2);
  assert.equal(g.physics.portalTransports,0,'The air grille must not accept the original rigid cargo');assert.equal(g.firstLevel.isFirstLatched(),true);assert.equal(g.firstLevel.isLatched(),false);
  d.walk(8,-24.4);d.walk(8,-12);d.walk(0,-12);push(d,0,0,8);
  assert.ok(g.firstLevel.second.progress<.02);assert.ok(g.playerPosition.z<-7.4);assert.equal(g.state,'playing');
 }});assert.equal(r.resets+r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);}finally{close(g);}
});

test('35: the original cargo cannot use the entry air-source grille as a direct entry delivery',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;
 try{const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);first(d,true);second(d,true);visitBay(d);
  aimLateSurface(d,1,d.level.panels['companion-address']);d.wait(3);
  assert.equal(g.portals.portals[0].surfaceId,d.level.panels['air-origin'].mesh.uuid);assert.equal(g.portals.portals[1].surfaceId,d.level.dispatch.surface.mesh.uuid);
  assert.equal(g.physics.portalTransports,0);assert.ok(g.cargo.position.z<-16);assert.equal(g.state,'playing');assert.equal(g.heldCube,null);
 }});assert.equal(r.resets+r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);}finally{close(g);}
});

test('35: middle shots cannot see the sealed cargo floor or the entry-facing first grille',async()=>{
 const g=await room();try{const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);first(d,true);second(d,true);d.walk(0,0);assert.ok(g.firstLevel.second.progress>.94);
  assert.equal(rawShot(d,0,d.level.panels['companion-address']).valid,false);
  assert.equal(rawShot(d,1,d.level.panels['first-receiver']).valid,false);
  assert.equal(g.physics.portalTransports,0);assert.equal(g.state,'playing');assert.ok(g.cargo.position.z<-16);
 }});assert.equal(r.resets+r.respawns,0);}finally{close(g);}
});

test('35: rushing through the second door after borrowing its live pair cannot replace its mechanical latch',async()=>{
 const g=await room(),cargo=g.cargo,body=g.physics.cargoBody;
 try{const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);first(d,true);second(d,false);d.walk(0,0);aimLateSurface(d,1,d.level.panels['center-return']);
  push(d,0,-12,7);
  if(g.playerPosition.z<-7.4){
   for(const [x,z]of [[0,-12],[8,-12],[8,-24.4],[d.level.bay.aim[0],d.level.bay.aim[2]]])d.walk(x,z);
   aimLateSurface(d,0,d.level.panels['companion-address']);d.until(()=>g.physics.portalTransports===1&&g.physics.grounded,8,'Actual rushed free cargo dispatch');
   d.walk(8,-24.4);d.walk(8,-12);d.walk(0,-12);push(d,0,0,8);assert.ok(g.playerPosition.z<-7.4);
  }else{assert.ok(g.playerPosition.z>-6.6);assert.equal(g.physics.portalTransports,0);}
  assert.ok(g.firstLevel.isFirstLatched());assert.equal(g.firstLevel.isLatched(),false);assert.ok(g.firstLevel.second.progress<.02);assert.equal(g.state,'playing');
 }});assert.equal(r.resets+r.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);}finally{close(g);}
});

test('35: native body and pickup attacks at every actual inspection slot leave the original cargo sealed',async()=>{
 const g=await room();try{const r=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);first(d,true);second(d,true);visitBay(d);
  for(const slit of d.level.bay.slits){const x=(slit.x0+slit.x1)/2;d.walk(x,-24.4);push(d,x,-20,1.4);d.wait(.65);assert.ok(g.playerPosition.z<d.level.bay.z0,`Slot ${x}: actual capsule centre ${g.playerPosition.toArray()}`);assert.equal(g.interact(),false);assert.equal(g.heldCube,null);d.walk(x,-24.4);}
  assert.ok(g.cargo.position.z<-16);assert.equal(g.physics.portalTransports,0);assert.equal(g.state,'playing');
 }});assert.equal(r.resets+r.respawns,0);}finally{close(g);}
});

test('35: either perimeter and its real lower chassis ledge remain cut off by the closed bulkheads',async()=>{
 for(const side of [-1,1]){const g=await room();try{const r=await runV8Journey(g,{scenario:d=>{
  d.walk(side*23.2,19);d.walk(side*24.9,19);d.wait(.8);assert.ok(g.playerPosition.y<-.5,`The actor really descends to the outer chassis ledge: ${g.playerPosition.toArray()}`);
  push(d,side*24.9,-24,7);assert.ok(g.playerPosition.z>9.3);assert.equal(g.state,'playing');assert.equal(g.physics.portalTransports,0);assert.equal(g.heldCube,null);
 }});assert.equal(r.resets+r.respawns,0);}finally{close(g);}}
});
