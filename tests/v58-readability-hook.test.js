import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {observeSingularityReadability} from '../src/game/LabSingularityJourney.js';

// Capability-boundary unit controls. No castle route, lens, or physics runs.
function fixture(){
 const clock={steps:17,looks:0,waits:0,snapshots:0},commands=[];
 const state={frame:12,seconds:17/120,player:[1,2,3],cargo:[4,5,6],solved:['freight'],state:'playing',nested:{contacts:[{bodyId:8,normal:[0,1,0]}]}};
 const look=async target=>{clock.looks++;commands.push(['look',target]);};
 const wait=async seconds=>{clock.waits++;clock.steps+=Math.ceil(seconds*120);commands.push(['wait',seconds]);};
 const snapshot=()=>{clock.snapshots++;return state;};
 return {clock,commands,state,look,wait,snapshot,options:{look,wait,snapshot}};
}

test('undefined/null hook is a true no-op, including when controls are unavailable',async()=>{
 for(const hook of [undefined,null]){
  let calls=0;const forbidden=()=>{calls++;throw Error('default route advanced');};
  await observeSingularityReadability(hook,'upper-before-boarding',{look:forbidden,wait:forbidden,snapshot:forbidden});
  await observeSingularityReadability(hook,'upper-before-boarding',{look:null,wait:undefined,snapshot:42});
  assert.equal(calls,0);
  const f=fixture(),before={...f.clock};await observeSingularityReadability(hook,'upper-after-ride',f.options);assert.deepEqual(f.clock,before);assert.deepEqual(f.commands,[]);
 }
});

test('actual hook receives only the declared ordinary controls and a cloned frozen snapshot',async()=>{
 const f=fixture();let payload;
 await observeSingularityReadability(value=>{payload=value;},'upper-after-ride',f.options);
 assert.deepEqual(Object.keys(payload),['phase','look','wait','snapshot']);assert.equal(payload.phase,'upper-after-ride');
 assert.equal(payload.look,f.look);assert.equal(payload.wait,f.wait);assert.notEqual(payload.snapshot,f.state);assert.deepEqual(payload.snapshot,f.state);
 for(const key of ['game','camera','cameraRig','lens','pose','physics','scene','renderer','frame','setPosition','setCamera','reset'])assert.equal(key in payload,false,key+' must not be an exposed capability');
 assert.equal(typeof payload.snapshot,'object');assert.equal(typeof payload.snapshot.player.set,'undefined');assert.equal(f.clock.snapshots,1);
 assert.equal(f.clock.looks,0);assert.equal(f.clock.waits,0);assert.equal(f.clock.steps,17);
});

test('payload and every nested cloned object/array are frozen; source snapshot stays writable',async()=>{
 const f=fixture();let payload;
 await observeSingularityReadability(value=>{payload=value;},'upper-contact-retained',f.options);
 function frozen(value){if(value&&typeof value==='object'){assert.equal(Object.isFrozen(value),true);for(const child of Object.values(value))frozen(child);}}
 frozen(payload);assert.throws(()=>{payload.phase='forged';},TypeError);assert.throws(()=>{payload.game={};},TypeError);
 assert.throws(()=>{payload.snapshot.player[0]=999;},TypeError);assert.throws(()=>payload.snapshot.solved.push('pendulum'),TypeError);
 assert.throws(()=>{payload.snapshot.nested.contacts[0].normal[1]=0;},TypeError);
 assert.equal(Object.isFrozen(f.state),false);assert.equal(Object.isFrozen(f.state.nested),false);
 f.state.player[0]=99;f.state.nested.contacts[0].normal[1]=.5;f.state.solved.push('archive');
 assert.equal(payload.snapshot.player[0],1);assert.equal(payload.snapshot.nested.contacts[0].normal[1],1);assert.deepEqual(payload.snapshot.solved,['freight']);
});

