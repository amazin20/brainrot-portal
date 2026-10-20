import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {BIOSPHERE_CAPTURE,BIOSPHERE_VIEWPORTS,biosphereCapture,biosphereBrowserProfile,assertBiosphereViewportObservation,BIOSPHERE_OPEN_SCOPES,BIOSPHERE_HARNESS_FILES,assertBiosphereCaptureRows,assertBiosphereRunProvenance} from '../scripts/lib/biosphere-native-proof.mjs';

const source=fs.readFileSync(new URL('../scripts/qa-biosphere-native.mjs',import.meta.url),'utf8'),tree=parseAst(source);
const observer=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='observeBiosphereNativeBrowser')?.declaration;
assert.equal(observer?.type,'FunctionDeclaration');const observerText=source.slice(observer.start,observer.end);

// Analyze the actual serialized function, including nested late completion
// callbacks. A local binding in a sibling scope cannot mask a Node closure.
function freeBindings(text){
 const ast=parseAst('('+text+')'),references=[],scope=(parent,isFunction=false)=>({parent,isFunction,names:new Set()}),root=scope(null,true);
 function declare(p,s){if(!p)return;if(p.type==='Identifier'){s.names.add(p.name);return;}if(p.type==='RestElement'){declare(p.argument,s);return;}if(p.type==='AssignmentPattern'){declare(p.left,s);walk(p.right,s);return;}if(p.type==='ArrayPattern'){p.elements.forEach(x=>declare(x,s));return;}if(p.type==='ObjectPattern'){for(const x of p.properties){if(x.type==='RestElement')declare(x.argument,s);else{if(x.computed)walk(x.key,s);declare(x.value,s);}}return;}throw Error('Unhandled pattern '+p.type);}
 function walk(n,s){if(!n)return;if(Array.isArray(n)){n.forEach(x=>walk(x,s));return;}switch(n.type){
  case'Identifier':references.push({name:n.name,scope:s});return;
  case'FunctionDeclaration':case'FunctionExpression':case'ArrowFunctionExpression':{if(n.type==='FunctionDeclaration'&&n.id)declare(n.id,s);const inner=scope(s,true);if(n.id)declare(n.id,inner);if(n.type!=='ArrowFunctionExpression')inner.names.add('arguments');n.params.forEach(p=>declare(p,inner));walk(n.body,inner);return;}
  case'BlockStatement':walk(n.body,scope(s));return;
  case'VariableDeclaration':{let target=s;if(n.kind==='var')while(!target.isFunction&&target.parent)target=target.parent;for(const d of n.declarations)declare(d.id,target);for(const d of n.declarations)walk(d.init,s);return;}
  case'ForStatement':{const inner=scope(s);walk(n.init,inner);walk(n.test,inner);walk(n.update,inner);walk(n.body,inner);return;}
  case'ForOfStatement':case'ForInStatement':{const inner=scope(s);walk(n.left,inner);walk(n.right,inner);walk(n.body,inner);return;}
  case'CatchClause':{const inner=scope(s);declare(n.param,inner);walk(n.body,inner);return;}
  case'MemberExpression':walk(n.object,s);if(n.computed)walk(n.property,s);return;
  case'Property':if(n.computed)walk(n.key,s);walk(n.value,s);return;
  case'LabeledStatement':walk(n.body,s);return;
  case'BreakStatement':case'ContinueStatement':case'MetaProperty':return;
  default:for(const v of Object.values(n))if(v&&typeof v==='object'&&(Array.isArray(v)||typeof v.type==='string'))walk(v,s);
 }}
 walk(ast,root);return[...new Set(references.filter(r=>{for(let s=r.scope;s;s=s.parent)if(s.names.has(r.name))return false;return true;}).map(r=>r.name))].sort();
}
const browserGlobals=new Set(['Array','ArrayBuffer','Error','JSON','Math','Number','Object','Promise','Set','String','TextEncoder','Uint8Array','crypto','document','eval','window']);
const nodeOnly=text=>freeBindings(text).filter(n=>!browserGlobals.has(n));

