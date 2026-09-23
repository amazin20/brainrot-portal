import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {CAMPAIGN,campaignSpec} from '../src/game/LabCampaignLevels.js';
import {FOUNDATION_SPECS} from '../src/game/LabFoundationChambers.js';
import {FOUNDATION_INDICES,readFoundationEdition,nextFoundationLevel,foundationStorage} from '../src/game/LabFoundationEdition.js';
import {LabPreferences} from '../src/game/LabPreferences.js';
import {resolvePortalPlacement} from '../src/game/LabPortals.js';
const V=(...p)=>new THREE.Vector3(...p);
const make=async n=>{const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(n-1,false);return g;};

test('root starts a separate first chapter; explicit archives and later bookmarks keep their meaning',()=>{
 for(const q of ['', '?debug=1', '?edition=foundation'])assert.deepEqual(readFoundationEdition(q),{enabled:true,levelIndex:0});
 for(const n of [1,2,3,4,5])assert.deepEqual(readFoundationEdition('?level='+n),{enabled:true,levelIndex:n-1});
 for(const q of ['?edition=classic&level=1','?edition=open&level=31','?level=31','?mode=velocity'])assert.equal(readFoundationEdition(q).enabled,false);
 assert.deepEqual(FOUNDATION_INDICES.map(nextFoundationLevel),[1,2,3,4,0]);
 assert.equal(CAMPAIGN.length,33);assert.equal(new Set(FOUNDATION_SPECS.map(s=>s.id)).size,5);
 assert.ok(FOUNDATION_SPECS.every(s=>!CAMPAIGN.some(c=>s.id===c.id)));
});
test('new progression cannot inherit or overwrite archive solutions, hints or saves',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const old=new LabPreferences(storage);old.complete(0);old.complete(32);old.unlockHint(0);const before=new Map(data);
 const fresh=new LabPreferences(foundationStorage(storage));assert.deepEqual(fresh.value.completed,[]);assert.deepEqual(fresh.value.hints,{});
 fresh.complete(4);fresh.unlockHint(4);for(const [k,v] of before)assert.equal(data.get(k),v);
 assert.deepEqual(new LabPreferences(foundationStorage(storage)).value.completed,[4]);
 let writes=0;const denied=new LabPreferences(foundationStorage({getItem(){throw Error('blocked');},setItem(){writes++;}}));denied.complete(0);assert.equal(writes,0);
});
for(const aspect of [16/9,9/16])for(let n=1;n<=5;n++)test(`new room ${n}: real ordinary route at aspect ${aspect}`,async()=>{
 const g=await make(n);g.camera.aspect=aspect;g.camera.updateProjectionMatrix();const original=g.cargo;
 const report=await runV8Journey(g);assert.equal(report.pass,true);assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.equal(g.cargo,original);
 assert.equal(campaignSpec(g,n-1).id,FOUNDATION_SPECS[n-1].id);
});
for(let n=1;n<=5;n++)test(`new room ${n}: alternative exploration and return`,async()=>{
 const g=await make(n),report=await runV8Journey(g,{journeyOptions:{alternate:true}});
 assert.equal(report.pass,true);assert.equal(report.resets,0);assert.equal(report.respawns,0);
});
for(const n of [1,5])test(`new room ${n}: leave original companion, return and complete without reset`,async()=>{
 const g=await make(n),report=await runV8Journey(g,{journeyOptions:{recover:true}});
 assert.equal(report.pass,true);assert.equal(report.resets,0);assert.equal(report.respawns,0);
});
test('intro optical mounts tolerate inaccurate aim without a below-deck beam or an invisible bridge',async()=>{
 for(const n of [2,5]){
  const g=await make(n),l=g.firstLevel,base=n===2?3:6;
  // The smaller physical ceramic mount bounds the aperture by the EXISTING
  // general fit rule; no centre assignment, target-ID unlock or ray exception.
  for(const sy of [-.4,0,.4])for(const dy of [-.4,0,.4])for(const dx of [-.35,.35]){
   g.clearPortals();
   for(const [i,name,offset]of [[0,'light-source',sy],[1,'light-exit',dy]]){
    const s=l.panels[name],f=s.getFrame(),point=f.center.clone().addScaledVector(f.up,offset).addScaledVector(f.right,dx);
    const fit=resolvePortalPlacement(s.mesh,point,{blockers:g.colliders});assert.equal(fit.ok,true,`${n} ${name}: ${fit.reason}`);
    assert.equal(g.portals.placeOnPanel(i,s.mesh,point,{blockers:g.colliders}).ok,true);
   }
   l.light.update();const routed=l.light.segments[1];assert.ok(routed&&routed.length>30,`room ${n}: beam stopped at chassis`);
   assert.ok(routed.a.y>base+.02&&routed.a.y<base+.37,`room ${n}: inaccessible optical height ${routed.a.y}`);
   for(const p of l.light.pieces.filter(p=>p.floor.enabled)){
    p.mesh.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(p.mesh);
    assert.ok(b.equals(p.collider.box));assert.ok(Math.abs(b.max.y-p.floor.y)<1e-8);
   }
  }
 }
});
test('teaching responds to controls and carrying; no tutorial or elapsed-time victory requirement',async()=>{
 const g=await make(1);g.state='playing';assert.equal(g.tutorial.update().id,'foundation-move');
 g.playerPosition.x+=2;assert.notEqual(g.tutorial.update().id,'foundation-move');
 // Fixture setup verifies text only. The movement tests above do not stage actors.
 g.heldCube=true;assert.match(g.tutorial.update().text,/Через связанную пару/);g.heldCube=false;
 g.tutorial.enabled=false;const report=await runV8Journey(g);assert.equal(report.pass,true);
});
test('levels have physical roofs and side enclosures, wide decks, and no idle auto-completion',async()=>{
 for(let n=1;n<=5;n++){
  const g=await make(n),l=g.firstLevel,k=l.workshop;
  assert.equal(l.foundationChamber,true);assert.equal(l.researchChamber,false);assert.equal(l.puzzleGeometry.noProgressFlags,true);
  assert.ok(g.colliders.some(c=>c.enabled&&c.box.min.y>=k.ceiling-.7&&c.box.max.x-c.box.min.x>=k.bounds.maxX-k.bounds.minX-2));
  assert.ok(k.decks.every(d=>d.maxX-d.minX>=8&&d.maxZ-d.minZ>=8));
  for(const name of Object.keys(l.panels))assert.ok(l.puzzleGeometry.portalRoles[name],name);
  g.resetRun(true);const initial=g.playerPosition.clone();for(let f=0;f<120;f++){g.updatePlaying(1/120);g.updatePlaying(1/120);g.updateVisuals(1/60,1);}
  assert.notEqual(g.state,'won');assert.ok(g.playerPosition.distanceTo(initial)<1);
 }
});