test('hook can await ordinary look/wait and only those explicit controls advance the fixture',async()=>{
 const f=fixture(),events=[];
 await observeSingularityReadability(async({phase,look,wait,snapshot})=>{
  events.push('hook:'+phase);assert.equal(snapshot.frame,12);await look([7,8,9]);events.push('looked');await wait(.25);events.push('waited');
 },'upper-before-boarding',f.options);events.push('returned');
 assert.deepEqual(events,['hook:upper-before-boarding','looked','waited','returned']);
 assert.deepEqual(f.commands,[['look',[7,8,9]],['wait',.25]]);assert.deepEqual(f.clock,{steps:47,looks:1,waits:1,snapshots:1});
});

test('invalid hooks reject before snapshot or any ordinary input is called',async()=>{
 for(const hook of [false,0,1,'hook',{},[]]){
  const f=fixture();await assert.rejects(observeSingularityReadability(hook,'upper-after-ride',f.options),/Ordinary readability callback required/);
  assert.deepEqual(f.clock,{steps:17,looks:0,waits:0,snapshots:0});
 }
});

test('invalid look/wait/snapshot capabilities reject before hook or other callbacks',async()=>{
 for(const key of ['look','wait','snapshot'])for(const value of [undefined,null,0,{},[]]){
  const f=fixture();let called=0;await assert.rejects(observeSingularityReadability(()=>{called++;},'upper-contact-retained',{...f.options,[key]:value}),/Ordinary readability callback required/);
  assert.equal(called,0);assert.deepEqual(f.clock,{steps:17,looks:0,waits:0,snapshots:0});
 }
});

test('callback or snapshot errors propagate without hidden recovery inputs or extra snapshots',async()=>{
 const f=fixture(),error=Error('observer rejected current evidence');
 await assert.rejects(observeSingularityReadability(async()=>{throw error;},'upper-after-ride',f.options),e=>e===error);
 assert.deepEqual(f.clock,{steps:17,looks:0,waits:0,snapshots:1});
 const g=fixture();let called=0;const snapshotError=Error('missing current physical snapshot');
 await assert.rejects(observeSingularityReadability(()=>{called++;},'upper-after-ride',{...g.options,snapshot(){throw snapshotError;}}),e=>e===snapshotError);
 assert.equal(called,0);assert.deepEqual(g.clock,{steps:17,looks:0,waits:0,snapshots:0});
});

test('route offers exactly three guarded phases around the boarding/ride/jump segment',()=>{
 const source=fs.readFileSync(new URL('../src/game/LabSingularityJourney.js',import.meta.url),'utf8');
 assert.match(source,/export async function runSingularityJourney\(game,\{[^\n]*onReadabilityPhase=null\}/);
 const calls=[...source.matchAll(/if\(onReadabilityPhase\)\s*await observeSingularityReadability\(onReadabilityPhase,'([^']+)',\{look,wait,snapshot:S\}\);/g)];
 assert.deepEqual(calls.map(match=>match[1]),['upper-before-boarding','upper-after-ride','upper-contact-retained']);
 assert.equal((source.match(/await observeSingularityReadability\(/g)||[]).length,3,'every route hook invocation must remain optional and guarded');
 const pendulumStart=source.indexOf('async pendulum(){'),inertiaStart=source.indexOf('async inertia(){',pendulumStart);
 assert.ok(pendulumStart>=0&&inertiaStart>pendulumStart);for(const call of calls)assert.ok(call.index>pendulumStart&&call.index<inertiaStart);
 const crossing=source.indexOf("mark('Unloaded lower bridge crossed on actual deck support')",pendulumStart);
 const boarding=source.indexOf("'Pressure-driven upper car boarding window'",crossing);
 const jump=source.indexOf('await jump();worldMove(0,1)',boarding);
 const landing=source.indexOf("'Upper return landing'",jump);
 const retained=source.indexOf("'Actual pressure lift ride and upper contact shelf did not retain the car'",landing);
 const returnStair=source.indexOf("'Upper catch did not open return stair'",retained);
 assert.ok(crossing<calls[0].index&&calls[0].index<boarding);
 assert.ok(boarding<jump&&jump<landing&&landing<calls[1].index&&calls[1].index<retained);
 assert.ok(retained<calls[2].index&&calls[2].index<returnStair);
 assert.equal(calls.some(call=>call.index>=boarding&&call.index<=landing),false,'camera observation must not pause boarding, supported ride, launch or landing');
});
