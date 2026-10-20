import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {OPTICS_CAPTURE,OPTICS_VIEWPORTS,opticsCapture,opticsBrowserProfile,assertOpticsViewportObservation,OPTICS_OPEN_SCOPES,OPTICS_HARNESS_FILES,assertOpticsCaptureRows,assertOpticsRunProvenance,opticsMediaMembers,assertOpticsMediaMembers,assertOpticsPlatformPackageBinding} from '../scripts/lib/optics-native-proof.mjs';

const source=fs.readFileSync(new URL('../scripts/qa-optics-native.mjs',import.meta.url),'utf8'),tree=parseAst(source);
const observer=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='observeOpticsNativeBrowser')?.declaration;
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
 assert.deepEqual(nodeOnly(observerText.replace('...openScopes,pass:true','...OPTICS_OPEN_SCOPES,pass:true')),['OPTICS_OPEN_SCOPES']);
 assert.deepEqual(nodeOnly(observerText.replace('g.render();','g.render();binding.source.commit;')),['binding']);
 assert.equal(OPTICS_HARNESS_FILES.includes('scripts/qa-optics-native.mjs'),true);
 assert.equal(OPTICS_HARNESS_FILES.includes('tests/optics-native-proof.test.js'),true);
});

test('actual page.evaluate transfers every contract and scope as data',()=>{
 const calls=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='page'&&n.callee.property.name==='evaluate'&&n.arguments[0]?.name==='observeOpticsNativeBrowser')calls.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);}walk(tree);
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
 const args={room:31,capture:OPTICS_CAPTURE,captureViewport:'landscape',openScopes:OPTICS_OPEN_SCOPES};
 await assert.rejects(run(args),/Fresh normal Foundation room Play/);
 for(const k of Object.keys(OPTICS_OPEN_SCOPES)){await assert.rejects(run({...args,openScopes:{...OPTICS_OPEN_SCOPES,[k]:true}}),/Exact false-only/);const missing={...OPTICS_OPEN_SCOPES};delete missing[k];await assert.rejects(run({...args,openScopes:missing}),/Exact false-only/);}
 await assert.rejects(run({...args,openScopes:{...OPTICS_OPEN_SCOPES,sourceAccepted:false}}),/Exact false-only/);
 await assert.rejects(run({...args,capture:{...OPTICS_CAPTURE,fps:4}}),/Exact native capture contract/);
});

// Small synthetic cadence units, never written as a recording or SOURCE proof.
function cadenceUnit(lastVisualFrame=7){
 const resetCounts={resetRun:0,respawn:0,resetCargo:0,levelReset:0};
 const state=n=>({visualFrame:n,worldStep:n===lastVisualFrame?n*2-1:n*2,physicsSteps:n===lastVisualFrame?n*2-1:n*2,seconds:(n===lastVisualFrame?n*2-1:n*2)/120,state:n===lastVisualFrame?'won':'playing',edition:'foundation',level:31,id:'cadence-unit',cargoBodyId:7,cargoShapeId:8,cargoMass:3.2,cargoDynamic:true,player:[0,0,n],cargo:[0,.4,n],cargoVelocity:[0,0,0],cargoQuaternion:[0,0,0,1],camera:[0,2,n+3],cameraQuaternion:[0,0,0,1],cameraFov:57,resetCounts:{...resetCounts},actualProductionWinPredicate:n===lastVisualFrame,mechanisms:{}});
 const indices=[];for(let n=0;n<=lastVisualFrame;n+=5)indices.push(n);if(indices.at(-1)!==lastVisualFrame)indices.push(lastVisualFrame);
 const rows=indices.map((n,index)=>({index,terminal:n===lastVisualFrame&&n%5!==0,state:state(n)})),physicsSteps=lastVisualFrame*2-1;
 const route={kind:'optics-complete-ordinary-input-native-route',...OPTICS_OPEN_SCOPES,pass:true,complete:true,level:31,index:30,edition:'foundation',id:'cadence-unit',bodyId:7,shapeId:8,cargoMass:3.2,initialState:rows[0].state,lastState:rows.at(-1).state,lastVisualFrame,frames:lastVisualFrame+1,physicsSteps,seconds:physicsSteps/120,postStepStart:0,postStepFinish:physicsSteps,observed:{postSteps:physicsSteps,visualUpdates:lastVisualFrame,identityChecks:physicsSteps+lastVisualFrame+1},resetCounts,driver:{pass:true,level:31,id:'cadence-unit',frames:lastVisualFrame,resets:0,respawns:0}};
 return{route,rows};
}
test('native cadence accepts regular frames plus one real off-stride terminal without padding',()=>{
 for(const n of [7,10,11,15]){const{route,rows}=cadenceUnit(n);assert.equal(assertOpticsCaptureRows(rows,route),rows);}
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
 for(const mutate of mutations){const x=structuredClone(cadenceUnit());mutate(x);assert.throws(()=>assertOpticsCaptureRows(x.rows,x.route));}
});

