import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installPreciseLateAim,aimLateSurface} from '../src/game/LabLateCampaignAim.js';

const g=await createHeadlessGame();g.chamberEdition='foundation';
after(()=>{g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();});
const shots=[
 {name:'original full-campaign bypass ray',x:20,z:29,point:new THREE.Vector3(20,15.55,-27.6),loading:true},
 {name:'west archive centre',x:13,z:29,surface:'passage',offset:0},
 {name:'west archive upper edge',x:13,z:29,surface:'passage',offset:2.5},
 {name:'east archive centre',x:20,z:29,surface:'arrival',offset:0},
 {name:'east archive upper edge',x:20,z:29,surface:'arrival',offset:2.5},
];
for(const shot of shots)test('33 dry southern hall cannot place passenger portal: '+shot.name,async()=>{
 await g.selectLevel(32,false);const cargo=g.cargo,body=g.physics.cargoBody;
 const result=await runV8Journey(g,{scenario:d=>{
  installPreciseLateAim(d);
  if(shot.loading){d.walk(4,19);aimLateSurface(d,0,d.level.loading);}
  d.walk(shot.x,shot.z);
  const point=shot.point||d.level[shot.surface].getFrame().center.clone().add(new THREE.Vector3(0,shot.offset,0));
  d.look(point);assert.ok(g.firePortal(1));d.until(()=>!g.portalShots.queue.length&&!g.portalShots.active.length,3,'Actual archive shot resolution');
  assert.equal(g.portalShots.lastImpact?.valid,false);assert.equal(g.portals.portals[1],null);
  assert.equal(d.level.circuit.primed,false);assert.equal(d.level.circuit.height,0);assert.equal(d.level.circuit.delivered,0);assert.equal(g.teleportCount,0);assert.equal(g.state,'playing');
 }});
 assert.equal(result.resets+result.respawns,0);assert.equal(g.cargo,cargo);assert.equal(g.physics.cargoBody,body);
});
