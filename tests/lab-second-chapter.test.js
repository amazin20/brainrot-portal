import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CounterweightBalance,SECOND_CHAPTER_SPECS} from '../src/game/LabSecondChapter.js';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
import {FOUNDATION_INDICES,foundationStorage,nextFoundationLevel} from '../src/game/LabFoundationEdition.js';
import {LabPreferences} from '../src/game/LabPreferences.js';
const make=async n=>{const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(n-1,false);return g;};
const V=(...p)=>new THREE.Vector3(...p);

test('one cable conserves travel; no unloaded or equal-load self-ascent',()=>{
 for(const loads of [[0,0],[1,1],[2,2]]){
  const b=new CounterweightBalance();b.braked=false;
  for(let i=0;i<600;i++){b.step(1/60,...loads);assert.equal(b.height,0);assert.equal(b.heights[0]+b.heights[1],8);}
 }
 const b=new CounterweightBalance();b.braked=false;
 for(let i=0;i<1800;i++){b.step(1/60,1,2);assert.equal(b.heights[0]+b.heights[1],8);}
 assert.equal(b.height,8);assert.equal(b.velocity,0);
 for(let i=0;i<1800;i++)b.step(1/60,3,0);
 assert.equal(b.height,0);assert.equal(b.velocity,0);
});
test('brake holds a partly raised cabin after removing or reversing the counterweight',()=>{
 const b=new CounterweightBalance();b.braked=false;for(let i=0;i<180;i++)b.step(1/60,1,2);
 assert.ok(b.height>0&&b.height<8);const y=b.height;
 b.braked=true;for(let i=0;i<240;i++)b.step(1/60,5,0);
 assert.equal(b.height,y);assert.equal(b.velocity,0);
 b.braked=false;for(let i=0;i<120;i++)b.step(1/60,5,0);assert.ok(b.height<y);
 b.reset();assert.deepEqual(b.heights,[0,8]);assert.equal(b.braked,true);
});
test('balance integration agrees at 30,60,120,240 Hz and rejects invalid data',()=>{
 const values=[30,60,120,240].map(hz=>{const b=new CounterweightBalance();b.braked=false;for(let i=0;i<hz*6;i++)b.step(1/hz,1,2);return b.height;});
 assert.ok(Math.max(...values)-Math.min(...values)<1e-9);
 for(const x of [0,-1,NaN,Infinity])assert.throws(()=>new CounterweightBalance(x),RangeError);
 for(const a of [[-1,0,0],[NaN,1,2],[1,-1,0],[1,0,Infinity]])assert.throws(()=>new CounterweightBalance().step(...a),RangeError);
});
for(const aspect of [16/9,9/16])for(const room of [6,7])for(const options of [{},{alternate:true},{recover:true}])test(`room ${room}: ${JSON.stringify(options)} at aspect ${aspect}`,async()=>{
 const g=await make(room),identity=g.cargo;g.camera.aspect=aspect;g.camera.updateProjectionMatrix();
 const r=await runV8Journey(g,{journeyOptions:options});
 assert.equal(r.pass,true);assert.equal(r.resets,0);assert.equal(r.respawns,0);assert.equal(r.level,room);assert.equal(g.cargo,identity);assert.equal(g.state,'won');
 if(room===6){assert.equal(g.firstLevel.balance.braked,true);assert.ok(g.firstLevel.cabins[0].position.y>7.9);}
 else assert.equal(g.firstLevel.stage.at(1),true);
});
test('the first-five save continues to six without overwriting either archive or old progress',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const classic=new LabPreferences(storage);classic.complete(32);const archive=new Map(data);
 const first=new LabPreferences(foundationStorage(storage));for(let i=0;i<5;i++)first.complete(i);
 const resumed=new LabPreferences(foundationStorage(storage));assert.deepEqual(resumed.value.completed,[0,1,2,3,4]);
 assert.equal(nextFoundationLevel(4),5);assert.equal(nextFoundationLevel(5),6);assert.equal(nextFoundationLevel(6),0);
 resumed.complete(5);resumed.complete(6);assert.deepEqual(resumed.value.completed,FOUNDATION_INDICES);
 for(const [k,v]of archive)assert.equal(data.get(k),v);
});
test('new rooms are enclosed; each portal has a role and all permanent deck widths remain at least eight metres',async()=>{
 for(const room of [6,7]){
  const g=await make(room),l=g.firstLevel,k=l.workshop;
  assert.equal(l.spec.id,SECOND_CHAPTER_SPECS[room-6].id);assert.ok(k.decks.every(d=>d.maxX-d.minX>=8&&d.maxZ-d.minZ>=8));
  assert.ok(g.colliders.some(c=>c.enabled&&c.box.min.y>=k.ceiling-.7&&c.box.max.x-c.box.min.x>=k.bounds.maxX-k.bounds.minX-2));
  for(const key of Object.keys(l.panels))assert.ok(l.puzzleGeometry.portalRoles[key],key);
  g.resetRun(true);for(let i=0;i<240;i++){g.updatePlaying(1/120);g.updateVisuals(1/120,1);}assert.notEqual(g.state,'won');
 }
});
test('both counterweight apertures accept ordinary slightly inaccurate height and lateral aim',async()=>{
 const g=await make(6),l=g.firstLevel;
 for(const c of l.cabins)for(const dy of [-.18,0,.18])for(const dx of [-.18,0,.18]){
  const f=c.panel.getFrame(),point=f.center.clone().addScaledVector(f.up,dy).addScaledVector(f.right,dx);
  const fit=resolvePortalPlacement(c.panel.mesh,point,{blockers:g.colliders});assert.equal(fit.ok,true,fit.reason);
 }
});
test('moving optical windows keep their actual frames, thickness and light collision aligned',async()=>{
 const g=await make(7),l=g.firstLevel,k=l.workshop;
 for(const target of [0,1,0]){
  l.stage.target=target;for(let i=0;i<600;i++)l.update(1/60);
  assert.equal(l.stage.at(target),true);
  const face=l.panels['light-shuttle'].getFrame(),walk=l.panels['travel-shuttle'].getFrame();
  assert.ok(Math.abs(walk.center.z-face.center.z-10)<1e-7);
  assert.ok(Math.abs(walk.center.y-face.center.y-1.6)<1e-7);
  for(const dy of [-.3,0,.3]){
   g.clearPortals();for(const [i,name]of ['light-source','light-shuttle'].entries()){
    const s=l.panels[name],f=s.getFrame();assert.equal(g.portals.placeOnPanel(i,s.mesh,f.center.clone().addScaledVector(f.up,dy),{blockers:g.colliders}).ok,true);
   }
   l.light.update();assert.ok(l.light.segments.length>1);const b=l.light.segments[1];assert.ok(b.a.y>5&&b.a.y<5.37);
   for(const p of l.light.pieces.filter(p=>p.floor.enabled)){
    p.mesh.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(p.mesh);assert.ok(bounds.equals(p.collider.box));assert.ok(Math.abs(bounds.max.y-p.floor.y)<1e-8);
   }
  }
 }
});

