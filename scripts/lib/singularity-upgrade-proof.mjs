import assert from 'node:assert/strict';

export const UPGRADE_VERSION='v49-manufactured-light';
export const CAPTURE_FRAME_RATES=Object.freeze([4,6,12]);
export function captureFormat({fps=12,width=960,height=540}={}){
 assert.ok(CAPTURE_FRAME_RATES.includes(fps),'Capture FPS must be 4, 6 or 12');
 for(const [name,value]of Object.entries({width,height}))assert.ok(Number.isInteger(value)&&value>=2&&value%2===0,`Capture ${name} must be a positive even integer`);
 return {fps,width,height,stride:60/fps,durationToleranceSeconds:2/fps+1/120+.01};
}
export function assertUpgradeInfo(info,expectedRooms=null){
 assert.match(info.commit,/^[a-f0-9]{40}$/);
 assert.equal(info.version,UPGRADE_VERSION);assert.equal(info.artVersion,UPGRADE_VERSION);assert.equal(info.levels,41);
 const tower=info.features.tower;
 assert.ok(Array.isArray(tower.rooms)&&tower.rooms.length>=10,'Metadata must describe the rebuilt castle mechanisms');
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
 assert.ok(Number.isFinite(e.result.activeSeconds)&&e.result.activeSeconds>0);assert.deepEqual(e.errors,[]);
 if(record){
  const v=e.video;assert.ok(v&&Number.isInteger(v.frames)&&v.frames>0);
  assert.ok(Number.isFinite(v.fps)&&Number.isInteger(v.width)&&Number.isInteger(v.height),'Recording must declare its FPS and dimensions');const format=captureFormat(v);
  assert.equal(v.first.state,'playing');assert.deepEqual(v.first.solved,[]);
  assert.equal(v.last.state,'won');assert.deepEqual([...v.last.solved].sort(),[...ids].sort());
  assert.ok(Number.isFinite(v.durationSeconds)&&v.durationSeconds>0);assert.ok(Math.abs(v.durationSeconds-v.frames/v.fps)<1e-6,'Video duration must match its declared frame count and FPS');
  if(v.stride!==undefined)assert.equal(v.stride,format.stride);
  if(v.durationToleranceSeconds!==undefined)assert.equal(v.durationToleranceSeconds,format.durationToleranceSeconds);
  if(v.nativeCanvas!==undefined)assert.deepEqual(v.nativeCanvas,{width:v.width,height:v.height},'Recording must declare its actual canvas dimensions');
  if(v.simulationSeconds!==undefined)assert.equal(v.simulationSeconds,e.result.seconds);
  if(v.lastVisualFrame!==undefined)assert.equal(v.lastVisualFrame,e.result.frames-1,'The final capture must show the actual last simulation frame');
  if(v.terminalSample!==undefined)assert.equal(typeof v.terminalSample,'boolean');
  if(e.encodedFrames!==undefined)assert.equal(e.encodedFrames,v.frames);
  if(e.capture!==undefined){for(const name of ['fps','stride','width','height'])assert.equal(e.capture[name],format[name]);assert.deepEqual(e.capture.nativeCanvas,{width:v.width,height:v.height});}
  assert.ok(Math.abs(v.durationSeconds-e.result.seconds)<=format.durationToleranceSeconds,'Recording must remain at 1× simulation time');
 }
 return tower;
}
export function upgradePreviewPath(config){
 const target=config.previewPath||'tower-singularity';
 assert.match(target,/^[a-z0-9][a-z0-9-]*$/,'Preview must be one isolated directory');
 return target;
}