test('native SOURCE/capture/provider IDs retain real GitHub values up to the positive safe-integer limit',()=>{
 const prefix=()=>({sourceReview:{runId:38984486049,runAttempt:1},captureRun:{runId:38996000001,runAttempt:1},providerRun:{commit:'a'.repeat(40),runId:38996000001,runAttempt:1}});
 for(const value of [38984486049,Number.MAX_SAFE_INTEGER]){const r=prefix();r.sourceReview.runId=r.captureRun.runId=r.providerRun.runId=value;assert.equal(assertOpticsRunProvenance(r),r);}
 const attempts=prefix();for(const name of ['sourceReview','captureRun','providerRun'])attempts[name].runAttempt=Number.MAX_SAFE_INTEGER;assert.doesNotThrow(()=>assertOpticsRunProvenance(attempts));
 for(const value of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,NaN,Infinity,'38984486049'])for(const name of ['sourceReview','captureRun','providerRun'])for(const key of ['runId','runAttempt']){const r=prefix();r[name][key]=value;assert.throws(()=>assertOpticsRunProvenance(r),new RegExp(name),name+'.'+key);}
 const mismatch=prefix();mismatch.providerRun.runId++;assert.throws(()=>assertOpticsRunProvenance(mismatch));const wrongCommit=prefix();wrongCommit.providerRun.commit='release';assert.throws(()=>assertOpticsRunProvenance(wrongCommit));
});

test('the actual native UI reader normalizes arrays and Vector3 without accepting an offset or mutating coordinates',()=>{
 const readerNode=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='readOpticsNativeStart')?.declaration;assert.equal(readerNode?.type,'FunctionDeclaration');
 const text=source.slice(readerNode.start,readerNode.end);assert.deepEqual(nodeOnly(text),[]);const read=vm.runInNewContext('('+text+')');
 const player=[1,0,7],cargo=[2,.5,8],vector=a=>({toArray:()=>a.slice()});
 for(const asVector of [false,true]){
  const g={playerPosition:vector(player),cargo:{position:vector(cargo)},firstLevel:{spawn:asVector?vector(player):player.slice(),cargoSpawn:asVector?vector(cargo):cargo.slice()}},before=JSON.stringify(g);
  let r=read(g);assert.equal(r.normalSpawn,true);assert.equal(r.normalCargoSpawn,true);assert.equal(r.playerSpawnDistance,0);assert.equal(r.cargoSpawnDistance,0);assert.equal(JSON.stringify(g),before);
  g.firstLevel.spawn=player.map((n,i)=>n+(i===0?1e-7:0));r=read(g);assert.equal(r.normalSpawn,false);assert.equal(r.normalCargoSpawn,true);
  g.firstLevel.spawn=player;g.firstLevel.cargoSpawn=[2,.5,NaN];r=read(g);assert.equal(r.normalSpawn,true);assert.equal(r.normalCargoSpawn,false);assert.equal(r.cargoSpawnDistance,null);
 }
});

test('native Optics cadence accepts only exact rooms31–40 and the declared landscape profile',()=>{
 const at=level=>{const unit=cadenceUnit();unit.route.level=level;unit.route.index=level-1;unit.route.driver.level=level;for(const row of unit.rows)row.state.level=level;return unit;};
 for(const level of [31,35,36,39,40]){const x=at(level);assert.equal(assertOpticsCaptureRows(x.rows,x.route),x.rows);assert.deepEqual(opticsCapture(level),{fps:12,stride:5,width:640,height:360});}
 for(const level of [1,17,21,30,41,51,NaN,35.5,'35']){const x=at(level);assert.throws(()=>assertOpticsCaptureRows(x.rows,x.route));assert.throws(()=>opticsCapture(level));}
 assert.deepEqual(Object.keys(OPTICS_VIEWPORTS),['landscape']);assert.equal(Object.isFrozen(OPTICS_VIEWPORTS),true);
 for(const view of ['portrait','classic','__proto__','toString','constructor','wide','',null,{},['landscape']])assert.throws(()=>opticsCapture(35,view));
 assert.deepEqual(opticsBrowserProfile(35),{width:640,height:360,deviceScaleFactor:1,isMobile:false,hasTouch:false});
});

test('serialized observer rejects neighbouring rooms and arbitrary capture dimensions before touching the game',async()=>{
 const run=args=>vm.runInNewContext('('+observerText+')('+JSON.stringify(args)+')',{window:{}},{timeout:1000});
 const args={room:35,capture:OPTICS_CAPTURE,captureViewport:'landscape',openScopes:OPTICS_OPEN_SCOPES};
 await assert.rejects(run(args),/Fresh normal Foundation room Play/);
 const mutations=[x=>delete x.captureViewport,x=>x.captureViewport='portrait',x=>x.captureViewport='__proto__',x=>x.capture.width++,x=>x.capture.height++,x=>x.capture.fps=24,x=>x.capture.stride=10,x=>x.capture.extra=1,x=>x.room=30,x=>x.room=41];
 for(const mutate of mutations){const x=structuredClone(args);mutate(x);await assert.rejects(run(x),/Exact native capture contract/);}
});