test('the actual full native observer has no Node closure, including late completion paths',()=>{
 assert.equal(observer.async,true);assert.deepEqual(nodeOnly(observerText),[]);
 assert.deepEqual(nodeOnly(observerText.replace('...openScopes,pass:true','...BIOSPHERE_OPEN_SCOPES,pass:true')),['BIOSPHERE_OPEN_SCOPES']);
 assert.deepEqual(nodeOnly(observerText.replace('g.render();','g.render();binding.source.commit;')),['binding']);
 assert.equal(BIOSPHERE_HARNESS_FILES.includes('scripts/qa-biosphere-native.mjs'),true);
 assert.equal(BIOSPHERE_HARNESS_FILES.includes('tests/biosphere-native-proof.test.js'),true);
});

test('actual page.evaluate transfers every contract and scope as data',()=>{
 const calls=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='page'&&n.callee.property.name==='evaluate'&&n.arguments[0]?.name==='observeBiosphereNativeBrowser')calls.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);}walk(tree);
 assert.equal(calls.length,1);assert.deepEqual(calls[0].arguments[1].properties.map(p=>p.key.name).sort(),['bounds','capture','captureViewport','journeyURL','materialGuardSource','openScopes','room','viewportReaderSource']);
});

test('native observation never assigns a camera lens, actor pose, mechanism target or win state',()=>{
 const forbidden=[];
 function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}
  if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'){
   const text=observerText.slice(n.left.start-1,n.left.end-1),property=n.left.property.name;
   if(['fov','near','far','aspect','zoom','state','position','quaternion','target','opened','pressed','solved'].includes(property))forbidden.push(text);
  }
  if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&['set','copy','setFromEuler','lookAt','applyQuaternion','applyMatrix4'].includes(n.callee.property.name)){
   const object=observerText.slice(n.callee.object.start-1,n.callee.object.end-1);
   if(/(?:\bcamera\b|\bbody\b|playerPosition|cargo\.position)/.test(object))forbidden.push(object);
  }
  for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);
 }
 walk(parseAst('('+observerText+')'));assert.deepEqual(forbidden,[]);
});

test('serialized full observer rejects forged broad acceptance before reading the game',async()=>{
 const run=args=>vm.runInNewContext('('+observerText+')('+JSON.stringify(args)+')',{window:{}},{timeout:1000});
 const args={room:21,capture:BIOSPHERE_CAPTURE,captureViewport:'landscape',openScopes:BIOSPHERE_OPEN_SCOPES};
 await assert.rejects(run(args),/Fresh normal Foundation room Play/);
 for(const k of Object.keys(BIOSPHERE_OPEN_SCOPES)){await assert.rejects(run({...args,openScopes:{...BIOSPHERE_OPEN_SCOPES,[k]:true}}),/Exact false-only/);const missing={...BIOSPHERE_OPEN_SCOPES};delete missing[k];await assert.rejects(run({...args,openScopes:missing}),/Exact false-only/);}
 await assert.rejects(run({...args,openScopes:{...BIOSPHERE_OPEN_SCOPES,sourceAccepted:false}}),/Exact false-only/);
 await assert.rejects(run({...args,capture:{...BIOSPHERE_CAPTURE,fps:4}}),/Exact native capture contract/);
});

