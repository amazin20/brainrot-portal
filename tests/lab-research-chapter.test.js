import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {CAMPAIGN,campaignSpec} from '../src/game/LabCampaignLevels.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {RESEARCH_SPECS,StoredMotionDrive} from '../src/game/LabResearchChambers.js';
let shared;
async function room(n){shared??=await createHeadlessGame();shared.chamberEdition='open';await shared.selectLevel(n-1,false);return shared;}
for(const [n,options,aspect] of [[31,{},16/9],[31,{route:'scout-first',recover:true},16/10],[32,{},16/9],[32,{recover:true},16/9],[32,{route:'stored-energy'},16/10],[32,{route:'stored-energy'},16/9],[33,{},16/9],[33,{recover:true},16/10]]){
 test(`research ${n}: ordinary inputs, original companion, options ${JSON.stringify(options)} at ${aspect}`,async()=>{
  const g=await room(n);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();
  const r=await runV8Journey(g,{journeyOptions:options});
  assert.equal(r.pass,true);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(g.state,'won');
  assert.equal(r.id,RESEARCH_SPECS[n-31].id);assert.equal(r.teleports,n===33?2:n===32&&options.route==='stored-energy'?1:0);
  if(n===32&&options.route==='stored-energy'){assert.equal(g.portals.ready,false);assert.ok(g.firstLevel.drive.wheel.omega>0);}
 });
}
test('new chapter keeps old indices, appends distinct real builders, and is available from both editions',async()=>{
 assert.equal(CAMPAIGN.length,33);assert.equal(new Set(CAMPAIGN.map(s=>s.id)).size,33);
 assert.deepEqual(CAMPAIGN.slice(30).map(s=>s.id),RESEARCH_SPECS.map(s=>s.id));
 for(const n of [31,32,33]){const g=await room(n),l=g.firstLevel;
  assert.equal(l.researchChamber,true);assert.equal(l.portalPuzzle,true);assert.equal(l.isWon(),false);
  assert.equal(campaignSpec(g,n-1).id,l.id);assert.equal(l.puzzleGeometry.noProgressFlags,true);
  for(const d of l.clearance.decks){assert.ok(d.maxX-d.minX>=8,d.name);assert.ok(d.maxZ-d.minZ>=8,d.name);}
  for(const r of g.ramps)assert.ok(r.maxX-r.minX>=8);
  const roof={31:20,32:23,33:31}[n];
  assert.ok(g.colliders.some(c=>c.enabled&&Math.abs(c.box.min.y-roof)<.02&&c.box.max.x-c.box.min.x>50&&c.box.max.z-c.box.min.z>45),'Missing full solid roof');
  g.chamberEdition='classic';await g.selectLevel(n-1,false);assert.equal(g.firstLevel.id,l.id);
 }
});
test('unpowered empty drive cannot create energy or lift a cabin; cut power dissipates stored energy',()=>{
 const d=new StoredMotionDrive();for(let n=0;n<1200;n++)d.step(1/120,false);
 assert.deepEqual(d.heights,[0,6]);assert.equal(d.wheel.energy,0);
 for(let n=0;n<1200;n++)d.step(1/120,true,false);
 const energy=d.wheel.energy;assert.ok(energy>100);assert.deepEqual(d.heights,[0,6]);
 for(let n=0;n<600;n++)d.step(1/120,false,true);
 assert.ok(d.heights[0]>0&&d.heights[0]<=6);assert.ok(d.wheel.energy<energy);
 const held=d.heights[0];d.gear=1;for(let n=0;n<120;n++)d.step(1/120,false,false);assert.equal(d.heights[0],held);
 d.reset();assert.deepEqual(d.heights,[0,6]);assert.equal(d.wheel.omega,0);
 for(const dt of [-.1,NaN,Infinity])assert.throws(()=>d.step(dt,true),RangeError);
});
test('rotor energy integration agrees across frame steps when no load is coupled',()=>{
 const states=[30,60,120,240].map(hz=>{const d=new StoredMotionDrive();for(let i=0;i<hz*8;i++)d.step(1/hz,true,false);for(let i=0;i<hz*4;i++)d.step(1/hz,false,false);return d.wheel;});
 for(const w of states){assert.ok(Math.abs(w.omega-states[0].omega)<1e-9);assert.ok(Math.abs(w.energy-states[0].energy)<1e-7);}
});
test('the light bridge has no invisible active floor when the source is unconnected',async()=>{
 const g=await room(31);g.state='playing';g.clearPortals();g.firstLevel.light.update();
 assert.equal(g.firstLevel.light.segments.length,1);
 for(const p of g.firstLevel.light.pieces){assert.equal(p.mesh.visible,p.collider.enabled);if(!p.mesh.visible)assert.equal(p.floor.enabled,false);}
 const source=g.firstLevel.light.segments[0];assert.ok(source.b.x< -15,'Unconnected source crossed its wall');
});
test('wrong orientation or no portal pair cannot secretly power the turbine',async()=>{
 const g=await room(32);g.state='playing';for(let i=0;i<180;i++)g.updatePlaying(1/120);
 assert.equal(g.firstLevel.drive.flow,false);assert.equal(g.firstLevel.drive.wheel.omega,0);
 assert.deepEqual(g.firstLevel.drive.heights,[0,6]);
});
test('final chamber has a physical low service opening without removing the high sight-line occluder',async()=>{
 const g=await room(33),ray=new THREE.Raycaster(new THREE.Vector3(0,1.2,20),new THREE.Vector3(1,0,0),0,9);
 g.scene.updateMatrixWorld(true);
 assert.equal(ray.intersectObjects(g.aimBlockers,true).filter(h=>g.isActiveBlocker(h.object)).length,0);
 ray.set(new THREE.Vector3(0,8,10),new THREE.Vector3(1,0,0));assert.ok(ray.intersectObjects(g.aimBlockers,true).some(h=>g.isActiveBlocker(h.object)&&h.distance<9));
});

test('service portal accepts modest aim error without its lower rim entering the physical floor',async()=>{
 const g=await room(32),surface=g.firstLevel.panels['service-return'],frame=surface.getFrame();
 for(const x of [-.2,0,.2])for(const y of [-.2,-.002,0,.2]){
  const placement=resolvePortalPlacement(surface.mesh,frame.center.clone().add(new THREE.Vector3(x,y,0)),{blockers:g.colliders});
  assert.equal(placement.ok,true,`Aim offset ${x}/${y}: ${placement.reason}`);
  assert.ok(placement.position.y-placement.frame.height>0);
 }
});
