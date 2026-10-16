import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {CASTLE_NATIVE_OPEN_SCOPES,CASTLE_NATIVE_HARNESS_FILES} from '../scripts/lib/castle-impulse-native-proof.mjs';

const source=fs.readFileSync(new URL('../scripts/qa-castle-impulse-native.mjs',import.meta.url),'utf8');
const tree=parseAst(source);
const observer=tree.body.find(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.id?.name==='observeCastleImpulseNativeBrowser')?.declaration;
assert.equal(observer?.type,'FunctionDeclaration');
const functionSource=source.slice(observer.start,observer.end);

/** Lexical binding analysis of the actual serialized function. References are
 * resolved after collecting declarations, including destructuring, nested
 * function/loop/catch scopes and function-scoped var. Object keys and dot
 * properties are not references. A nested local cannot hide a free outer name. */
function freeBindings(text){
 const ast=parseAst('('+text+')'),references=[],scope=(parent,isFunction=false)=>({parent,isFunction,names:new Set()});
 const root=scope(null,true);
 function declare(pattern,current){
  if(!pattern)return;
  if(pattern.type==='Identifier'){current.names.add(pattern.name);return;}
  if(pattern.type==='RestElement'){declare(pattern.argument,current);return;}
  if(pattern.type==='AssignmentPattern'){declare(pattern.left,current);walk(pattern.right,current);return;}
  if(pattern.type==='ArrayPattern'){for(const item of pattern.elements)declare(item,current);return;}
  if(pattern.type==='ObjectPattern'){for(const item of pattern.properties){if(item.type==='RestElement')declare(item.argument,current);else{if(item.computed)walk(item.key,current);declare(item.value,current);}}return;}
  throw Error('Unhandled binding pattern '+pattern.type);
 }
 function walk(node,current){
  if(!node)return;if(Array.isArray(node)){for(const item of node)walk(item,current);return;}
  switch(node.type){
   case 'Identifier':references.push({name:node.name,scope:current});return;
   case 'FunctionDeclaration':
   case 'FunctionExpression':
   case 'ArrowFunctionExpression':{
    if(node.type==='FunctionDeclaration'&&node.id)declare(node.id,current);
    const inner=scope(current,true);if(node.id)declare(node.id,inner);
    if(node.type!=='ArrowFunctionExpression')inner.names.add('arguments');
    for(const parameter of node.params)declare(parameter,inner);walk(node.body,inner);return;
   }
   case 'BlockStatement':{const inner=scope(current);walk(node.body,inner);return;}
   case 'VariableDeclaration':{
    let target=current;if(node.kind==='var')while(!target.isFunction&&target.parent)target=target.parent;
    for(const declaration of node.declarations)declare(declaration.id,target);
    for(const declaration of node.declarations)walk(declaration.init,current);return;
   }
   case 'ForStatement':{const inner=scope(current);walk(node.init,inner);walk(node.test,inner);walk(node.update,inner);walk(node.body,inner);return;}
   case 'ForOfStatement':
   case 'ForInStatement':{const inner=scope(current);walk(node.left,inner);walk(node.right,inner);walk(node.body,inner);return;}
   case 'CatchClause':{const inner=scope(current);declare(node.param,inner);walk(node.body,inner);return;}
   case 'MemberExpression':walk(node.object,current);if(node.computed)walk(node.property,current);return;
   case 'Property':if(node.computed)walk(node.key,current);walk(node.value,current);return;
   case 'LabeledStatement':walk(node.body,current);return;
   case 'BreakStatement':
   case 'ContinueStatement':
   case 'MetaProperty':return;
   default:for(const value of Object.values(node))if(value&&typeof value==='object'&&(Array.isArray(value)||typeof value.type==='string'))walk(value,current);
  }
 }
 walk(ast,root);
 return [...new Set(references.filter(reference=>{for(let current=reference.scope;current;current=current.parent)if(current.names.has(reference.name))return false;return true;}).map(reference=>reference.name))].sort();
}
const browserGlobals=new Set(['Array','ArrayBuffer','Boolean','Error','JSON','Map','Math','Number','Object','Promise','Set','String','TextEncoder','Uint8Array','crypto','document','eval','structuredClone','undefined','window']);
const nodeOnlyNames=text=>freeBindings(text).filter(name=>!browserGlobals.has(name));