// Small synthetic cadence units, never written as a recording or SOURCE proof.
function cadenceUnit(lastVisualFrame=7){
 const resetCounts={resetRun:0,respawn:0,resetCargo:0,levelReset:0};
 const state=n=>({visualFrame:n,worldStep:n===lastVisualFrame?n*2-1:n*2,physicsSteps:n===lastVisualFrame?n*2-1:n*2,seconds:(n===lastVisualFrame?n*2-1:n*2)/120,state:n===lastVisualFrame?'won':'playing',edition:'foundation',level:21,id:'cadence-unit',cargoBodyId:7,cargoShapeId:8,cargoMass:3.2,cargoDynamic:true,player:[0,0,n],cargo:[0,.4,n],cargoVelocity:[0,0,0],cargoQuaternion:[0,0,0,1],camera:[0,2,n+3],cameraQuaternion:[0,0,0,1],cameraFov:57,resetCounts:{...resetCounts},actualProductionWinPredicate:n===lastVisualFrame,mechanisms:{}});
 const indices=[];for(let n=0;n<=lastVisualFrame;n+=5)indices.push(n);if(indices.at(-1)!==lastVisualFrame)indices.push(lastVisualFrame);
 const rows=indices.map((n,index)=>({index,terminal:n===lastVisualFrame&&n%5!==0,state:state(n)})),physicsSteps=lastVisualFrame*2-1;
 const route={kind:'biosphere-complete-ordinary-input-native-route',...BIOSPHERE_OPEN_SCOPES,pass:true,complete:true,level:21,index:20,edition:'foundation',id:'cadence-unit',bodyId:7,shapeId:8,cargoMass:3.2,initialState:rows[0].state,lastState:rows.at(-1).state,lastVisualFrame,frames:lastVisualFrame+1,physicsSteps,seconds:physicsSteps/120,postStepStart:0,postStepFinish:physicsSteps,observed:{postSteps:physicsSteps,visualUpdates:lastVisualFrame,identityChecks:physicsSteps+lastVisualFrame+1},resetCounts,driver:{pass:true,level:21,id:'cadence-unit',frames:lastVisualFrame,resets:0,respawns:0}};
 return{route,rows};
}
test('native cadence accepts regular frames plus one real off-stride terminal without padding',()=>{
 for(const n of [7,10,11,15]){const{route,rows}=cadenceUnit(n);assert.equal(assertBiosphereCaptureRows(rows,route),rows);}
});
test('native cadence rejects missing/repeated frames, fake terminal and reset/identity mutations',()=>{
 const mutations=[
  x=>x.rows.splice(1,1),x=>x.rows[1].state.visualFrame++,x=>x.rows.at(-1).terminal=false,
  x=>x.rows.at(-1).state.actualProductionWinPredicate=false,x=>x.rows[1].state.cargoBodyId++,
  x=>x.route.resetCounts.resetRun++,x=>x.rows[1].state.resetCounts.resetCargo++,
  x=>x.route.observed.postSteps--,x=>x.route.driver.frames--,x=>x.rows[1].state.physicsSteps--,
  x=>x.route.physicsSteps=36001,x=>x.rows[1].state.camera[1]=NaN,
  x=>x.rows[1].state.cargoVelocity=null,x=>x.rows[1].state.cargoVelocity[2]=Infinity,
 ];
 for(const mutate of mutations){const x=structuredClone(cadenceUnit());mutate(x);assert.throws(()=>assertBiosphereCaptureRows(x.rows,x.route));}
});

test('native SOURCE/capture/provider IDs retain real GitHub values up to the positive safe-integer limit',()=>{
 const prefix=()=>({sourceReview:{runId:38984486049,runAttempt:1},captureRun:{runId:38996000001,runAttempt:1},providerRun:{commit:'a'.repeat(40),runId:38996000001,runAttempt:1}});
 for(const value of [38984486049,Number.MAX_SAFE_INTEGER]){const r=prefix();r.sourceReview.runId=r.captureRun.runId=r.providerRun.runId=value;assert.equal(assertBiosphereRunProvenance(r),r);}
 const attempts=prefix();for(const name of ['sourceReview','captureRun','providerRun'])attempts[name].runAttempt=Number.MAX_SAFE_INTEGER;assert.doesNotThrow(()=>assertBiosphereRunProvenance(attempts));
 for(const value of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,NaN,Infinity,'38984486049'])for(const name of ['sourceReview','captureRun','providerRun'])for(const key of ['runId','runAttempt']){const r=prefix();r[name][key]=value;assert.throws(()=>assertBiosphereRunProvenance(r),new RegExp(name),name+'.'+key);}
 const mismatch=prefix();mismatch.providerRun.runId++;assert.throws(()=>assertBiosphereRunProvenance(mismatch));const wrongCommit=prefix();wrongCommit.providerRun.commit='release';assert.throws(()=>assertBiosphereRunProvenance(wrongCommit));
});

