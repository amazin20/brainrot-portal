import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {runRoom25} from '../src/game/LabRoom25Journey.js';
const g=await createHeadlessGame();after(()=>{g.physics.dispose();g.portals.dispose();});
for(const options of [{order:'weight-first',aspect:16/9},{order:'weight-first',aspect:1.6},{order:'light-first',interruptLight:true,aspect:1.6}])test(`room25 optical shutters preserve the original friend: ${JSON.stringify(options)}`,async()=>{
 await g.selectLevel(24,false);g.camera.aspect=options.aspect;g.camera.updateProjectionMatrix();const body=g.physics.cargoBody;let loaded=false,retrieved=false;
 const r=await runV8Journey(g,{scenario:d=>runRoom25({...d,mark(name){
  const o=d.level.state.optical;
  if(name==='one weight moves two opposite shadows'){loaded=true;assert.equal(o.loaded,true);assert.ok(o.travel>.8);}
  if(name==='permanent gallery keeps height after losing light'){assert.equal(o.receivers[0],true);assert.equal(o.receivers[1],false);}
  if(name==='cargo retrieval opens the other beam'){retrieved=true;assert.equal(o.loaded,false);assert.ok(o.travel<.1);assert.ok(g.cargo.position.y>9);}
  if(name==='reverse overlook reveals the starting room'){assert.equal(o.receivers[1],true);assert.equal(o.receivers[0],false);assert.ok(g.playerPosition.y>17.9);}
  d.mark(name);
 }},options)});
 assert.ok(loaded&&retrieved);assert.equal(g.state,'won');assert.equal(r.resets+r.respawns,0);assert.equal(g.physics.cargoBody,body);assert.ok(g.heldCube);assert.equal(r.teleports,1);
});
test('room25 an unweighted physical shutter blocks the actual source and leaves the first lift down',async()=>{
 await g.selectLevel(24,false);
 await runV8Journey(g,{scenario:d=>{
  const p=d.level.panels;d.walk(-7,6);d.walk(17,6);d.walk(17,12);d.aim(0,p['light-intake'].getFrame().center);
  d.walk(17,6);d.walk(-20,6);d.walk(-20,-10);d.walk(-14,-10);d.walk(-15.2,-10.7);d.aim(1,p['lower-relay'].getFrame().center);d.wait(5);
  const o=d.level.state.optical;assert.equal(o.loaded,false);assert.deepEqual(o.receivers,[false,false]);assert.ok(o.segments.some(s=>s.kind==='portal'));assert.ok(o.segments.at(-1).b.x<-10.7);assert.ok(g.playerPosition.y<.1);assert.equal(g.state,'playing');
 }});
});
test('room25 shutter render and collision positions agree after repeated reset and fixed updates',()=>{
 for(let n=0;n<4;n++){g.resetRun(true);for(let i=0;i<60;i++)g.updatePlaying(1/120);for(const b of g.firstLevel.state.optical.blades)assert.ok(b.collider.box.equals(new THREE.Box3().setFromObject(b.mesh)));assert.equal(g.firstLevel.state.optical.travel,0);}
});
test('room25 west hall keeps its enamel finish without rendering the million-triangle source wall through portals',async()=>{
 await g.selectLevel(24,false);const w=g.firstLevel.world;
 const west=w.surfaces.find(s=>!s.portal&&s.getFrame().normal.x>.9&&Math.abs(s.getFrame().center.x+22)<.1);
 assert.ok(west);
 assert.ok(west.group.children.some(n=>n.isInstancedMesh&&!n.userData.portalTile&&!n.visible),
  'The source wall tiles should be replaced by the premium cassette');
 const ribs=w.root.getObjectByName('West hall wall / physical machine ribs');
 assert.ok(ribs?.children.some(n=>n.isMesh&&n.material.color.getHex()===0x547280),
  'The actual west wall still needs the coloured enamel bays');
 assert.ok(g.firstLevel.workshop.solidModels.some(binding=>binding.model===ribs&&binding.colliders.length>0),
  'Its projecting machine ribs still need physical collision');
 let sceneTriangles=0;w.root.traverse(n=>{
  if(n.isMesh&&n.visible)sceneTriangles+=(n.geometry.index?.count??n.geometry.attributes.position?.count??0)/3*(n.count??1);
 });
 assert.ok(sceneTriangles<700000,`Room25 source art is still too dense for repeated portal views: ${sceneTriangles}`);
});
