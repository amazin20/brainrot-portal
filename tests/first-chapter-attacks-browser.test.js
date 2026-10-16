import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseAst} from 'rollup/parseAst';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {createFirstChapterAttackOriginalGuard,firstChapterAttackCatalogue,assertFirstChapterAttacksBrowserDiagnostic} from '../scripts/lib/first-chapter-attack-browser.mjs';

test('the real original-model guard permits ordinary camera FOV animation and rejects rig/lens/model substitution',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(0,false);g.resetRun(true);
 // A renderer handle is sufficient for this identity-only CPU unit. It is
 // never returned as a WebGL observation or written as accepted evidence.
 g.renderer={domElement:{}};const guard=createFirstChapterAttackOriginalGuard(g);guard.live();
 const initial=g.camera.fov;for(const fov of [59.5,68,82]){g.camera.fov=fov;assert.doesNotThrow(guard.live);}g.camera.fov=initial;
 const mutations=[
  ['camera.far',()=>{const old=g.camera.far;g.camera.far++;return()=>{g.camera.far=old;};}],
  ['camera.aspect',()=>{const old=g.camera.aspect;g.camera.aspect=1;return()=>{g.camera.aspect=old;};}],
  ['camera.zoom',()=>{g.camera.zoom=2;return()=>{g.camera.zoom=1;};}],
  ['camera.fov',()=>{g.camera.fov=NaN;return()=>{g.camera.fov=initial;};}],
  ['camera rig update',()=>{const old=g.cameraRig.update;g.cameraRig.update=()=>{};return()=>{g.cameraRig.update=old;};}],
  ['camera rig reset',()=>{const old=g.cameraRig.reset;g.cameraRig.reset=()=>{};return()=>{g.cameraRig.reset=old;};}],
  ['renderer canvas',()=>{const old=g.renderer.domElement;g.renderer.domElement={};return()=>{g.renderer.domElement=old;};}],
  ['original body mass',()=>{g.physics.cargoBody.mass=5;return()=>{g.physics.cargoBody.mass=3.2;};}],
  ['original shape',()=>{const s=g.physics.cargoBody.shapes[0],old=s.halfExtents.x;s.halfExtents.x=.4;return()=>{s.halfExtents.x=old;};}],
 ];
 for(const[name,mutate]of mutations){const restore=mutate();try{assert.throws(guard.live,undefined,name);}finally{restore();}assert.doesNotThrow(guard.live);}
 const before=await guard.appearanceHash(),meshes=[];g.playerVisual.traverse(m=>{if(m.isMesh)meshes.push(m);});const array=meshes[0].geometry.attributes.position.array,old=array[0];array[0]+=.1;
 const after=await guard.appearanceHash();assert.notEqual(after,before);array[0]=old;assert.equal(await guard.appearanceHash(),before);
});

test('actual native attack observer and capture never assign actors, lens, mechanism state or use level selection/reset',()=>{
 const source=fs.readFileSync(new URL('../scripts/lib/first-chapter-attack-browser.mjs',import.meta.url),'utf8'),ast=parseAst(source),node=ast.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='observeFirstChapterBrowserAttack').declaration;
 const member=n=>n?.type==='MemberExpression'?(n.computed?n.property.value:n.property.name):null;
 const audit=text=>{const forbidden=[];
 function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}
  if(n.type==='AssignmentExpression'&&['fov','near','far','aspect','zoom','state','position','quaternion','target','opened','pressed','solved'].includes(member(n.left)))forbidden.push(text.slice(n.left.start,n.left.end));
  if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'){
   const name=member(n.callee),object=text.slice(n.callee.object.start,n.callee.object.end);
   if(['selectLevel','resetRun','respawn','resetCargo'].includes(name)||['set','copy','setFromEuler','lookAt','applyQuaternion','applyMatrix4'].includes(name)&&/(?:\bcamera\b|\bbody\b|playerPosition|cargo\.position)/.test(object))forbidden.push(object+'.'+name);
  }
  for(const v of Object.values(n))if(v&&typeof v==='object')walk(v);
 }walk(parseAst(text));return forbidden;};
 // Mutation controls exercise the same AST audit rule for both a forbidden
 // assignment and an ordinary-looking direct reset call.
 const text=source.slice(node.start,node.end);assert.deepEqual(audit(text),[]);assert.deepEqual(audit(text.replace('const catalogue=','g.camera.fov=60; const catalogue=')),['g.camera.fov']);assert.deepEqual(audit(text.replace('const catalogue=','g.resetRun(); const catalogue=')),['g.resetRun']);assert.match(text,/runV8Journey\(g,\{journeyOptions:\{nativeStart:true\}/);assert.match(text,/observeEarlyChapterAttack\(g,.*nativeStart:true/);
});

test('browser gate refuses empty, wrong-group and declaration-only evidence instead of manufacturing attack coverage',()=>{
 assert.equal(firstChapterAttackCatalogue('early').length,10);assert.equal(firstChapterAttackCatalogue('later').length,13);assert.throws(()=>firstChapterAttackCatalogue('all'));
 for(const report of [null,{}, {pass:true,group:'early'}, {schemaVersion:1,kind:'actual-first-chapter-ordinary-attacks-browser-diagnostic',pass:true,group:'later'}])assert.throws(()=>assertFirstChapterAttacksBrowserDiagnostic(report,{group:'early'}));
});
