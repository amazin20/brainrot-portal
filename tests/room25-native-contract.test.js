import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {ROOM25_SOURCE,ROOM25_CAPTURE,ROOM25_BOUNDS,ROOM25_OPEN_SCOPES,assertRoom25Route,assertRoom25NativeDiagnostic,assertRoom25RuntimeRenderer} from '../scripts/lib/room25-native-proof.mjs';
import {freezeRoom25Source,bindRoom25Package,assertRoom25InputsUnchanged,writeRoom25ArtifactInventory} from '../scripts/freeze-room25-native-diagnostic.mjs';
const workflow=fs.readFileSync('.github/workflows/room25-required-native-diagnostic.yml','utf8'),parsed=JSON.parse(execFileSync(process.env.ROOM25_PYTHON||'python3',['-c','import json,sys,yaml; print(json.dumps(yaml.safe_load(sys.stdin.read())))'],{input:workflow,encoding:'utf8'}));
const sourceRoot=path.resolve(process.env.SOURCE_DIR||'../source'),buildRoot=path.resolve(process.env.BUILD_DIR||path.join(sourceRoot,'dist'));

test('Room25 diagnostic workflow has one read-only job and literal separate source/controller checkouts',()=>{
 assert.deepEqual(parsed.permissions,{contents:'read'});assert.deepEqual(Object.keys(parsed.jobs),['room25-native-diagnostic']);assert.ok(parsed.on.workflow_dispatch!==undefined||Object.hasOwn(parsed.on,'workflow_dispatch'));
 const j=parsed.jobs['room25-native-diagnostic'];assert.equal(j['timeout-minutes'],45);const checkouts=j.steps.filter(s=>s.uses==='actions/checkout@v4');assert.equal(checkouts.length,2);
 assert.deepEqual(checkouts.map(c=>[c.with.path,c.with.ref,c.with['persist-credentials']]),[['diagnostic','${{ github.sha }}',false],['source',ROOM25_SOURCE.commit,false]]);
 assert.ok(!/deploy-pages|configure-pages|upload-pages-artifact|pages:\s*write|id-token:\s*write|git\s+push|update_ref|git\s+reset/.test(workflow));
 for(const step of j.steps)if(step.run)execFileSync('bash',['-n'],{input:step.run});
});
test('Room25 native source and compiled route bindings use the genuine frozen322inputs and59original GLBs',()=>{
 const f=freezeRoom25Source(sourceRoot,process.cwd(),{requireControllerClean:false});assert.equal(f.source.commit,ROOM25_SOURCE.commit);assert.equal(f.source.tree,ROOM25_SOURCE.tree);assert.equal(f.source.sourceInputFiles,322);assert.equal(f.source.originalModels.length,59);
 const b=bindRoom25Package(f,sourceRoot,buildRoot);assert.equal(b.package.originalRuntimeModels,14);assert.match(b.package.journey.path,/^assets\/LabRoom25Journey-/);assert.ok(b.package.journey.bytes>1000);assert.ok(b.package.fileCount>70);
 assertRoom25InputsUnchanged(f,freezeRoom25Source(sourceRoot,process.cwd(),{requireControllerClean:false}));
 for(const mutation of [c=>c.source.commit='0'.repeat(40),c=>c.source.sourceInputsSha256='0'.repeat(64),c=>c.source.originalModels[0].sha256='0'.repeat(64),c=>c.controller.files[0].sha256='0'.repeat(64)]){const changed=structuredClone(f);mutation(changed);assert.throws(()=>assertRoom25InputsUnchanged(f,changed));}
});
test('Room25 bounded diagnostic contract refuses CPU-only/incomplete data as native evidence',()=>{
 assert.deepEqual(ROOM25_CAPTURE,{fps:4,stride:15,width:640,height:360});assert.equal(ROOM25_BOUNDS.physicsSteps,36000);assert.equal(ROOM25_BOUNDS.telemetryBytes,25000000);
 assert.ok(Object.values(ROOM25_OPEN_SCOPES).every(v=>v===false));assert.throws(()=>assertRoom25Route({kind:'cpu-only',pass:true}));assert.throws(()=>assertRoom25NativeDiagnostic({kind:'actual-room25-required-native-browser-diagnostic',pass:true,nativeRecordingCompleted:false}));
});
test('Room25 software renderer assertion requires actual unmasked ANGLE SwiftShader and a Chrome version',()=>{
 // Predicate fixtures only; these strings do not create native evidence.
 const browser={product:'HeadlessChrome/140.0.7339.80',userAgent:'Mozilla/5.0 HeadlessChrome/140.0.0.0'},renderer={isWebGLRenderer:true,contextLost:false,version:'WebGL 2.0',debugRendererInfoAvailable:true,unmaskedVendor:'Google Inc. (Google)',unmaskedRenderer:'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'};
 assertRoom25RuntimeRenderer(renderer,browser);
 for(const mutation of [r=>r.debugRendererInfoAvailable=false,r=>r.unmaskedRenderer='WebKit WebGL',r=>r.unmaskedRenderer='ANGLE (Intel GPU)',r=>r.contextLost=true]){const changed=structuredClone(renderer);mutation(changed);assert.throws(()=>assertRoom25RuntimeRenderer(changed,browser));}
 assert.throws(()=>assertRoom25RuntimeRenderer(renderer,{...browser,product:'not observed'}));
});
test('Room25 artifact inventory includes its own actual bytes and rejects still images and nonflat members',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'room25-inventory-test-'));
 try{fs.writeFileSync(path.join(out,'actual-test.log'),'Actual inventory predicate test; no native recording.\n');const report=writeRoom25ArtifactInventory(out),inventory=path.join(out,'actual-artifact-member-inventory.json');assert.equal(report.inventoryMember.bytes,fs.statSync(inventory).size);assert.equal(report.totalBytes,fs.readdirSync(out).reduce((sum,n)=>sum+fs.statSync(path.join(out,n)).size,0));assert.equal(report.actualProviderZipAccepted,false);
  const forbidden=path.join(out,'negative-extension-fixture.JpEg');fs.writeFileSync(forbidden,'');assert.throws(()=>writeRoom25ArtifactInventory(out),/Separate still image artifact forbidden/);fs.unlinkSync(forbidden);fs.mkdirSync(path.join(out,'not-flat'));assert.throws(()=>writeRoom25ArtifactInventory(out));
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
test('Room25 real missing-binding preflight failure writes structured false evidence without launching Chrome',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'room25-preflight-test-'));
 try{const child=spawnSync(process.execPath,['scripts/qa-room25-required-native.mjs'],{env:{...process.env,OUT_DIR:out},encoding:'utf8',timeout:10000});assert.equal(child.status,1);const failure=JSON.parse(fs.readFileSync(path.join(out,'room25-native-failure.json'),'utf8'));assert.equal(failure.stage,'source-package-preflight');assert.equal(failure.pass,false);assert.equal(failure.nativeRecordingCompleted,false);assert.equal(failure.capturedFrames,0);assert.equal(failure.browser,null);assert.equal(failure.controller,null);assert.match(failure.error,/ENOENT/);assert.ok(Object.keys(ROOM25_OPEN_SCOPES).every(k=>failure[k]===false));assert.ok(!fs.existsSync(path.join(out,'room25-required.mp4')));
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
test('Room25 recorder imports frozen production journey, captures real canvas, guards source and decodes the complete MP4',()=>{
 const s=fs.readFileSync('scripts/qa-room25-required-native.mjs','utf8');assert.match(s,/await import\(journeyURL\)/);assert.match(s,/module\.runRoom25/);assert.match(s,/ctx\.drawImage\(g\.renderer\.domElement/);assert.match(s,/canvas\.toDataURL\('image\/jpeg'/);assert.match(s,/\['-hide_banner','-loglevel','error','-xerror'/);assert.match(s,/assertRoom25InputsUnchanged\(binding,after\)/);assert.match(s,/actual native JPEG budget exhausted; no silent truncation/i);
 assert.ok(!s.includes('__NESI_RUN_LEVEL_ROUTE__('));assert.ok(!s.includes('resetRun(true)'));assert.ok(!/refs\.body\.(?:position|velocity|quaternion)\.(?:set|copy|fromArray)\(/.test(s));
 const steps=parsed.jobs['room25-native-diagnostic'].steps;assert.ok(steps.findIndex(s=>String(s.name||'').startsWith('Build and stamp'))<steps.findIndex(s=>String(s.name||'').startsWith('Test real shared')));assert.ok(steps.findIndex(s=>String(s.name||'').startsWith('Inventory actual'))>steps.findIndex(s=>String(s.name||'').startsWith('Recheck unchanged')));
});
