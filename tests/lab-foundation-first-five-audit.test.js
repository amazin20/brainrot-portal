import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';
import {runV8Journey} from '../src/game/LabV8Journey.js';

test('foundation rooms 1–5 boot from their exact lazy-loaded model lists',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='foundation';
  const sources=game.assets,used=new Set(),model=game.model;
  game.model=function(id,...args){used.add(id);return model.call(this,id,...args);};
  for(let index=0;index<5;index++){
   const declared=campaignSpec(game,index).assets;
   game.assets=new Map(declared.map(id=>[id,sources.get(id)]));used.clear();
   assert.ok([...game.assets.values()].every(Boolean),`room ${index+1} declares a missing GLB`);
   await game.selectLevel(index,false);
   assert.deepEqual([...used].sort((a,b)=>a-b),[...declared].sort((a,b)=>a-b),`room ${index+1} model list differs from its actual startup use`);
   if(index===0)assert.ok(game.firstLevel.cargoHoist);
   for(const journeyOptions of [{},{alternate:true}]){
    const cargo=game.cargo,body=game.physics.cargoBody;
    const report=await runV8Journey(game,{journeyOptions});
    assert.equal(report.pass,true,`room ${index+1} did not complete`);
    assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
    assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
   }
   assert.deepEqual([...used].sort((a,b)=>a-b),[...declared].sort((a,b)=>a-b),`room ${index+1} used an undeclared model during play`);
  }
 }finally{game.physics?.dispose();game.portals?.dispose();}
});

test('foundation room 1 updates its guidance after the player dispatches the original companion',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='foundation';await game.selectLevel(0,false);
  const cargo=game.cargo,body=game.physics.cargoBody,interact=game.interact;
  let dispatchHint,collectionHint;
  game.interact=function(...args){
   if(this.teleportCount===1&&this.firstLevel.nearbyInteraction?.()?.kind==='freight-dispatch')dispatchHint=this.tutorial.update();
   return interact.apply(this,args);
  };
  const report=await runV8Journey(game,{journeyOptions:{alternate:true},onMilestone:({name})=>{
   if(name==='Scout dispatches the original companion after reaching the upper gallery by portal')collectionHint=game.tutorial.update();
  }});
  assert.equal(report.pass,true);assert.equal(game.state,'won');assert.equal(report.resets+report.respawns,0);
  assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
  assert.equal(dispatchHint?.id,'freight-dispatch');
  assert.equal(collectionHint?.id,'foundation-collect');
 }finally{game.physics?.dispose();game.portals?.dispose();}
});

test('foundation room 3 can dispatch its loose companion first and reverse the same loaded carriage',async()=>{
 const game=await createHeadlessGame();
 try{
  game.chamberEdition='foundation';await game.selectLevel(2,false);
  const cargo=game.cargo,body=game.physics.cargoBody;
  for(const options of [{recover:true},{freight:true},{freight:true,returnCargo:true}]){
   const report=await runV8Journey(game,{journeyOptions:options});
   assert.equal(report.pass,true);assert.equal(game.state,'won');
   assert.equal(report.resets+report.respawns,0);
   assert.equal(game.cargo,cargo);assert.equal(game.physics.cargoBody,body);
   if(options.freight){
    assert.ok(report.milestones.some(m=>m.name.startsWith('Loaded car reaches the far berth')));
    assert.ok(report.milestones.some(m=>m.name.startsWith('Lower portal joins the loaded car')));
   }else assert.ok(report.milestones.some(m=>m.name.startsWith('The dry service incline returns')));
   assert.equal(report.milestones.some(m=>m.name.startsWith('Loaded car and original companion return')),!!options.returnCargo);
  }
 }finally{game.physics?.dispose();game.portals?.dispose();}
});