test('each cabin leaves four-metre end routes around its portal, not a narrow ledge',async()=>{
 const g=await make(6);
 for(const c of g.firstLevel.cabins){
  const f=c.panel.getFrame();
  assert.ok(c.floor.maxZ-(f.center.z+c.panel.width/2)>=4-1e-7);
  assert.ok((f.center.z-c.panel.width/2)-c.floor.minZ>=4-1e-7);
 }
});
test('run, jump and return on both directions of the closed service stair without reset',async()=>{
 const g=await make(7);let jumps=0,samples=0;
 const report=await runV8Journey(g,{scenario:d=>{
  d.walk(-21,24);
  for(const direction of [1,-1,1,-1]){
   for(let frame=0;frame<360;frame++){
    if(frame%45===0&&g.playerGrounded){g.input.jumpQueued=true;jumps++;}
    g.input.keys.add('ShiftLeft');d.worldMove(direction,Math.sin(frame*.08)*.05);d.frame();
    const p=g.playerPosition;assert.ok(p.y>=-.02);
    if(p.x>-14&&p.x<-4){const top=.25*(1+Math.floor((-4-p.x)/.5));assert.ok(p.y>=top-.26,`Under stairs at ${p.toArray()}`);samples++;}
    if(direction>0&&p.x>1||direction<0&&p.x<-20)break;
   }
   d.stop();d.wait(.6);
  }
  assert.ok(jumps>=8&&samples>50);assert.ok(g.playerPosition.y>=4.9);
 }});
 assert.equal(report.pass,true);assert.equal(report.teleports,0);assert.equal(report.resets,0);assert.equal(report.respawns,0);
});
