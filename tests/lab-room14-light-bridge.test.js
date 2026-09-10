import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom14} from '../src/game/LabRoom14Journey.js';

for(const [aspect,order] of [[16/9,'cargo-first'],[1.6,'cargo-first'],[16/9,'scout-first'],[1.6,'scout-first']])test(`room14 ${order} works through real portal shots at aspect ${aspect}`,async()=>{
 const g=await createHeadlessGame();await g.selectLevel(13,false);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();
 try{
  const r=await runV8Journey(g,{scenario:d=>runRoom14(d,{order})});
  assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(g.state,'won');
  assert.ok(r.milestones.some(m=>m.name==='independent upper delivery'&&m.cargo[1]>12));
  assert.ok(g.physics.portalTransports>0,'The original free cargo crossed a portal');
 }finally{g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();}
});

test('rerouting light removes the old player floor and Cannon body, vertical light remains solid',async()=>{
 const g=await createHeadlessGame();await g.selectLevel(13,false);const l=g.firstLevel,b=l.state.lightBridge;
 const place=(i,name)=>assert.equal(g.placeOnPanel(i,l.panels[name].mesh,l.panels[name].getFrame().center),true);
 try{
  place(0,'light-source');place(1,'weave-west');b.update();
  const old=b.pieces[1];assert.equal(old.floor.enabled,true);assert.equal(old.collider.enabled,true);
  assert.ok(g.floorHeight(-8,0,10)>7);assert.ok(g.physics.solids.get(old.mesh.uuid).body.collisionFilterMask);
  place(1,'return-floor');b.update();
  assert.equal(b.pieces[1].floor.enabled,false);assert.equal(b.pieces[1].collider.enabled,true);
  assert.equal(g.floorHeight(-8,0,10),0,'No stale floor survives across the lower crossing');
  g.portals.clear();b.update();assert.equal(old.floor.enabled,false);assert.equal(old.collider.enabled,false);
  assert.equal(g.physics.solids.get(old.mesh.uuid).body.collisionFilterMask,0);
 }finally{l.dispose();g.physics.dispose();g.portals.dispose();}
});

test('diagonal floor-portal twist leaves empty corners outside the visible light curtain',async()=>{
 const g=await createHeadlessGame();await g.selectLevel(13,false);const l=g.firstLevel,b=l.state.lightBridge;
 try{
  assert.ok(g.placeOnPanel(0,l.panels['light-source'].mesh,l.panels['light-source'].getFrame().center));
  g.yaw=Math.PI/4;assert.ok(g.placeOnPanel(1,l.panels['return-floor'].mesh,l.panels['return-floor'].getFrame().center));b.update();
  const curtain=b.pieces.filter(p=>p.collider.enabled&&!p.floor.enabled);
  assert.equal(curtain.length,12,'The diagonal sheet is subdivided instead of a filled bounding rectangle');
  for(const p of curtain){assert.ok(p.mesh.visible);assert.equal(g.physics.solids.get(p.mesh.uuid).body.collisionFilterMask>0,true);}
  const minX=Math.min(...curtain.map(p=>p.collider.box.min.x)),maxX=Math.max(...curtain.map(p=>p.collider.box.max.x));
  const minZ=Math.min(...curtain.map(p=>p.collider.box.min.z)),maxZ=Math.max(...curtain.map(p=>p.collider.box.max.z));
  const y=(curtain[0].collider.box.min.y+curtain[0].collider.box.max.y)/2;
  const corners=[[minX+.015,minZ+.015],[maxX-.015,minZ+.015],[minX+.015,maxZ-.015],[maxX-.015,maxZ-.015]];
  assert.ok(corners.filter(([x,z])=>!curtain.some(p=>x>=p.collider.box.min.x&&x<=p.collider.box.max.x&&z>=p.collider.box.min.z&&z<=p.collider.box.max.z&&y>=p.collider.box.min.y&&y<=p.collider.box.max.y)).length>=2,'Empty diagonal corners are passable');
  let updates=0;const original=g.physics.updateStaticBox;g.physics.updateStaticBox=function(...args){updates++;return original.apply(this,args);};b.update();assert.equal(updates,0,'Unchanged light does not reshape cargo bodies each frame');
  g.physics.updateStaticBox=original;
 }finally{l.dispose();g.physics.dispose();g.portals.dispose();}
});