test('the actual native UI reader normalizes arrays and Vector3 without accepting an offset or mutating coordinates',()=>{
 const readerNode=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='readBiosphereNativeStart')?.declaration;assert.equal(readerNode?.type,'FunctionDeclaration');
 const text=source.slice(readerNode.start,readerNode.end);assert.deepEqual(nodeOnly(text),[]);const read=vm.runInNewContext('('+text+')');
 const player=[1,0,7],cargo=[2,.5,8],vector=a=>({toArray:()=>a.slice()});
 for(const asVector of [false,true]){
  const g={playerPosition:vector(player),cargo:{position:vector(cargo)},firstLevel:{spawn:asVector?vector(player):player.slice(),cargoSpawn:asVector?vector(cargo):cargo.slice()}},before=JSON.stringify(g);
  let r=read(g);assert.equal(r.normalSpawn,true);assert.equal(r.normalCargoSpawn,true);assert.equal(r.playerSpawnDistance,0);assert.equal(r.cargoSpawnDistance,0);assert.equal(JSON.stringify(g),before);
  g.firstLevel.spawn=player.map((n,i)=>n+(i===0?1e-7:0));r=read(g);assert.equal(r.normalSpawn,false);assert.equal(r.normalCargoSpawn,true);
  g.firstLevel.spawn=player;g.firstLevel.cargoSpawn=[2,.5,NaN];r=read(g);assert.equal(r.normalSpawn,true);assert.equal(r.normalCargoSpawn,false);assert.equal(r.cargoSpawnDistance,null);
 }
});


test('native cadence binds visible rooms 21–30 and camera17 and rejects neighbouring or earlier chapter identities',()=>{
 const at=level=>{const unit=cadenceUnit();unit.route.level=level;unit.route.index=level-1;unit.route.driver.level=level;for(const row of unit.rows)row.state.level=level;return unit;};
 for(const level of [17,21,30]){const x=at(level);assert.equal(assertBiosphereCaptureRows(x.rows,x.route),x.rows);}
 for(const level of [1,10,11,20,31,51]){const x=at(level);assert.throws(()=>assertBiosphereCaptureRows(x.rows,x.route));}
});

test('viewport contract closes chapter captures and all three full camera17 cases',()=>{
 assert.equal(Object.isFrozen(BIOSPHERE_VIEWPORTS),true);
 assert.deepEqual(Object.keys(BIOSPHERE_VIEWPORTS),['landscape','portrait','classic']);
 for(const [view,width,height]of [['landscape',640,360],['portrait',390,844],['classic',800,600]]){
  assert.deepEqual(biosphereCapture(17,view),{fps:12,stride:5,width,height});
  assert.equal(Object.isFrozen(biosphereCapture(17,view)),true);
 }
 for(const room of [21,25,30]){assert.equal(biosphereCapture(room),BIOSPHERE_CAPTURE);for(const view of ['portrait','classic'])assert.throws(()=>biosphereCapture(room,view));}
 for(const room of [11,16,18,20,31,NaN,17.5,'17'])assert.throws(()=>biosphereCapture(room));
 for(const view of ['__proto__','toString','constructor','wide','',null,{},['landscape']])assert.throws(()=>biosphereCapture(17,view));
});

test('serialized observer rejects viewport substitution and arbitrary dimensions before touching the game',async()=>{
 const run=args=>vm.runInNewContext('('+observerText+')('+JSON.stringify(args)+')',{window:{}},{timeout:1000});
 const args={room:17,capture:BIOSPHERE_CAPTURE,captureViewport:'landscape',openScopes:BIOSPHERE_OPEN_SCOPES};
 for(const view of Object.keys(BIOSPHERE_VIEWPORTS))await assert.rejects(run({...args,captureViewport:view,capture:BIOSPHERE_VIEWPORTS[view]}),/Fresh normal Foundation room Play/);
 const mutations=[x=>delete x.captureViewport,x=>x.captureViewport='wide',x=>x.captureViewport='__proto__',x=>x.captureViewport='portrait',x=>x.capture.width++,x=>x.capture.height++,x=>x.capture.fps=24,x=>x.capture.stride=10,x=>x.capture.extra=1,x=>x.room=18,x=>{x.room=21;x.captureViewport='portrait';x.capture={...BIOSPHERE_VIEWPORTS.portrait};}];
 for(const mutate of mutations){const x=structuredClone(args);mutate(x);await assert.rejects(run(x),/Exact native capture contract/);}
});

