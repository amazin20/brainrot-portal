import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {originalSecondChapterContract} from './helpers/lab-second-chapter-mount-contract.js';
let game;
before(async()=>{game=await createHeadlessGame();game.chamberEdition='foundation';});
after(()=>{game.firstLevel?.dispose();game.physics.dispose();game.portals.dispose();});
for(const [kind,aspect]of [['wide',1280/720],['portrait',390/844]])for(const number of [13,14])test(`room${number} ${kind}: ordinary portal, optical and cargo route passes real fixed mount bodies`,async()=>{
 game.camera.aspect=aspect;game.camera.updateProjectionMatrix();await game.selectLevel(number-1,true);
 const cargo=game.cargo.group,body=game.physics.cargoBody,shape=body.shapes[0],mounting=game.firstLevel.secondChapterArt.mounting;
 const supports=mounting.meshes.map(m=>({mesh:m,body:game.physics.solids.get(m.uuid).body,shape:game.physics.solids.get(m.uuid).body.shapes[0]}));
 const previous=game.updateVisuals;let frames=0;
 game.updateVisuals=function(...args){frames++;assert.equal(this.cargo.group,cargo);assert.equal(this.physics.cargoBody,body);assert.equal(body.shapes[0],shape);return previous.apply(this,args);};
 try{
  const report=await runV8Journey(game,{journeyOptions:{nativeStart:true}});
  assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.resets,0);assert.equal(report.respawns,0);assert.ok(frames>1000);
  for(const s of supports){assert.equal(game.physics.solids.get(s.mesh.uuid).body,s.body);assert.equal(s.body.shapes[0],s.shape);}
  originalSecondChapterContract(game);
 }finally{game.updateVisuals=previous;}
});