test('actual viewport observation rejects layout, device, DPR, buffer and aspect substitution',()=>{
 const value={innerWidth:640,innerHeight:360,devicePixelRatio:1,pointerCoarse:false,pointerFine:true,pointerNone:false,maxTouchPoints:0,containerWidth:640,containerHeight:360,canvasWidth:640,canvasHeight:360,rendererPixelRatio:1,cameraAspect:640/360};
 assert.equal(assertOpticsViewportObservation(value,{room:35,viewport:'landscape'}),value);
 const mutations=[v=>v.innerWidth++,v=>v.innerHeight++,v=>v.containerWidth++,v=>v.containerHeight++,v=>v.canvasWidth++,v=>v.canvasHeight++,v=>v.devicePixelRatio=2,v=>v.rendererPixelRatio=.5,v=>v.cameraAspect=.5,v=>v.pointerCoarse=true,v=>v.pointerNone=true,v=>v.maxTouchPoints=1,v=>v.maxTouchPoints=.5,v=>delete v.canvasHeight];
 for(const mutate of mutations){const v={...value};mutate(v);assert.throws(()=>assertOpticsViewportObservation(v,{room:35,viewport:'landscape'}));}
});

test('closed media packet has exactly13 named members and excludes checker material',()=>{
 const names=opticsMediaMembers(35);assert.equal(names.length,13);assert.equal(assertOpticsMediaMembers(names,35),names);
 assert.equal(names.filter(name=>name.endsWith('.png')).length,3);assert.equal(names.filter(name=>name.endsWith('.mp4')).length,1);
 assertOpticsMediaMembers(names.filter(name=>name!=='closed-media-member-inventory.json'),35,{beforeInventory:true});
 for(const altered of [names.slice(1),[...names,'yandex-debug-checker-report.json'],names.map(name=>name.replace('room-35','room-39')),[...names.slice(1),names[1]]])assert.throws(()=>assertOpticsMediaMembers(altered,35));
});

test('TEST Yandex package is paired to distinct consumer bytes from the exact same source',()=>{
 const source={commit:'a'.repeat(40),tree:'b'.repeat(40),sourceInputsSha256:'c'.repeat(64)},review={mode:'yandex-review-test',commit:source.commit,sourceInputsSha256:source.sourceInputsSha256,packageFilesSha256:'d'.repeat(64)},consumer={mode:'consumer',commit:source.commit,sourceInputsSha256:source.sourceInputsSha256,packageFilesSha256:'e'.repeat(64)};
 const binding={source,package:{...review},platformPackages:{kind:'yandex-review-campaign-package-binding',source:{...source},review,consumer,sourceAccepted:false,publicationAccepted:false,liveSdkAccepted:false,moderationAccepted:false}};
 assert.equal(assertOpticsPlatformPackageBinding(binding),binding);
 const mutations=[b=>b.package.mode='consumer',b=>b.platformPackages.review.mode='consumer',b=>b.platformPackages.consumer.mode='yandex-review-test',b=>b.platformPackages.consumer.commit='f'.repeat(40),b=>b.platformPackages.consumer.sourceInputsSha256='f'.repeat(64),b=>b.platformPackages.consumer.packageFilesSha256=b.platformPackages.review.packageFilesSha256,b=>b.platformPackages.source.tree='f'.repeat(40),b=>b.platformPackages.liveSdkAccepted=true];
 for(const mutate of mutations){const b=structuredClone(binding);mutate(b);assert.throws(()=>assertOpticsPlatformPackageBinding(b));}
});

test('native bootstrap declares campaign access and installs the original checker before navigation',()=>{
 const calls=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(n.type==='CallExpression')calls.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);}walk(tree);
 const named=name=>calls.find(n=>n.callee.name===name),member=name=>calls.find(n=>n.callee.type==='MemberExpression'&&n.callee.object.name==='page'&&n.callee.property.name===name);
 assert.ok(named('campaignAccessFixture').start<member('goto').start);assert.ok(member('evaluateOnNewDocument').start<member('goto').start);assert.ok(named('installPinnedYandexChecker').start<member('goto').start);assert.ok(member('setViewport').start<member('goto').start);
 assert.ok(named('captureYandexChecker').start>calls.find(n=>n.callee.type==='MemberExpression'&&n.callee.object.name==='page'&&n.callee.property.name==='evaluate'&&n.arguments[0]?.name==='observeOpticsNativeBrowser').start);
 assert.equal(named('captureYandexChecker').arguments[1].properties.find(p=>p.key.name==='outputDirectory').value.name,'checkerOut');
 for(const file of ['scripts/lib/campaign-access-fixture.mjs','scripts/lib/yandex-debug-checker.mjs','scripts/qa-campaign-platform-route.mjs'])assert.ok(OPTICS_HARNESS_FILES.includes(file));
});


