import test from 'node:test';
import assert from 'node:assert/strict';
import {LabPreferences} from '../src/game/LabPreferences.js';
import {foundationStorage,FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {openEditionStorage,OPEN_ROOM_INDICES} from '../src/game/LabOpenEdition.js';
import {resumeCampaignLevel,nextResumeLevel} from '../src/game/LabResume.js';
import {FOUNDATION_SEQUENCE_REVISION} from '../src/game/LabCampaignSequence.js';
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
 assert.equal(nextResumeLevel(29,FOUNDATION_INDICES),30);
 assert.equal(nextResumeLevel(40,FOUNDATION_INDICES),40);
 assert.equal(nextResumeLevel(39,FOUNDATION_INDICES),41);
 assert.equal(nextResumeLevel(50,FOUNDATION_INDICES),40);
 assert.equal(nextResumeLevel(OPEN_ROOM_INDICES[0],OPEN_ROOM_INDICES),OPEN_ROOM_INDICES[1]);
});
test('completed previous finale resumes at the new room 31 without changing archive or manual links',()=>{
 const old={completed:Array.from({length:30},(_,i)=>i),resumeLevel:29};
 assert.equal(resumeCampaignLevel('',old,FOUNDATION_INDICES,0),30);
 assert.equal(resumeCampaignLevel('level=30',old,FOUNDATION_INDICES,29),29);
 assert.equal(resumeCampaignLevel('',old,Array.from({length:33},(_,i)=>i),0),29);
 assert.equal(resumeCampaignLevel('',{completed:old.completed.slice(0,29),resumeLevel:29},FOUNDATION_INDICES,0),29);
});
test('completed former forty-room finale continues to the fifth chapter before the castle',()=>{
 const previous={completed:Array.from({length:40},(_,i)=>i),resumeLevel:39};
 assert.equal(resumeCampaignLevel('',previous,FOUNDATION_INDICES,0),41);
 assert.equal(resumeCampaignLevel('level=40',previous,FOUNDATION_INDICES,39),39);
 assert.equal(resumeCampaignLevel('',{completed:previous.completed.slice(0,39),resumeLevel:39},FOUNDATION_INDICES,0),39);
});
test('explicit links and retired velocity links override saved resume',()=>{
 const p={completed:[0],resumeLevel:12};
 for(const q of ['level=1','level=bad','mode=velocity&return=21'])assert.equal(resumeCampaignLevel(q,p,FOUNDATION_INDICES,0),0);
});
test('old saves resume first uncompleted room; scattered completions never skip puzzles',()=>{
 assert.equal(resumeCampaignLevel('',{completed:[0,1,20]},FOUNDATION_INDICES,0),2);
 assert.equal(resumeCampaignLevel('',{completed:[...FOUNDATION_INDICES]},FOUNDATION_INDICES,0),40);
 assert.equal(resumeCampaignLevel('',{completed:[]},OPEN_ROOM_INDICES,OPEN_ROOM_INDICES[0]),OPEN_ROOM_INDICES[0]);
});
test('resume stays isolated across campaign, archive and research',()=>{
 const s=storage(),a=new LabPreferences(s),f=new LabPreferences(foundationStorage(s)),o=new LabPreferences(openEditionStorage(s));
 a.save({resumeLevel:8});f.save({resumeLevel:16});o.save({resumeLevel:31});
 assert.equal(new LabPreferences(s).value.resumeLevel,8);
 assert.equal(new LabPreferences(foundationStorage(s)).value.resumeLevel,16);
 assert.equal(new LabPreferences(openEditionStorage(s)).value.resumeLevel,31);
 assert.equal(resumeCampaignLevel('',new LabPreferences(foundationStorage(s)).value,FOUNDATION_INDICES,0),16);
});
test('invalid resume data is sanitized; blocked storage keeps session progress usable',()=>{
 for(const value of [-1,100,2.2,'4',null,Infinity]){
  const p=new LabPreferences();p.save({resumeLevel:value});assert.equal(p.value.resumeLevel,null);
 }
 const p=new LabPreferences({getItem(){throw Error('denied');},setItem(){throw Error('must not write');}});
 p.save({resumeLevel:7});assert.equal(resumeCampaignLevel('',p.value,FOUNDATION_INDICES,0),7);
});