test('actual native observer serialization contains no Node closure, including nested late completion callbacks',()=>{
 assert.equal(observer.async,true);assert.deepEqual(nodeOnlyNames(functionSource),[]);
 const globals=freeBindings(functionSource);
 assert.ok(globals.includes('window')&&globals.includes('crypto')&&globals.includes('document'));
 // Reproduce the late CI defect without running or inventing a game/movie.
 const oldBroken=functionSource.replace('...openScopes,edition:','...CASTLE_NATIVE_OPEN_SCOPES,edition:');
 assert.notEqual(oldBroken,functionSource);assert.deepEqual(nodeOnlyNames(oldBroken),['CASTLE_NATIVE_OPEN_SCOPES']);
 const lateNodeRead=functionSource.replace('g.render();','g.render();binding.source.commit;');
 assert.deepEqual(nodeOnlyNames(lateNodeRead),['binding']);
 assert.equal(CASTLE_NATIVE_HARNESS_FILES.length,9);
});

test('binding analysis distinguishes lexical references from keys, nested locals, destructuring and hoisted var',()=>{
 assert.deepEqual(freeBindings('async function f({a:local,...rest}){ const key={free:local};function nested(free){return free+rest.x;}return nested(local)+key.free;}'),[]);
 assert.deepEqual(freeBindings('async function f(){function inner(){const binding=1;return binding;}return binding+inner();}'),['binding']);
 assert.deepEqual(freeBindings('async function f(){function inner(){return importedNodeConstant;}return inner();}'),['importedNodeConstant']);
 assert.deepEqual(freeBindings('async function f(){for(let step=0;step<2;step++){var saved=step;}try{throw saved;}catch(error){return error;}return saved+step;}'),['step']);
});

function runIsolated(argsExpression){
 // The VM receives no module imports or Node globals. Only the ordinary
 // not-playing guard is expected after valid serialized scope validation.
 return vm.runInNewContext('('+functionSource+')('+argsExpression+')',{window:{}},{timeout:1000});
}
test('serialized observer validates exact false-only scopes before touching the game',async()=>{
 const good=JSON.stringify(CASTLE_NATIVE_OPEN_SCOPES);
 await assert.rejects(runIsolated('({openScopes:'+good+'})'),/normal Foundation castle UI Play required/);
 const variants=[null,[],{},true,0,'false'];
 for(const key of Object.keys(CASTLE_NATIVE_OPEN_SCOPES)){
  variants.push({...CASTLE_NATIVE_OPEN_SCOPES,[key]:true});
  variants.push({...CASTLE_NATIVE_OPEN_SCOPES,[key]:0});
  const missing={...CASTLE_NATIVE_OPEN_SCOPES};delete missing[key];variants.push(missing);
 }
 variants.push({...CASTLE_NATIVE_OPEN_SCOPES,sourceAccepted:false});
 for(const value of variants)await assert.rejects(runIsolated('({openScopes:'+JSON.stringify(value)+'})'),/exact serialized false-only open scopes required/);
 await assert.rejects(runIsolated('({})'),/exact serialized false-only open scopes required/);
 await assert.rejects(runIsolated('({openScopes:Object.assign(Object.create({}),'+good+')})'),/exact serialized false-only open scopes required/);
});

test('the actual page.evaluate call explicitly transfers scope data instead of a browser closure',()=>{
 const calls=[];
 function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.name==='page'&&node.callee.property.name==='evaluate'&&node.arguments[0]?.name==='observeCastleImpulseNativeBrowser')calls.push(node);for(const value of Object.values(node))if(value&&typeof value==='object')visit(value);}
 visit(tree);assert.equal(calls.length,1);const args=calls[0].arguments[1];assert.equal(args.type,'ObjectExpression');
 const scopes=args.properties.filter(property=>property.key?.name==='openScopes');assert.equal(scopes.length,1);assert.equal(scopes[0].value.type,'Identifier');assert.equal(scopes[0].value.name,'CASTLE_NATIVE_OPEN_SCOPES');
});
