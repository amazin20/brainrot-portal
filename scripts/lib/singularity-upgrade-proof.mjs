import assert from 'node:assert/strict';

export const UPGRADE_VERSION='v47-singularity-polish';
export function assertUpgradeInfo(info,expectedRooms=null){
 assert.match(info.commit,/^[a-f0-9]{40}$/);
 assert.equal(info.version,UPGRADE_VERSION);assert.equal(info.artVersion,UPGRADE_VERSION);assert.equal(info.levels,41);
 const tower=info.features.tower;
 assert.ok(Array.isArray(tower.rooms)&&tower.rooms.length>13,'Upgrade metadata must describe the additional rooms');
 assert.equal(tower.stages,tower.rooms.length);assert.equal(tower.uniqueRules,tower.stages);assert.equal(tower.checkpoints,false);
 assert.equal(new Set(tower.rooms.map(r=>r.id)).size,tower.stages);
 assert.equal(new Set(tower.rooms.map(r=>r.rule)).size,tower.stages);
 assert.equal(tower.independentHalls,tower.rooms.filter(r=>r.requires.length===0).length);
 for(const r of tower.rooms){assert.ok(r.id&&r.name&&r.rule);assert.ok(r.requires.every(id=>tower.rooms.some(room=>room.id===id)));}
 if(expectedRooms)assert.deepEqual(tower.rooms,expectedRooms.map(({id,name,rule,requires})=>({id,name,rule,requires:[...requires]})));
 assert.deepEqual(info.features.foundation.rooms,Array.from({length:41},(_,i)=>i+1));
 return tower;
}
export function assertUpgradeEvidence(e,info,{record=false}={}){
 const tower=assertUpgradeInfo(info),ids=tower.rooms.map(r=>r.id),rules=tower.rooms.map(r=>r.rule);
 assert.equal(e.sourceCommit,info.commit);assert.equal(e.version,info.version);assert.equal(e.result.pass,true);
 assert.equal(e.result.metrics.won,true);assert.equal(e.result.metrics.completedStages,tower.stages);
 assert.deepEqual([...e.result.metrics.solvedIds].sort(),[...ids].sort());
 assert.equal(e.observed.events.length,tower.stages);
 assert.deepEqual(e.observed.events.map(x=>x.id).sort(),[...ids].sort());
 assert.deepEqual(e.observed.events.map(x=>x.rule).sort(),[...rules].sort());
 for(const event of e.observed.events)assert.equal(event.rule,tower.rooms.find(r=>r.id===event.id).rule);
 assert.equal(e.result.resets+e.result.respawns+e.result.cargoResets,0);assert.equal(e.observed.seenResets,0);
 assert.equal(e.result.sameCompanion,true);assert.equal(e.result.metrics.checkpoints,false);
 assert.ok(e.result.activeSeconds>=900);assert.deepEqual(e.errors,[]);
 if(record){
  const v=e.video;assert.ok(v&&v.frames>0);assert.equal(v.fps,12);assert.equal(v.first.state,'playing');assert.deepEqual(v.first.solved,[]);
  assert.equal(v.last.state,'won');assert.deepEqual([...v.last.solved].sort(),[...ids].sort());
  assert.ok(v.durationSeconds>=900);assert.ok(Math.abs(v.durationSeconds-e.result.seconds)<=2/v.fps+1/120+.01,'Recording must remain at 1× simulation time');
 }
 return tower;
}
export function upgradePreviewPath(config){
 const target=config.previewPath||'tower-singularity';
 assert.match(target,/^[a-z0-9][a-z0-9-]*$/,'Preview must be one isolated directory');
 return target;
}
