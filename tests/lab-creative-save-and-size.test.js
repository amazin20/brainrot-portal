import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences,applyLabQuality,CREATIVE_CAMPAIGN_REVISION,CREATIVE_REPLACED_INDICES} from '../src/game/LabPreferences.js';
import {foundationStorage} from '../src/game/LabFoundationEdition.js';

test('creative replacement migrates only changed foundation completions, retaining progress and resume',()=>{
 const key='brainrot-foundation-v1:brainrot-portal.preferences.v24',completed=Array.from({length:41},(_,i)=>i);
 const original={campaignRevision:'folded-junction-v28',quality:'high',volume:.2,muted:true,tutorial:false,resumeLevel:34,
  completed,hints:Object.fromEntries(completed.map(i=>[i,2]))};
 const records=new Map([[key,JSON.stringify(original)],['brainrot-portal.preferences.v24','archive-unmodified']]);
 const storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};
 const options={campaignRevision:CREATIVE_CAMPAIGN_REVISION,replacedIndices:CREATIVE_REPLACED_INDICES};
 const preferences=new LabPreferences(foundationStorage(storage),options);
 assert.deepEqual(CREATIVE_REPLACED_INDICES,[13,15,17,19,30,31,32,33,34,35,36,38,39,40]);
 const expected=completed.filter(i=>!CREATIVE_REPLACED_INDICES.includes(i));
 assert.deepEqual(preferences.value.completed,expected);
 assert.deepEqual(Object.keys(preferences.value.hints).map(Number),expected);
 assert.equal(preferences.value.resumeLevel,34);assert.equal(preferences.value.quality,'high');
 assert.equal(preferences.value.volume,.2);assert.equal(preferences.value.muted,true);assert.equal(preferences.value.tutorial,false);
 assert.equal(records.get('brainrot-portal.preferences.v24'),'archive-unmodified');
 preferences.complete(30);preferences.unlockHint(30);
 const once=records.get(key),reloaded=new LabPreferences(foundationStorage(storage),options);
 assert.ok(reloaded.value.completed.includes(30));assert.equal(reloaded.value.hints[30],1);
 assert.equal(records.get(key),once,'matching revision must not remigrate or rewrite');
});

test('graphics presets respect the bounded game surface and keep its camera projection aligned',()=>{
 const sizes=[],camera={aspect:0,updateProjectionMatrix(){this.updated=true;}};
 const renderer={shadowMap:{},setPixelRatio(){},setSize:(...s)=>sizes.push(s)};
 const game={container:{clientWidth:1800,clientHeight:900},renderer,camera};
 for(const key of ['low','balanced','high'])applyLabQuality(game,key,2);
 assert.deepEqual(sizes,[[1800,900],[1800,900],[1800,900]]);assert.equal(camera.aspect,2);assert.equal(camera.updated,true);
 game.container.clientWidth=540;game.container.clientHeight=960;applyLabQuality(game,'low',1);
 assert.deepEqual(sizes.at(-1),[540,960]);assert.equal(camera.aspect,540/960);
});
