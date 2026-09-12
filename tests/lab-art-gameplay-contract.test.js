import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {LabGame} from '../src/game/LabGame.js';
import {LabPhysics} from '../src/game/LabPhysics.js';
import {LabPortals} from '../src/game/LabPortals.js';
import {disposeLabLevel} from '../src/game/LabLevelLifecycle.js';
import {buildRoom12} from '../src/game/LabPortalRoom12.js';
import {buildRoom13} from '../src/game/LabPortalRoom13.js';
import {buildRoom14} from '../src/game/LabPortalRoom14.js';
import {buildRoom15} from '../src/game/LabPortalRoom15.js';
import {finishAdvancedRoom} from '../src/game/LabAdvancedArchitecture.js';
import {upgradeBrowser3DArt} from '../src/game/LabBrowser3DArt.js';
import {applyPremiumBrowser3DArt} from '../src/game/LabBrowser3DPremium.js';

// Decode the real assets once. Raw rooms deliberately bypass the campaign's
// graphics finish so this compares the accepted mechanics with and without art.
const assetsGame=await createHeadlessGame();
after(()=>disposeLabLevel(assetsGame));
const builders=[buildRoom12,buildRoom13,buildRoom14,buildRoom15];
const registries=['colliders','portalPanels','floors','cameraBlockers','aimBlockers'];
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const coordinates=v=>Array.isArray(v)?[...v]:v?.toArray?.()??(v?{...v}:null);
const bounds=b=>({min:b.min.toArray(),max:b.max.toArray()});
const stable=value=>JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='number'?Math.round(v*1e10)/1e10:v));

function rawRoom(room){
 const game=new LabGame({container:null,touch:false});
 game.assets=assetsGame.assets;game.levelIndex=room-1;
 game.scene=new THREE.Scene();game.camera=assetsGame.camera.clone();
 game.materials=Object.fromEntries(Object.entries(assetsGame.materials).map(([key,mat])=>[key,mat.clone()]));
 game.audio=assetsGame.audio;game.label=()=>new THREE.Object3D();
 game.cargo={position:V(100,100,100),velocity:V(),quaternion:new THREE.Quaternion()};
 game.portals=new LabPortals({scene:game.scene,camera:game.camera,renderer:null,maxResolution:64,samples:0});
 const level=builders[room-12](game,room-1);
 if(room>12)finishAdvancedRoom(level);
 game.firstLevel=level;game.playerPosition.fromArray(level.spawn);game.previousPlayerPosition.copy(game.playerPosition);
 game.cargo.position.fromArray(level.cargoSpawn);game.playerGrounded=false;
 game.physics=new LabPhysics({fixedStep:1/120});
 for(const c of game.colliders)game.physics.addStaticBox(c.mesh.uuid,c.box,{kinematic:!!c.kinematic,enabled:c.enabled!==false});
 game.physics.createCargo({position:game.cargo.position,size:.78,mass:3.2});
 level.reset();game.levelRoots=[...game.scene.children];
 return game;
}

function numericState(object){
 const result={};
 for(const [key,value] of Object.entries(object??{})){
  if(['number','boolean','string'].includes(typeof value))result[key]=value;
  else if(value?.isVector3||value?.isQuaternion)result[key]=value.toArray();
  else if(key==='segments')result.segments=value.map(s=>({a:s.a.toArray(),b:s.b.toArray(),direction:s.direction.toArray(),length:s.length,kind:s.kind}));
  else if(Array.isArray(value)&&value.every(v=>['number','boolean','string'].includes(typeof v)))result[key]=[...value];
 }
 return result;
}

function contract(game){
 const level=game.firstLevel;game.scene.updateMatrixWorld(true);
 const meshData=mesh=>({name:mesh.name,matrix:mesh.matrixWorld.toArray()});
 return stable({
  room:{spawn:coordinates(level.spawn),cargoSpawn:coordinates(level.cargoSpawn),spawnView:level.spawnView,bounds:level.bounds,
   goal:level.goal.position.toArray(),puzzle:level.puzzleGeometry,momentum:level.momentum},
  colliders:game.colliders.map(c=>({...meshData(c.mesh),box:bounds(c.box),enabled:c.enabled,kinematic:c.kinematic,
   ignorePropagation:c.ignorePropagation,opticallyTransparent:c.opticallyTransparent})),
  floors:game.floors.map(f=>({mesh:f.mesh?.name,minX:f.minX,maxX:f.maxX,minZ:f.minZ,maxZ:f.maxZ,y:f.y,enabled:f.enabled})),
  camera:game.cameraBlockers.map(meshData),aim:game.aimBlockers.map(meshData),portalRegistry:game.portalPanels.map(meshData),
  panels:Object.entries(level.panels).map(([name,s])=>{const f=s.getFrame();return {name,center:f.center.toArray(),right:f.right.toArray(),up:f.up.toArray(),normal:f.normal.toArray(),halfWidth:f.halfWidth,halfHeight:f.halfHeight,portalable:s.mesh.userData.portalable};}),
  mechanics:Object.fromEntries(Object.entries(level.state).map(([key,state])=>[key,numericState(state)])),
  pads:level.pads.map(p=>numericState(p)),
  physics:{fixedStep:game.physics.fixedStep,gravity:coordinates(game.physics.world.gravity),iterations:game.physics.world.solver.iterations,
   bodies:game.colliders.map(c=>{const solid=game.physics.solids.get(c.mesh.uuid);return solid?{type:solid.body.type,position:coordinates(solid.body.position),target:coordinates(solid.target),half:coordinates(solid.half),collisionMask:solid.body.collisionFilterMask,friction:solid.body.material.friction,restitution:solid.body.material.restitution}:null;})},
  player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),won:level.isWon(),
 });
}

