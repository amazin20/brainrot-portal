import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
import {room14DeflectorContract,loadRoom14DeflectorFixture,assertRoom14DeflectorSnapshot,assertRoom14FieldOwnership,assertRoom14DeflectorGeometry,assertRoom14ProjectorSupport} from './helpers/lab-room14-deflector-contract.js';

let game,fixture;
before(async()=>{fixture=loadRoom14DeflectorFixture();game=await createHeadlessGame();Object.assign(game,{chamberEdition:'foundation',...ACTIVE_FOUNDATION_RUNTIME_FLAGS});await game.selectLevel(13,false);});
after(()=>{if(game)disposeLabLevel(game);});
test('replacement14 matches its complete explicit contract while historical golden values and approved fixture bytes remain unchanged',()=>{
 const old=readFileSync(new URL('./fixtures/early-art-v35-contract.json',import.meta.url)),mounts=readFileSync(new URL('./fixtures/second-chapter-mounts-contract.json',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(hash(old),fixture.legacy.approvedCurrentFixtureSha256);assert.equal(hash(mounts),fixture.legacy.historicalMountFixtureSha256);
 for(const row of JSON.parse(old).rooms)assert.equal(row.contract,fixture.legacy.originalRoomContractDigests[row.level],'Retain every historical room golden value');
 assert.deepEqual(JSON.parse(old).rooms.find(r=>r.level===14),fixture.legacy.room14);
 assertRoom14DeflectorSnapshot(room14DeflectorContract(game),fixture.current.contract);
});
test('replacement14 independently preserves thin-only portals, a true unsupported gap and separate physically glazed goal lanes',()=>{
 const geometry=assertRoom14DeflectorGeometry(game);assert.ok(geometry.gap>geometry.cargoSpaceDiagonal);assertRoom14FieldOwnership(game);assertRoom14ProjectorSupport(game);
});
test('replacement14 golden rejects extra supports, hidden/removed panes, wider apertures, altered frames and duplicate/stale physical owners',()=>{
 const baseline=room14DeflectorContract(game),glass=baseline.gameplay.colliders.findIndex(c=>c.mesh.name==='14 / freight observation window'),owned=baseline.physics.owners.findIndex(r=>r.owned);
 const poison=[
  s=>s.gameplay.floors.push({...s.gameplay.floors[0],mesh:'Unreviewed freight bypass plank',minX:-.7,maxX:1.8,minZ:-2.4,maxZ:-.8,y:0,enabled:true}),
  s=>s.gameplay.colliders[glass].mesh.visible=false,
  s=>s.gameplay.colliders[glass].enabled=false,
  s=>s.geometry.panelSizes['contact-turn'].width=.9,
  s=>s.gameplay.panels['contact-turn'].normal[0]+=.02,
  s=>s.physics.owners[owned].owned.oriented.current.center[0]+=.01,
  s=>s.physics.bodies.push(structuredClone(s.physics.bodies[s.physics.owners[owned].owned.body])),
  s=>s.physics.cargoSweepOrder.pop(),
  s=>s.gameplay.camera.push(structuredClone(s.gameplay.camera[0])),
  s=>s.physics.bodies[s.physics.cargoBody].mass=3.1,
  s=>s.physics.cargoShape.half[0]=.38,
 ];
 for(const mutate of poison){const changed=structuredClone(baseline);mutate(changed);assert.throws(()=>assertRoom14DeflectorSnapshot(changed,fixture.current.contract),assert.AssertionError);}
});
test('replacement14 live ownership rejects a disabled/shifted body, missing CCD and a duplicate static owner without filtering',()=>{
 const p=game.firstLevel.readability.field.owned.find(p=>p.collider.enabled),body=p.body,mask=body.collisionFilterMask,x=body.position.x,sweep=game.physics.cargoSweepBoxes.get(p.mesh.uuid);
 for(const [mutate,restore] of [
  [()=>body.collisionFilterMask=0,()=>body.collisionFilterMask=mask],
  [()=>body.position.x+=.01,()=>body.position.x=x],
  [()=>game.physics.cargoSweepBoxes.delete(p.mesh.uuid),()=>game.physics.cargoSweepBoxes.set(p.mesh.uuid,sweep)],
  [()=>game.physics.solids.set(p.mesh.uuid,{body}),()=>game.physics.solids.delete(p.mesh.uuid)],
 ]){try{mutate();assert.throws(()=>assertRoom14FieldOwnership(game),assert.AssertionError);}finally{restore();}}
 assertRoom14FieldOwnership(game);
});
