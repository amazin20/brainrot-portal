import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {parseAst} from 'rollup/parseAst';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {createBiosphereAttackOriginalGuard,biosphereAttackCatalogue,readBiosphereAttackStart,assertBiosphereAttacksBrowserDiagnostic} from '../scripts/lib/biosphere-attack-browser.mjs';

test('actual room 21 and 26 array spawns and equivalent Vector3 spawns retain exact numeric distances without moving actors',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';
 for(const index of [20,25]){
  await g.selectLevel(index,false);g.resetRun(true);const level=g.firstLevel,spawn=level.spawn,cargoSpawn=level.cargoSpawn,player=g.playerPosition.toArray(),cargo=g.cargo.position.toArray(),step=g.physics.world.stepnumber;
  assert.equal(Array.isArray(spawn),true);assert.equal(Array.isArray(cargoSpawn),true);
  assert.equal(Number.isNaN(g.playerPosition.distanceTo(spawn)),true,'Regression control: Vector3.distanceTo cannot read an array');
  assert.equal(Number.isNaN(g.cargo.position.distanceTo(cargoSpawn)),true,'Regression control: cargo array has the same mismatch');
  const check=()=>{
   const r=readBiosphereAttackStart(g),serialized=vm.runInNewContext('('+readBiosphereAttackStart.toString()+')(game)',{game:g});
   assert.equal(JSON.stringify(serialized),JSON.stringify(r),'The exact page-transferred function has no Node closure');
   assert.equal(r.normalSpawn,true);assert.equal(r.normalCargoSpawn,true);assert.equal(r.playerSpawnDistance,0);assert.equal(r.cargoSpawnDistance,0);
   assert.deepEqual(r.playerPosition,player);assert.deepEqual(r.cargoPosition,cargo);assert.deepEqual(r.expectedPlayerSpawn,spawn);assert.deepEqual(r.expectedCargoSpawn,cargoSpawn);return r;
  };
  check();level.spawn=new THREE.Vector3(...spawn);level.cargoSpawn=new THREE.Vector3(...cargoSpawn);check();
  level.spawn=spawn.slice();level.spawn[0]+=1e-7;assert.equal(readBiosphereAttackStart(g).normalSpawn,false);assert.equal(readBiosphereAttackStart(g).normalCargoSpawn,true);
  level.spawn=spawn;level.cargoSpawn=new THREE.Vector3(...cargoSpawn).add(new THREE.Vector3(0,0,1e-7));assert.equal(readBiosphereAttackStart(g).normalCargoSpawn,false);assert.equal(readBiosphereAttackStart(g).normalSpawn,true);
  level.cargoSpawn=[...cargoSpawn,0];assert.equal(readBiosphereAttackStart(g).normalCargoSpawn,false);assert.equal(readBiosphereAttackStart(g).cargoSpawnDistance,null);
  level.cargoSpawn=cargoSpawn;check();assert.deepEqual(g.playerPosition.toArray(),player);assert.deepEqual(g.cargo.position.toArray(),cargo);assert.equal(g.physics.world.stepnumber,step);
 }
});

test('the real original-model guard permits ordinary camera FOV animation and rejects rig/lens/model substitution',async()=>{
 const g=await createHeadlessGame();g.chamberEdition='foundation';await g.selectLevel(20,false);g.resetRun(true);
 // A renderer handle is sufficient for this identity-only CPU unit. It is
 // never returned as a WebGL observation or written as accepted evidence.
 g.renderer={domElement:{}};const guard=createBiosphereAttackOriginalGuard(g);guard.live();
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
 const source=fs.readFileSync(new URL('../scripts/lib/biosphere-attack-browser.mjs',import.meta.url),'utf8'),ast=parseAst(source),node=ast.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='observeBiosphereBrowserAttack').declaration;
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
 const text=source.slice(node.start,node.end);assert.deepEqual(audit(text),[]);assert.deepEqual(audit(text.replace('const catalogue=','g.camera.fov=60; const catalogue=')),['g.camera.fov']);assert.deepEqual(audit(text.replace('const catalogue=','g.resetRun(); const catalogue=')),['g.resetRun']);assert.match(text,/runBiosphereLateAttack\(g,.*nativeStart:true/);assert.match(text,/observeBiosphereEarlyAttack\(g,.*nativeStart:true/);
});

test('browser gate refuses empty, wrong-group and declaration-only evidence instead of manufacturing attack coverage',()=>{
 assert.equal(biosphereAttackCatalogue('early').length,10);assert.equal(biosphereAttackCatalogue('later').length,10);assert.throws(()=>biosphereAttackCatalogue('all'));
 for(const report of [null,{}, {pass:true,group:'early'}, {schemaVersion:1,kind:'actual-biosphere-ordinary-attacks-browser-diagnostic',pass:true,group:'later'}])assert.throws(()=>assertBiosphereAttacksBrowserDiagnostic(report,{group:'early'}));
});

test('provider run identifiers use positive safe-integer range without borrowing the bounded simulation counter cap',()=>{
 const source={commit:'e'.repeat(40)},controller={},pkg={},captureOrigin='https://example.invalid',expected={group:'early',source,controller,package:pkg,captureOrigin};
 // This deliberately incomplete prefix is never accepted as browser proof.
 // It must advance through real-sized run IDs to the next missing-harness
 // gate; a generic rejection could hide the former 100,000,000 run-ID bug.
 const prefix=()=>({schemaVersion:1,kind:'actual-biosphere-ordinary-attacks-browser-diagnostic',pass:true,group:'early',source,controller,package:pkg,captureOrigin,capturePath:'/campaign-v62/',
  sourceCiAccepted:false,nativeAccepted:false,publicationAccepted:false,fullChapterAccepted:false,humanAccepted:false,allBypassesAccepted:false,
  completeServedPackageVerified:true,sourceWorkingBytesUnchanged:true,controllerWorkingBytesUnchanged:true,harnessWorkingBytesUnchanged:true,
  errors:[],humanPlaytest:false,hardwareFPSMeasured:false,sourceReview:{runId:38984486049,runAttempt:1},captureRun:{runId:38984486049,runAttempt:1},providerRun:{commit:'f'.repeat(40),runId:38984486049,runAttempt:1}});
 for(const id of [38984486049,Number.MAX_SAFE_INTEGER]){
  const r=prefix();r.sourceReview.runId=r.captureRun.runId=r.providerRun.runId=id;
  assert.throws(()=>assertBiosphereAttacksBrowserDiagnostic(r,expected),/frozen harness provenance/);
 }
 const attempts=prefix();attempts.sourceReview.runAttempt=attempts.captureRun.runAttempt=attempts.providerRun.runAttempt=Number.MAX_SAFE_INTEGER;
 assert.throws(()=>assertBiosphereAttacksBrowserDiagnostic(attempts,expected),/frozen harness provenance/);
 const invalid=[0,-1,1.5,Number.MAX_SAFE_INTEGER+1,NaN,Infinity,'38984486049'];
 for(const value of invalid)for(const [record,label]of [['sourceReview','explicit source run\/attempt'],['captureRun','separate actual capture run'],['providerRun','actual provider run\/commit']])for(const key of ['runId','runAttempt']){
  const r=prefix();r[record][key]=value;assert.throws(()=>assertBiosphereAttacksBrowserDiagnostic(r,expected),new RegExp(label),record+'.'+key+'='+String(value));
 }
});