function pair(game,a,b){
 for(const [index,name] of [a,b].entries()){
  const frame=game.firstLevel.panels[name].getFrame();
  game.portals.place(index,frame.center,frame.normal,frame.up);
 }
}

function stimulate(game,room,frame){
 const level=game.firstLevel;
 if(frame===0){
  if(room===12)pair(game,'shared-drop','final');
  if(room===13)pair(game,'light-intake','light-output');
  if(room===14)pair(game,'light-source','weave-west');
  if(room===15)pair(game,'intake','freight');
 }
 if(room===13){
  if(frame<100)game.cargo.position.copy(level.panels['mirror-cradle'].getFrame().center).add(V(0,.39,0));
  else game.cargo.position.set(100,100,100);
 }
 if(room===14&&frame===100)pair(game,'light-source','weave-north');
 if(room===15){
  level.state.funnel.reversed=frame>=80;level.state.funnel.enabled=frame<190;
  if(frame===140)pair(game,'intake','lift');
 }
 level.update(1/60);
 // Different display interpolation must not feed back into these mechanisms.
 level.renderUpdate((frame%5)/4);
}

for(const room of [12,13,14,15])test(`room ${room} art preserves its actual gameplay contract before and during mechanism motion`,()=>{
 const baseline=rawRoom(room),upgraded=rawRoom(room);
 try{
  assert.deepEqual(contract(upgraded),contract(baseline),'raw production builders must start from equal conditions');
  const references=Object.fromEntries(registries.map(key=>[key,[...upgraded[key]]]));
  const original=contract(upgraded);
  applyPremiumBrowser3DArt(upgradeBrowser3DArt(upgraded.firstLevel));
  for(const key of registries){
   assert.equal(upgraded[key].length,references[key].length,`${key} count changed during graphics upgrade`);
   references[key].forEach((entry,i)=>assert.equal(upgraded[key][i],entry,`${key} identity or ordering changed`));
  }
  assert.deepEqual(contract(upgraded),original,'graphics upgrade changed authored interaction geometry or mechanism tuning');
  let observedMotion=false;
  for(let frame=0;frame<240;frame++){
   stimulate(baseline,room,frame);stimulate(upgraded,room,frame);
   if(frame%30===0||frame===239)assert.deepEqual(contract(upgraded),contract(baseline),`mechanical behavior diverged at frame ${frame}`);
   if(room===13)observedMotion ||= baseline.firstLevel.state['north-cage'].progress>0||baseline.firstLevel.state['south-cage'].progress>0;
   if(room===14)observedMotion ||= baseline.firstLevel.state.lightBridge.segments.length>1;
   if(room===15)observedMotion ||= baseline.firstLevel.state.funnel.segments.length>1;
  }
  if(room>12)assert.ok(observedMotion,'comparison must exercise the moving or portal-routed mechanism');
 }finally{disposeLabLevel(baseline);disposeLabLevel(upgraded);}
});

test('transfer turbine interpolates visually without modifying funnel routing, settings or force',()=>{
 const game=rawRoom(15);
 try{
  applyPremiumBrowser3DArt(upgradeBrowser3DArt(game.firstLevel));
  const level=game.firstLevel,field=level.state.funnel;
  const housing=level.world.root.getObjectByName('Browser 3D transfer-field turbine');
  const rotor=housing?.getObjectByName(housing.userData.options.rotorNode);
  assert.ok(rotor,'the presentation must expose the actual animated rotor');
  pair(game,'intake','freight');
  for(const reversed of [false,true]){
   field.reversed=reversed;
   for(let i=0;i<60;i++)level.update(1/60);
   const before=contract(game),sample=field.origin.clone().addScaledVector(field.direction,2).add(V(0,.15,0));
   const force=field.acceleration(sample,V(1,.2,-.1),.39).toArray();
   assert.ok(Math.hypot(...force)>1,'the force sample must lie inside the active transfer field');
   const angles=[];
   for(const alpha of [0,.25,.5,.75,1]){
    level.renderUpdate(alpha);angles.push(rotor.rotation.z);
    assert.deepEqual(contract(game),before,'render interpolation must not write gameplay state');
    assert.deepEqual(field.acceleration(sample,V(1,.2,-.1),.39).toArray(),force,'display alpha must not change physical force');
   }
   assert.ok(Math.abs(angles[4]-angles[0])>.001,'the rotor must animate between simulation samples');
   assert.ok(reversed?angles[4]<angles[0]:angles[4]>angles[0],'rotation direction must reflect the existing reversible field');
  }
 }finally{disposeLabLevel(game);}
});
