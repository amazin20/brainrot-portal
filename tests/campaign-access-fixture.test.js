import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignAccessFixture,CAMPAIGN_ACCESS_FIXTURE_SCOPE} from '../scripts/lib/campaign-access-fixture.mjs';
import {FOUNDATION_SEQUENCE,CASTLE_LEVEL_INDEX} from '../src/game/LabCampaignSequence.js';
import {deriveCampaignAccess} from '../src/game/LabCampaignAccess.js';
import {CAMPAIGN_PREFERENCE_KEY} from '../src/game/LabCampaignStorage.js';

test('every QA target starts unfinished behind exactly its real previously completed prefix',()=>{
  for(const version of ['v62','v63'])for(const [position,levelIndex] of FOUNDATION_SEQUENCE.entries()){
    const fixture=campaignAccessFixture({levelIndex,pathname:`/campaign-${version}/`});
    assert.equal(fixture.key,`brainrot-campaign-${version}:`+CAMPAIGN_PREFERENCE_KEY);
    assert.equal(fixture.scope,CAMPAIGN_ACCESS_FIXTURE_SCOPE);
    assert.equal(fixture.constructorWrites,0);
    assert.equal(fixture.targetCompleted,false);
    assert.deepEqual(fixture.completed,FOUNDATION_SEQUENCE.slice(0,position));
    const actual=deriveCampaignAccess(JSON.parse(fixture.raw));
    assert.equal(actual.nextIndex,levelIndex);
    assert.equal(actual.completedIndices.includes(levelIndex),false);
    assert.deepEqual(actual.accessibleIndices,FOUNDATION_SEQUENCE.slice(0,position+1));
  }
});

test('castle QA setup includes fifty ordinary completions and never a precompleted castle',()=>{
  const fixture=campaignAccessFixture({levelIndex:CASTLE_LEVEL_INDEX,pathname:'/brainrot-portal/campaign-v63/index.html'});
  assert.equal(fixture.completed.length,50);
  assert.equal(fixture.completed.includes(CASTLE_LEVEL_INDEX),false);
  assert.equal(JSON.parse(fixture.raw).resumeLevel,CASTLE_LEVEL_INDEX);
  assert.deepEqual(fixture.preferences.hints,{});
});

test('an invalid room or undeclared archive mount cannot silently become a valid access fixture',()=>{
  for(const levelIndex of [-1,51,NaN,'40',null])assert.throws(()=>campaignAccessFixture({levelIndex,pathname:'/campaign-v62/'}));
  for(const pathname of ['/', '/campaign-v999/', '/other/campaign-v62/'])assert.throws(()=>campaignAccessFixture({levelIndex:0,pathname}));
});
