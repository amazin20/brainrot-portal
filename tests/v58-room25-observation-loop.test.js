import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as THREE from 'three';
import {room25LoadedObservation,room25NearObservationLoop} from '../scripts/lib/room25-near-observation-loop.mjs';

// Command mocks exercise orchestration, not native physics or GPU visibility.
class ProductionVector extends THREE.Vector3{}
const json=value=>JSON.parse(JSON.stringify(value));
const portable=fn=>vm.runInNewContext('('+fn.toString()+')',{});
const frozenVector=(...args)=>Object.freeze(new ProductionVector(...args));
const valueOf=args=>{const values=args.map(v=>v?.toArray?.()??v);return values.length===1?values[0]:values;};

test('portable observation helpers expose only ordinary walk, look, wait and charged aim inputs',()=>{
 const allowed=new Set(['walk','look','wait','aim']);
 for(const helper of [room25LoadedObservation,room25NearObservationLoop]){
  const source=helper.toString();
  assert.doesNotMatch(source,/\bclearPortals\b|(['"])clear\1/,'Unmapped clear APIs and clear commands cannot establish ordinary UI evidence');
  const dispatched=[...source.matchAll(/\binput\(\s*(['"])([^'"]+)\1/g)].map(match=>match[2]);
  assert.ok(dispatched.length>0,'The helper must dispatch explicit ordinary command kinds');
  for(const kind of dispatched)assert.ok(allowed.has(kind),'Nonordinary observation command: '+kind);
  for(const call of source.matchAll(/\bd\.\s*([A-Za-z_$][\w$]*)\s*\(/g))assert.ok(allowed.has(call[1]),'Nonordinary driver method: '+call[1]);
 }
});

function fixture(options={}){
 let inCommand=false,aims=0,dark=false;
 const commands=[],records=[],phases=[],lookArguments=[];
 const guarded=object=>new Proxy(object,{set(target,key,value){assert.equal(inCommand,true,'helper directly wrote '+String(key));return Reflect.set(target,key,value);}});
 const world=guarded({stepnumber:40}),player=guarded(new ProductionVector(-3,9,-14.5));
 const originalPortal0=Object.freeze({position:frozenVector(16,3,12)}),portals=guarded({ready:true,portals:Object.freeze([originalPortal0])});
 const portalShots=guarded({lastImpact:{valid:true}}),cargo={position:frozenVector(2,5,7)},mirror={position:frozenVector(4,9,11)};
 const freight=frozenVector(10,6,20),relay=frozenVector(1,2,3);
 const core={playerPosition:player,playerGrounded:true,physics:{world},portals,portalShots,cargo};
 for(const name of ['camera','cameraRig','scene','input','yaw','pitch','lens'])Object.defineProperty(core,name,{get(){throw Error('hidden state/lens access: '+name);},set(){throw Error('hidden state/lens write: '+name);}});
 const game=guarded(core),level={state:{optical:{movingMirror:mirror}},panels:{
  'freight-receiver':{getFrame:()=>({center:freight})},'lower-relay':{getFrame:()=>({center:relay})},
 }};
 function command(kind,args,steps,action=()=>{}){
  const entry={kind,value:json(valueOf(args)),firstWorldStep:world.stepnumber};commands.push(entry);inCommand=true;
  try{const result=action();world.stepnumber+=steps;entry.lastWorldStep=world.stepnumber;return result;}finally{inCommand=false;}
 }
 const d={game,level,
  walk:(x,z)=>command('walk',[x,z],3,()=>{player.x=x;player.z=z;}),
  look:point=>command('look',[point],5,()=>{assert.ok(point instanceof ProductionVector,'ordinary look must receive the production Vector');lookArguments.push(point);}),
  wait:seconds=>command('wait',[seconds],seconds*120,()=>{
   if(dark&&seconds===2)player.y=0;
   if(seconds===1&&Object.hasOwn(options,'lowerGrounded'))game.playerGrounded=options.lowerGrounded;
   if(seconds===1&&options.lowerHeight!==undefined)player.y=options.lowerHeight;
   if(seconds===5){player.y=options.upperHeight??9;game.playerGrounded=options.upperGrounded??true;}
  }),
  aim:(slot,point)=>{
   const result=command('aim',[slot,point],7,()=>{
    assert.ok(point instanceof ProductionVector);assert.equal(slot,1,'the existing source portal must be retained');aims++;
    portalShots.lastImpact={valid:Object.hasOwn(options,'aimValidity')?options.aimValidity:true};
    dark=point.equals(new ProductionVector(10,6,21.45));
    return options.aimReturn??true;
   });
   if(options.driverRejectImpact)throw options.driverRejectImpact;
   return result;
  },
 };
 const onPhase=name=>{phases.push({name,worldStep:world.stepnumber,commands:commands.length});};
 const onInput=record=>records.push(json(record));
 return {d,game,level,commands,records,phases,lookArguments,onPhase,onInput,originalPortal0,get aims(){return aims;},snapshot:()=>({cargo:cargo.position.toArray(),mirror:mirror.position.toArray(),freight:freight.toArray(),relay:relay.toArray(),portal0:originalPortal0.position.toArray()})};
}

test('loaded observation serializes independently and records only walk, midpoint look and two-second wait',()=>{
 for(const run of [room25LoadedObservation,portable(room25LoadedObservation)]){const f=fixture(),before=f.snapshot();run(f.d,f.onPhase,f.onInput);
  assert.deepEqual(f.records,[
   {kind:'walk',value:[-7,8.7],firstWorldStep:40,lastWorldStep:43},
   {kind:'walk',value:[-3,6],firstWorldStep:43,lastWorldStep:46},
   {kind:'look',value:[3,7,9],firstWorldStep:46,lastWorldStep:51},
   {kind:'wait',value:2,firstWorldStep:51,lastWorldStep:291},
  ]);
  assert.deepEqual(f.phases,[{name:'loaded-support',worldStep:51,commands:3}]);assert.deepEqual(f.snapshot(),before);
  assert.notEqual(f.lookArguments[0],f.game.cargo.position);assert.notEqual(f.lookArguments[0],f.level.state.optical.movingMirror.position);
 }
});

test('loaded midpoint reads actual cargo and mirror positions after ordinary positioning completes',()=>{
 const f=fixture(),walk=f.d.walk;f.d.walk=(...args)=>{walk(...args);if(args[0]===-3){f.game.cargo.position=frozenVector(10,8,6);f.level.state.optical.movingMirror.position=frozenVector(4,2,12);}};
 portable(room25LoadedObservation)(f.d,f.onPhase,f.onInput);assert.deepEqual(f.records[2].value,[7,5,9]);
});

const LOOP_COMMANDS=[
 ['walk',[-14,-13]],['walk',[-14,-10]],['walk',[-7,-10]],['walk',[-8.6,7.9]],['look',[4,9,11]],['wait',2],
 ['walk',[-7,-10]],['walk',[-14,-10]],['walk',[-14,-13]],['aim',[1,[10,6,21.45]]],['walk',[-14,-8.5]],['look',[4,7.8,11]],['wait',2],
 ['walk',[-20,-13]],['walk',[-20,-10]],['wait',1],['walk',[-14,-10]],['walk',[-11.8,7.9]],['aim',[1,[1,2,3]]],['look',[4,9,11]],['wait',2],
 ['walk',[-14,7.9]],['walk',[-14,-10]],['wait',5],['walk',[-14,-13]],['walk',[-6,-13]],['walk',[-3,-14.5]],
];
test('full near loop preserves the approved ordinary command order, actual clocks and three phase windows',()=>{
 for(const run of [room25NearObservationLoop,portable(room25NearObservationLoop)]){const f=fixture(),before=f.snapshot();run(f.d,f.onPhase,f.onInput);
  assert.deepEqual(f.commands.map(({kind,value})=>[kind,value]),LOOP_COMMANDS);
  assert.deepEqual(f.records.map(({kind,value})=>[kind,value]),LOOP_COMMANDS);
  let step=40;for(const [i,record]of f.records.entries()){
   assert.equal(record.firstWorldStep,step);step+=record.kind==='wait'?record.value*120:({walk:3,look:5,aim:7})[record.kind];
   assert.equal(record.lastWorldStep,step);assert.equal(record.lastWorldStep,f.commands[i].lastWorldStep);
   if(record.kind==='aim')assert.equal(record.accepted,true);
  }
  assert.equal(step,1560);assert.deepEqual(f.phases,[{name:'lit-gallery',worldStep:57,commands:5},{name:'dark-return',worldStep:321,commands:12},{name:'relight-ascent',worldStep:705,commands:20}]);
  assert.deepEqual(f.records.filter(r=>r.kind==='aim'),[
   {kind:'aim',value:[1,[10,6,21.45]],firstWorldStep:306,lastWorldStep:313,accepted:true},
   {kind:'aim',value:[1,[1,2,3]],firstWorldStep:693,lastWorldStep:700,accepted:true},
  ]);
  assert.deepEqual(f.snapshot(),before);assert.equal(f.aims,2);assert.equal(f.game.portals.portals[0],f.originalPortal0);assert.equal(f.game.portals.ready,true);assert.equal(f.game.playerPosition.y,9);
 }
});

test('a rejected actual charged-portal driver stops before the dark phase without forging an accepted input',()=>{
 const rejected=Error('actual portal impact rejected by native driver'),f=fixture({driverRejectImpact:rejected,aimValidity:false});
 assert.throws(()=>portable(room25NearObservationLoop)(f.d,f.onPhase,f.onInput),error=>error===rejected);
 assert.equal(f.commands.length,10);assert.equal(f.commands.at(-1).kind,'aim');assert.equal(f.records.length,9);assert.equal(f.game.physics.world.stepnumber,313);
 assert.equal(f.records.some(r=>r.kind==='aim'),false);assert.deepEqual(f.phases.map(p=>p.name),['lit-gallery']);assert.equal(f.game.portals.portals[0],f.originalPortal0);
});

test('portal-shot acceptance comes from the actual resolved impact, never the driver return value',()=>{
 const valid=fixture({aimReturn:false});portable(room25NearObservationLoop)(valid.d,valid.onPhase,valid.onInput);assert.ok(valid.records.filter(r=>r.kind==='aim').every(r=>r.accepted===true));
 for(const aimValidity of [false,'true',undefined]){const f=fixture({aimValidity});assert.throws(()=>portable(room25NearObservationLoop)(f.d,f.onPhase,f.onInput),/charged portal impact was rejected/);
  assert.deepEqual(f.records.at(-1),{kind:'aim',value:[1,[10,6,21.45]],firstWorldStep:306,lastWorldStep:313,accepted:false});
  assert.equal(f.commands.length,10);assert.deepEqual(f.phases.map(p=>p.name),['lit-gallery']);}
});

test('actual lower-floor grounding and height remain mandatory after the dark return',()=>{
 for(const options of [{lowerGrounded:false},{lowerHeight:.100001}]){const f=fixture(options);assert.throws(()=>portable(room25NearObservationLoop)(f.d,f.onPhase,f.onInput),/actual lower floor/);assert.equal(f.aims,1);assert.equal(f.records.at(-1).kind,'wait');assert.equal(f.records.at(-1).value,1);}
});

test('actual first passenger grounding and gallery height remain mandatory before final return walk',()=>{
 for(const options of [{upperGrounded:false},{upperHeight:8.9699}]){const f=fixture(options);assert.throws(()=>portable(room25NearObservationLoop)(f.d,f.onPhase,f.onInput),/first passenger car/);assert.equal(f.commands.at(-1).kind,'wait');assert.equal(f.commands.at(-1).value,5);assert.equal(f.commands.length,24);}
});

test('command and phase callback errors propagate without fallback state or lens changes',()=>{
 const f=fixture(),error=Error('ordinary look rejected');f.d.look=()=>{throw error;};assert.throws(()=>portable(room25LoadedObservation)(f.d,f.onPhase,f.onInput),e=>e===error);assert.equal(f.records.length,2);
 const phase=fixture(),phaseError=Error('capture phase rejected');assert.throws(()=>portable(room25LoadedObservation)(phase.d,()=>{throw phaseError;},phase.onInput),e=>e===phaseError);assert.equal(phase.records.length,3);assert.equal(phase.game.physics.world.stepnumber,51);
});

test('each independently serialized helper works with optional callbacks omitted',()=>{
 const loaded=fixture();portable(room25LoadedObservation)(loaded.d);assert.equal(loaded.commands.length,4);
 const loop=fixture();
 portable(room25NearObservationLoop)(loop.d);assert.equal(loop.commands.length,27);
});
