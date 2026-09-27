import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences} from '../src/game/LabPreferences.js';
import {foundationStorage,FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {openEditionStorage,OPEN_ROOM_INDICES} from '../src/game/LabOpenEdition.js';
import {resumeCampaignLevel,nextResumeLevel} from '../src/game/LabResume.js';
function storage(){const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};}
test('reload resumes the last successfully started room without granting completion',()=>{
 const s=foundationStorage(storage()),p=new LabPreferences(s);p.save({resumeLevel:16});
 const again=new LabPreferences(s);
 assert.equal(resumeCampaignLevel('',again.value,FOUNDATION_INDICES,0),16);
 assert.deepEqual(again.value.completed,[]);
});
test('victory persists the next room and final victory keeps the final room',()=>{
 const s=storage(),p=new LabPreferences(s);p.complete(4);p.save({resumeLevel:nextResumeLevel(4,FOUNDATION_INDICES)});
 assert.equal(new LabPreferences(s).value.resumeLevel,5);
 assert.equal(nextResumeLevel(29,FOUNDATION_INDICES),29);
 assert.equal(nextResumeLevel(OPEN_ROOM_INDICES[0],OPEN_ROOM_INDICES),OPEN_ROOM_INDICES[1]);
});
test('explicit links and retired velocity links override saved resume',()=>{
 const p={completed:[0],resumeLevel:12};
 for(const q of ['level=1','level=bad','mode=velocity&return=21'])assert.equal(resumeCampaignLevel(q,p,FOUNDATION_INDICES,0),0);
});
test('old saves resume first uncompleted room; scattered completions never skip puzzles',()=>{
 assert.equal(resumeCampaignLevel('',{completed:[0,1,20]},FOUNDATION_INDICES,0),2);
 assert.equal(resumeCampaignLevel('',{completed:[...FOUNDATION_INDICES]},FOUNDATION_INDICES,0),29);
 assert.equal(resumeCampaignLevel('',{completed:[]},OPEN_ROOM_INDICES,OPEN_ROOM_INDICES[0]),OPEN_ROOM_INDICES[0]);
});
test('resume stays isolated across campaign, archive and research',()=>{
 const s=storage(),a=new LabPreferences(s),f=new LabPreferences(foundationStorage(s)),o=new LabPreferences(openEditionStorage(s));
 a.save({resumeLevel:8});f.save({resumeLevel:16});o.save({resumeLevel:31});
 assert.equal(new LabPreferences(s).value.resumeLevel,8);
 assert.equal(new LabPreferences(foundationStorage(s)).value.resumeLevel,16);
 assert.equal(new LabPreferences(openEditionStorage(s)).value.resumeLevel,31);
 assert.equal(resumeCampaignLevel('',o.value,FOUNDATION_INDICES,0),0);
});
test('invalid resume data is sanitized; blocked storage keeps session progress usable',()=>{
 for(const value of [-1,100,2.2,'4',null,Infinity]){
  const p=new LabPreferences();p.save({resumeLevel:value});assert.equal(p.value.resumeLevel,null);
 }
 const p=new LabPreferences({getItem(){throw Error('denied');},setItem(){throw Error('must not write');}});
 p.save({resumeLevel:7});assert.equal(resumeCampaignLevel('',p.value,FOUNDATION_INDICES,0),7);
});