test('portrait capture chooses real mobile/coarse-pointer layout while both wide profiles retain desktop setup',()=>{
 for(const view of ['landscape','classic']){
  const capture=biosphereCapture(17,view),profile=biosphereBrowserProfile(17,view);
  assert.deepEqual(profile,{width:capture.width,height:capture.height,deviceScaleFactor:1,isMobile:false,hasTouch:false});assert.equal(Object.isFrozen(profile),true);
 }
 assert.deepEqual(biosphereBrowserProfile(17,'portrait'),{width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 assert.throws(()=>biosphereBrowserProfile(21,'portrait'));
 const nodes=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(n.type==='CallExpression')nodes.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);}walk(tree);
 const viewport=nodes.find(n=>n.callee.type==='MemberExpression'&&n.callee.object.name==='page'&&n.callee.property.name==='setViewport');assert.equal(viewport.arguments[0].name,'browserProfile');
 const navigate=nodes.find(n=>n.callee.type==='MemberExpression'&&n.callee.object.name==='page'&&n.callee.property.name==='goto');assert.ok(viewport.start<navigate.start,'Device emulation must precede navigation and production layout');
 const activate=nodes.find(n=>n.callee.name==='activate');assert.equal(activate.arguments[2].object.name,'browserProfile');assert.equal(activate.arguments[2].property.name,'hasTouch','Portrait must use the genuine native tap path');
});

function viewportUnit(view='portrait'){
 const profile=biosphereBrowserProfile(17,view);return {innerWidth:profile.width,innerHeight:profile.height,devicePixelRatio:1,pointerCoarse:profile.hasTouch,pointerFine:!profile.hasTouch,pointerNone:false,maxTouchPoints:profile.hasTouch?1:0,containerWidth:profile.width,containerHeight:profile.height,canvasWidth:profile.width,canvasHeight:profile.height,rendererPixelRatio:1,cameraAspect:profile.width/profile.height};
}
test('actual viewport guard rejects desktop-clamped portrait, faked buffer size, pointer, DPR and camera-aspect substitutions',()=>{
 for(const view of ['portrait','landscape','classic']){const v=viewportUnit(view);assert.equal(assertBiosphereViewportObservation(v,{room:17,viewport:view}),v);}
 const oldDesktop={...viewportUnit(),pointerCoarse:false,pointerFine:true,maxTouchPoints:0,containerHeight:780,canvasHeight:780,cameraAspect:390/780};
 assert.throws(()=>assertBiosphereViewportObservation(oldDesktop,{room:17,viewport:'portrait'}),/containerHeight/);
 const mutations=[v=>v.innerWidth++,v=>v.innerHeight++,v=>v.containerWidth++,v=>v.containerHeight=780,v=>v.canvasWidth++,v=>v.canvasHeight=780,v=>v.devicePixelRatio=2,v=>v.rendererPixelRatio=.5,v=>v.cameraAspect=.5,v=>v.pointerCoarse=false,v=>v.pointerFine=true,v=>v.pointerNone=true,v=>v.maxTouchPoints=0,v=>v.maxTouchPoints=.5,v=>delete v.canvasHeight];
 for(const mutate of mutations){const v=viewportUnit();mutate(v);assert.throws(()=>assertBiosphereViewportObservation(v,{room:17,viewport:'portrait'}));}
 const rendererOnlyWorkaround={...oldDesktop,containerHeight:844,canvasHeight:844,cameraAspect:390/844};assert.throws(()=>assertBiosphereViewportObservation(rendererOnlyWorkaround,{room:17,viewport:'portrait'}),/pointer mode/);
});

test('retained browser viewport reader is closure-free and reads production dimensions without resizing renderer or camera',()=>{
 const node=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='readBiosphereNativeViewport')?.declaration;assert.equal(node?.type,'FunctionDeclaration');const text=source.slice(node.start,node.end);assert.deepEqual(nodeOnly(text),[]);
 const expected=viewportUnit(),game={container:{clientWidth:390,clientHeight:844},renderer:{domElement:{width:390,height:844},getPixelRatio:()=>1},camera:{aspect:390/844}},window={innerWidth:390,innerHeight:844,devicePixelRatio:1,navigator:{maxTouchPoints:1},matchMedia:q=>({matches:q==='(pointer: coarse)'})},before=JSON.stringify(game);
 const actual=vm.runInNewContext('('+text+')(game)',{game,window});assert.equal(JSON.stringify(actual),JSON.stringify(expected));assert.equal(JSON.stringify(game),before);
 const failure=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='runBiosphereNativeQA').declaration;const run=source.slice(failure.start,failure.end);
 assert.match(run,/viewportObservation:\{beforePlay:viewportBeforePlay,playing:viewportPlaying\}/);assert.match(run,/browserProfile,viewportObservation/);assert.match(observerText,/actual:viewport\(\)/);assert.match(observerText,/viewport:viewport\(\)/);
});
