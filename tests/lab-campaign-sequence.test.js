import test from 'node:test';
import assert from 'node:assert/strict';
import {readFoundationEdition,nextFoundationLevel} from '../src/game/LabFoundationEdition.js';
import {CASTLE_LEVEL_INDEX,FOUNDATION_SEQUENCE,foundationDisplayNumber,foundationIndexAtNumber,isFoundationSequence} from '../src/game/LabCampaignSequence.js';

test('all fifty ordinary rooms precede the castle exactly once',()=>{
 assert.equal(FOUNDATION_SEQUENCE.length,51);
 assert.equal(new Set(FOUNDATION_SEQUENCE).size,51);
 assert.equal(FOUNDATION_SEQUENCE.at(-1),CASTLE_LEVEL_INDEX);
 assert.ok(!FOUNDATION_SEQUENCE.slice(0,50).includes(CASTLE_LEVEL_INDEX));
 assert.deepEqual([...FOUNDATION_SEQUENCE].sort((a,b)=>a-b),Array.from({length:51},(_,index)=>index));
 assert.equal(isFoundationSequence(FOUNDATION_SEQUENCE),true);
 assert.equal(isFoundationSequence(Array.from({length:51},(_,index)=>index)),false);
});

test('fifth chapter navigation and numbering lead into one final castle',()=>{
 assert.equal(nextFoundationLevel(39),41);
 assert.equal(foundationDisplayNumber(41),41);
 assert.equal(nextFoundationLevel(49),50);
 assert.equal(foundationDisplayNumber(50),50);
 assert.equal(nextFoundationLevel(50),40);
 assert.equal(foundationDisplayNumber(40),51);
 assert.equal(nextFoundationLevel(40),null);
 for(let number=1;number<=51;number++)assert.equal(foundationDisplayNumber(foundationIndexAtNumber(number)),number);
});

test('permanent room bookmarks retain their original actor and save identity',()=>{
 assert.deepEqual(readFoundationEdition('?edition=foundation&level=41'),{enabled:true,levelIndex:40});
 assert.deepEqual(readFoundationEdition('?edition=foundation&level=42'),{enabled:true,levelIndex:41});
 assert.deepEqual(readFoundationEdition('?edition=foundation&level=51'),{enabled:true,levelIndex:50});
 for(const bad of [-1,51,1.5,NaN,'40'])assert.throws(()=>foundationDisplayNumber(bad),RangeError);
 for(const bad of [0,52,1.5,NaN,'51'])assert.throws(()=>foundationIndexAtNumber(bad),RangeError);
});
