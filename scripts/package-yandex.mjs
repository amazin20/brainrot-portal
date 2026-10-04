import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {CAMPAIGN_ASSETS, CAMPAIGN_ASSET_IDS} from '../src/game/labAssets.js';
import {FOUNDATION_INDICES} from '../src/game/LabFoundationEdition.js';
import {campaignSpec} from '../src/game/LabCampaignLevels.js';

const args=new Map(process.argv.slice(2).map(value=>{const [key,...rest]=value.split('=');return [key,rest.join('=')||true];}));
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function sourceInputs(){
  // These are build inputs, not review media. Output file hashes below also
  // cover the exact packaged models, decoder and bundle bytes.
  const filenames=['index.html','vite.config.js','package.json','package-lock.json',...walk('src'),...walk('public/models/runtime'),...walk('public/draco')].filter(filename=>fs.existsSync(filename)).sort();
  return filenames.map(filename=>({filename:filename.split(path.sep).join('/'),sha256:hash(fs.readFileSync(filename))}));
}
const inputsBefore=sourceInputs();
if(args.has('--build'))execFileSync('npm',['run','build:yandex'],{stdio:'inherit'});
const input=path.resolve(String(args.get('--input')||'dist-yandex'));
const output=path.resolve(String(args.get('--output')||'artifacts/brainrot-portal-yandex.zip'));
const reportPath=path.resolve(String(args.get('--report')||'qa/yandex-package.json'));
const LIMIT=100_000_000; // Conservative decimal bytes for the user's and platform's 100 MB ceiling.
function walk(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const filename=path.join(directory,entry.name);
    assert.equal(entry.isSymbolicLink(),false,`No symlink in package: ${filename}`);
    return entry.isDirectory()?walk(filename):[filename];
  });
}
assert.ok(fs.existsSync(path.join(input,'index.html')),'index.html must be at the archive root');
assert.ok(!output.startsWith(input+path.sep),'ZIP must be outside the game directory');
const filenames=walk(input).map(filename=>path.relative(input,filename).split(path.sep).join('/')).sort();
assert.deepEqual(filenames.filter(filename=>/(^|\/)index\.html$/.test(filename)),['index.html']);
assert.ok(filenames.length>5,'Game bundle is missing');
assert.ok(!filenames.includes('sdk.js'),'The host-supplied /sdk.js must not be packaged');
for(const filename of filenames){
  assert.match(filename,/^[\x21-\x7e]+$/,`ASCII filenames without spaces required: ${filename}`);
  assert.ok(!/(^|\/)(?:qa|smoke-artifacts|tools|scripts|docs|walkthroughs|model-screens|concepts)(\/|$)/i.test(filename),`Review file in game: ${filename}`);
  assert.ok(!/\.(?:mp4|webm|mov|map|md|ts|tsx)$/i.test(filename),`Non-game file in package: ${filename}`);
  assert.ok(!/(?:Journey|LabEvidence|Capture)[^/]*\.(?:js|json)$/i.test(filename),`QA module in game: ${filename}`);
}
const files=filenames.map(filename=>{const bytes=fs.readFileSync(path.join(input,filename));return {filename,bytes:bytes.length,sha256:hash(bytes)};});
const unpackedBytes=files.reduce((sum,file)=>sum+file.bytes,0);
assert.ok(unpackedBytes<=LIMIT,`Unpacked package exceeds ${LIMIT} bytes: ${unpackedBytes}`);
const manifest=JSON.parse(fs.readFileSync(path.join(input,'models/runtime/manifest.json')));
assert.deepEqual(manifest.models.map(model=>model.id).sort((a,b)=>a-b),[...CAMPAIGN_ASSET_IDS].sort((a,b)=>a-b),'Every active asset must be packaged');
assert.equal(FOUNDATION_INDICES.length,41);
const game={chamberEdition:'foundation'};
for(const index of FOUNDATION_INDICES){
  const spec=campaignSpec(game,index);assert.ok(spec,`Missing level ${index+1}`);
  for(const id of spec.assets)assert.ok(manifest.models.some(model=>model.id===id),`Level ${index+1} asset ${id} is absent`);
}
for(const model of manifest.models){
  const file=files.find(file=>file.filename===`models/runtime/${model.filename}`);
  assert.ok(file,`Missing GLB ${model.filename}`);assert.equal(file.bytes,model.outputBytes);assert.equal(file.sha256,model.outputSHA256);
}
assert.equal(manifest.models.length,CAMPAIGN_ASSETS.length);
assert.ok(manifest.totalBytes<4_000_000,'Preserve the active model budget');
for(const decoder of ['draco_decoder.js','draco_wasm_wrapper.js','draco_decoder.wasm'])assert.ok(filenames.includes(`draco/${decoder}`));
const index=fs.readFileSync(path.join(input,'index.html'),'utf8');
assert.ok(!/walkthroughs|https?:\/\/|class="walkthrough-link"/.test(index),'The game entry must not link to absent gallery or external assets');
// All static URLs stay inside a nested upload directory. /sdk.js is loaded by
// LabPlatform and supplied by Yandex, so it is deliberately absent from the ZIP.
function resource(value,owner){
  if(!value||value.startsWith('#')||value.startsWith('data:')||value.startsWith('?'))return;
  assert.ok(!/^(?:https?:)?\/\//i.test(value),`External game resource ${value}`);
  assert.ok(!value.startsWith('/'),`Absolute game resource ${value}`);
  const filename=path.posix.normalize(path.posix.join(path.posix.dirname(owner),value.split(/[?#]/)[0]));
  assert.ok(!filename.startsWith('../'),`Escaping resource ${value}`);
  assert.ok(filenames.includes(filename),`Missing ${value} referenced from ${owner}`);
}
for(const file of files){
  if(!/\.(?:html|css|js)$/.test(file.filename))continue;
  const text=fs.readFileSync(path.join(input,file.filename),'utf8');
  if(file.filename.endsWith('.html'))for(const match of text.matchAll(/\b(?:src|href|poster)=["']([^"']+)["']/g))resource(match[1],file.filename);
  if(file.filename.endsWith('.css'))for(const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))resource(match[1],file.filename);
  if(file.filename.endsWith('.js')){
    assert.ok(!/__NESI_RUN_|__LAB_EVIDENCE_CAPTURE__/.test(text),`Review entry point shipped in ${file.filename}`);
    for(const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.[^"']+)["']/g))resource(match[1],file.filename);
  }
}
assert.ok(files.filter(file=>file.filename.startsWith('assets/')&&file.filename.endsWith('.js')).some(file=>fs.readFileSync(path.join(input,file.filename),'utf8').includes('/sdk.js')),'Game bundle must request the platform-supplied /sdk.js');
const inputsAfter=sourceInputs();
assert.deepEqual(inputsAfter,inputsBefore,'Source or asset inputs changed during build/package; rebuild from a stable snapshot');
fs.mkdirSync(path.dirname(output),{recursive:true});
execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python',['-c',`
import os,sys,zipfile
source,destination=sys.argv[1:]
with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for directory,folders,files in os.walk(source):
  folders.sort()
  for name in sorted(files):
   filename=os.path.join(directory,name)
   info=zipfile.ZipInfo(os.path.relpath(filename,source).replace(os.sep,'/'),date_time=(2026,1,1,0,0,0))
   info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
   with open(filename,'rb') as stream:archive.writestr(info,stream.read(),compresslevel=9)
with zipfile.ZipFile(destination) as archive:
 assert archive.testzip() is None
 assert 'index.html' in archive.namelist()
`,input,output]);
const archive=fs.readFileSync(output);assert.ok(archive.length<=LIMIT,`ZIP exceeds ${LIMIT} bytes`);
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim().length>0;
const report={pass:true,scope:'Archive structure, files, hashes and 41-level model coverage; not live SDK, hardware FPS or moderation approval',
  sourceCommit,workingTreeModified:dirty,workingTreeStatusScope:'tracked files only; generated untracked QA/artifacts excluded',builtFromCurrentSource:args.has('--build'),sourceInputFiles:inputsBefore.length,sourceInputsSha256:hash(JSON.stringify(inputsBefore)),compressedBytes:archive.length,unpackedBytes,limitBytes:LIMIT,sha256:hash(archive),
  levels:FOUNDATION_INDICES.length,models:manifest.models.length,modelBytes:manifest.totalBytes,
  sdkScript:'/sdk.js supplied by the Yandex upload host, not included',files};
fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:files.length,output,report:reportPath},null,2));
