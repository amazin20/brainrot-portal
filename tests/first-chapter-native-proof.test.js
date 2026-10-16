import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {FIRST_CHAPTER_CAPTURE,FIRST_CHAPTER_OPEN_SCOPES,FIRST_CHAPTER_HARNESS_FILES,assertFirstChapterCaptureRows} from '../scripts/lib/first-chapter-native-proof.mjs';

const source=fs.readFileSync(new URL('../scripts/qa-first-chapter-native.mjs',import.meta.url),'utf8'),tree=parseAst(source);
const observer=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='observeFirstChapterNativeBrowser')?.declaration;
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
 assert.deepEqual(nodeOnly(observerText.replace('...openScopes,pass:true','...FIRST_CHAPTER_OPEN_SCOPES,pass:true')),['FIRST_CHAPTER_OPEN_SCOPES']);
 assert.deepEqual(nodeOnly(observerText.replace('g.render();','g.render();binding.source.commit;')),['binding']);
 assert.equal(FIRST_CHAPTER_HARNESS_FILES.includes('scripts/qa-first-chapter-native.mjs'),true);
 assert.equal(FIRST_CHAPTER_HARNESS_FILES.includes('tests/first-chapter-native-proof.test.js'),true);
});

test('actual page.evaluate transfers every contract and scope as data',()=>{
 const calls=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='page'&&n.callee.property.name==='evaluate'&&n.arguments[0]?.name==='observeFirstChapterNativeBrowser')calls.push(n);for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);}walk(tree);
 assert.equal(calls.length,1);assert.deepEqual(calls[0].arguments[1].properties.map(p=>p.key.name).sort(),['bounds','capture','journeyURL','materialGuardSource','openScopes','room']);
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
 const args={room:1,capture:FIRST_CHAPTER_CAPTURE,openScopes:FIRST_CHAPTER_OPEN_SCOPES};
 await assert.rejects(run(args),/Fresh normal Foundation room Play/);
 for(const k of Object.keys(FIRST_CHAPTER_OPEN_SCOPES)){await assert.rejects(run({...args,openScopes:{...FIRST_CHAPTER_OPEN_SCOPES,[k]:true}}),/Exact false-only/);const missing={...FIRST_CHAPTER_OPEN_SCOPES};delete missing[k];await assert.rejects(run({...args,openScopes:missing}),/Exact false-only/);}
 await assert.rejects(run({...args,openScopes:{...FIRST_CHAPTER_OPEN_SCOPES,sourceAccepted:false}}),/Exact false-only/);
 await assert.rejects(run({...args,capture:{...FIRST_CHAPTER_CAPTURE,fps:4}}),/Exact native capture contract/);
});

// Small synthetic cadence units, never written as a recording or SOURCE proof.
function cadenceUnit(lastVisualFrame=7){
 const resetCounts={resetRun:0,respawn:0,resetCargo:0,levelReset:0};
 const state=n=>({visualFrame:n,worldStep:n===lastVisualFrame?n*2-1:n*2,physicsSteps:n===lastVisualFrame?n*2-1:n*2,seconds:(n===lastVisualFrame?n*2-1:n*2)/120,state:n===lastVisualFrame?'won':'playing',edition:'foundation',level:1,id:'cadence-unit',cargoBodyId:7,cargoShapeId:8,cargoMass:3.2,cargoDynamic:true,player:[0,0,n],cargo:[0,.4,n],cargoVelocity:[0,0,0],cargoQuaternion:[0,0,0,1],camera:[0,2,n+3],cameraQuaternion:[0,0,0,1],cameraFov:57,resetCounts:{...resetCounts},actualProductionWinPredicate:n===lastVisualFrame,mechanisms:{}});
 const indices=[];for(let n=0;n<=lastVisualFrame;n+=5)indices.push(n);if(indices.at(-1)!==lastVisualFrame)indices.push(lastVisualFrame);
 const rows=indices.map((n,index)=>({index,terminal:n===lastVisualFrame&&n%5!==0,state:state(n)})),physicsSteps=lastVisualFrame*2-1;
 const route={kind:'first-chapter-complete-ordinary-input-native-route',...FIRST_CHAPTER_OPEN_SCOPES,pass:true,complete:true,level:1,index:0,edition:'foundation',id:'cadence-unit',bodyId:7,shapeId:8,cargoMass:3.2,initialState:rows[0].state,lastState:rows.at(-1).state,lastVisualFrame,frames:lastVisualFrame+1,physicsSteps,seconds:physicsSteps/120,postStepStart:0,postStepFinish:physicsSteps,observed:{postSteps:physicsSteps,visualUpdates:lastVisualFrame,identityChecks:physicsSteps+lastVisualFrame+1},resetCounts,driver:{pass:true,level:1,id:'cadence-unit',frames:lastVisualFrame,resets:0,respawns:0}};
 return{route,rows};
}
test('native cadence accepts regular frames plus one real off-stride terminal without padding',()=>{
 for(const n of [7,10,11,15]){const{route,rows}=cadenceUnit(n);assert.equal(assertFirstChapterCaptureRows(rows,route),rows);}
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
 for(const mutate of mutations){const x=structuredClone(cadenceUnit());mutate(x);assert.throws(()=>assertFirstChapterCaptureRows(x.rows,x.route));}
});
