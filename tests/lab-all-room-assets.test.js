import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {CAMPAIGN,campaignSpec} from '../src/game/LabCampaignLevels.js';
import {FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {OPEN_ROOM_INDICES} from '../src/game/LabOpenEdition.js';

test('every selectable chamber declares the models it constructs at startup',async()=>{
 const game=await createHeadlessGame(),originalModel=game.model,missing=[];
 const editions={foundation:FOUNDATION_INDICES,classic:CAMPAIGN.map((_,index)=>index),open:OPEN_ROOM_INDICES};
 try{
  for(const [edition,indices] of Object.entries(editions))for(const index of indices){
   game.chamberEdition=edition;
   const used=new Set();
   game.model=function(id,...args){used.add(id);return originalModel.call(this,id,...args);};
   await game.selectLevel(index,false);
   const declared=new Set(campaignSpec(game,index).assets);
   for(const id of used)if(!declared.has(id))missing.push(`${edition} room ${index+1}: model ${id}`);
  }
  assert.deepEqual(missing,[],`Startup models absent from per-room browser asset manifests: ${missing.join(', ')}`);
 }finally{
  game.model=originalModel;
  game.physics.dispose();game.portals.dispose();
 }
});