test('completed castle resumes at new research chapter while explicit castle links retain start',()=>{
 const p={completed:Array.from({length:41},(_,i)=>i),resumeLevel:40};
 assert.equal(resumeCampaignLevel('',p,FOUNDATION_INDICES,0),41);
 assert.equal(resumeCampaignLevel('level=41',p,FOUNDATION_INDICES,40),40);
 assert.equal(nextResumeLevel(50,FOUNDATION_INDICES),40);
});

test('an old automatic castle resume moves to the unplayed ordinary chapter without editing completions',()=>{
 const previous={completed:Array.from({length:40},(_,index)=>index),resumeLevel:40};
 const before=JSON.stringify(previous);
 assert.equal(resumeCampaignLevel('',previous,FOUNDATION_INDICES,0),41);
 assert.equal(resumeCampaignLevel('level=41',previous,FOUNDATION_INDICES,40),40);
 assert.equal(JSON.stringify(previous),before);
});

test('a current explicit castle start resumes the castle and never remigrates to an earlier chapter',()=>{
 const s=foundationStorage(storage()),p=new LabPreferences(s);
 p.save({completed:Array.from({length:40},(_,index)=>index),resumeLevel:40,campaignSequenceRevision:FOUNDATION_SEQUENCE_REVISION});
 const again=new LabPreferences(s);
 assert.equal(again.value.campaignSequenceRevision,FOUNDATION_SEQUENCE_REVISION);
 assert.equal(resumeCampaignLevel('',again.value,FOUNDATION_INDICES,0),40);
 assert.equal(resumeCampaignLevel('level=42',again.value,FOUNDATION_INDICES,41),41);
});

test('old final-room saves continue to the castle, while completed new final saves remain there',()=>{
 const ordinary=FOUNDATION_INDICES.slice(0,50);
 assert.equal(resumeCampaignLevel('',{completed:ordinary,resumeLevel:50},FOUNDATION_INDICES,0),40);
 assert.equal(resumeCampaignLevel('',{completed:[...FOUNDATION_INDICES],resumeLevel:40,campaignSequenceRevision:FOUNDATION_SEQUENCE_REVISION},FOUNDATION_INDICES,0),40);
 assert.equal(resumeCampaignLevel('level=51',{completed:ordinary,resumeLevel:50},FOUNDATION_INDICES,50),50);
});

test('legacy late-room resume introduces the replaced chapter after its old completions are invalidated',()=>{
 const s=foundationStorage(storage()),old=new LabPreferences(s);
 old.save({completed:Array.from({length:51},(_,index)=>index),resumeLevel:50,hints:{19:2,50:3},quality:'high',volume:.21});
 const revisions=Object.fromEntries(Array.from({length:9},(_,offset)=>[offset+42,`spatial-progression${offset+43}-v1`]));
 const replaced=new LabPreferences(s,{roomRevisions:revisions});
 assert.equal(resumeCampaignLevel('',replaced.value,FOUNDATION_INDICES,0),42);
 assert.equal(resumeCampaignLevel('level=51',replaced.value,FOUNDATION_INDICES,50),50);
 assert.deepEqual(replaced.value.completed,Array.from({length:42},(_,index)=>index));
 assert.deepEqual(replaced.value.hints,{19:2});
 assert.equal(replaced.value.quality,'high');assert.equal(replaced.value.volume,.21);
 // A new explicit late selection is an intentional resume, not a legacy
 // continuation. Its saved revision prevents a second chapter migration.
 replaced.save({resumeLevel:50,campaignSequenceRevision:FOUNDATION_SEQUENCE_REVISION});
 assert.equal(resumeCampaignLevel('',new LabPreferences(s,{roomRevisions:revisions}).value,FOUNDATION_INDICES,0),50);
});

test('unmarked late-room migration respects already completed replacements and stays out of review editions',()=>{
 const previous={completed:[42,43],resumeLevel:49};
 assert.equal(resumeCampaignLevel('',previous,FOUNDATION_INDICES,0),44);
 assert.equal(resumeCampaignLevel('level=50',previous,FOUNDATION_INDICES,49),49);
 assert.equal(resumeCampaignLevel('',previous,[42,43,44,45,46,47,48,49,50],42),49);
 assert.equal(resumeCampaignLevel('',{...previous,campaignSequenceRevision:FOUNDATION_SEQUENCE_REVISION},FOUNDATION_INDICES,0),49);
});
