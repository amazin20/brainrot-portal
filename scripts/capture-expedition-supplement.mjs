import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {assertPublishableExpedition,assertExpeditionInfo,assertRecording,assertSupplementalCaptureEvidence,expeditionSupplementalRecordingLevels,fileHash,readJSON} from './lib/expedition-proof.mjs';

// This controller never builds or edits the frozen game. Each isolated matrix
// job serves the digest-pinned production ZIP and invokes its unchanged recorder.
const config=assertPublishableExpedition(readJSON(process.env.RELEASE_CONFIG||'tools/expedition-release.json'));
const level=Number(process.env.LEVEL),publicationRun=Number(process.env.GITHUB_RUN_ID),controllerSHA=process.env.GITHUB_SHA;
assert.ok(expeditionSupplementalRecordingLevels(config).includes(level));assert.ok(Number.isSafeInteger(publicationRun)&&publicationRun>0);assert.match(controllerSHA,/^[a-f0-9]{40}$/);
const source=path.resolve(process.env.GAME_SOURCE_DIR||'game-source'),candidate=path.resolve(process.env.CANDIDATE_DIR||'capture-candidate'),out=path.resolve(process.env.OUT_DIR||'supplemental-output');
assert.ok(!fs.existsSync(out),'Each capture attempt requires an empty new output directory');assert.ok(!fs.existsSync(candidate),'Candidate extraction must be fresh');
const archive=path.resolve(process.env.CANDIDATE_ARCHIVE||'capture-input/expedition-production.zip');assert.equal('sha256:'+fileHash(archive),config.candidateArtifact.digest,'Pinned production ZIP digest must match before extraction');
execFileSync('python3',['-c',String.raw`
import pathlib,shutil,sys,zipfile
archive,target=map(pathlib.Path,sys.argv[1:]);target.mkdir();seen=set()
with zipfile.ZipFile(archive) as z:
 for entry in z.infolist():
  if entry.is_dir():continue
  name=entry.filename
  assert not name.startswith('/') and '\\' not in name and all(p not in ('','..','.') for p in name.split('/')),name
  assert name not in seen and (entry.external_attr>>16)&0o170000 != 0o120000,name
  seen.add(name);filename=target/name;filename.parent.mkdir(parents=True,exist_ok=True)
  with z.open(entry) as src,filename.open('wb') as dst:shutil.copyfileobj(src,dst)
`,archive,candidate],{stdio:'inherit'});
const info=assertExpeditionInfo(readJSON(path.join(candidate,'build-info.json')),config),script='scripts/record-foundation-walkthrough.mjs';
const git=args=>execFileSync('git',args,{cwd:source,encoding:'utf8'}).trim();assert.equal(git(['rev-parse','HEAD']),config.sourceCommit);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputs=['src','public','index.html','package.json','package-lock.json','vite.config.js'];
function snapshot(){
 assert.equal(git(['status','--porcelain','--untracked-files=no']),'','Every tracked recorder dependency must remain unchanged');
 assert.equal(git(['diff','--name-only','HEAD','--',...inputs,script]),'','Tracked capture source changed');assert.equal(git(['ls-files','--others','--exclude-standard','--',...inputs,script]),'','Untracked game-build inputs are forbidden');
 const files=execFileSync('git',['ls-files','-z','--',...inputs],{cwd:source,encoding:'utf8'}).split('\0').filter(Boolean).sort();assert.ok(files.length>0);
 const gameBuildInputs=hash(JSON.stringify(files.map(file=>({path:file,sha256:fileHash(path.join(source,file))}))));
 const sourceScript=fileHash(path.join(source,script)),canonicalScript=hash(execFileSync('git',['show','HEAD:'+script],{cwd:source}));
 assert.equal(gameBuildInputs,config.sourceGameBuildInputsSHA256);assert.equal(sourceScript,config.sourceRecorderSHA256);assert.equal(canonicalScript,config.sourceRecorderSHA256);
 return {gameBuildInputs,sourceScript,canonicalScript};
}
const before=snapshot();
const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1','--directory',candidate],{stdio:'ignore'});
try{
 let ready=false;for(let attempt=0;attempt<100;attempt++){if(server.exitCode!==null)throw Error('Pinned candidate server exited');try{const response=await fetch('http://127.0.0.1:4173/build-info.json');if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,'Pinned candidate server failed to start');
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(source,script)],{cwd:source,stdio:'inherit',env:{...process.env,LEVEL:String(level),BUILD_COMMIT:config.sourceCommit,PAGE_URL:'http://127.0.0.1:4173/',OUT_DIR:out,CAPTURE_FPS:'4',CAPTURE_WIDTH:'640',CAPTURE_HEIGHT:'360',ALTERNATIVE_ROUTE:''}});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Unchanged source recorder failed: '+code)));});
 const after=snapshot(),stem='level-'+String(level).padStart(2,'0');assertRecording(readJSON(path.join(out,stem+'.json')),info,level);
 const evidence={sourceCommit:config.sourceCommit,publicationRun,controllerSHA,level,candidateArtifact:config.candidateArtifact,buildInfoSHA256:fileHash(path.join(candidate,'build-info.json')),sourceScriptSHA256:before.sourceScript,sourceScriptAfterSHA256:after.sourceScript,canonicalScriptSHA256:before.canonicalScript,gameBuildInputsBeforeSHA256:before.gameBuildInputs,gameBuildInputsAfterSHA256:after.gameBuildInputs,workingTreeCleanBefore:true,workingTreeCleanAfter:true};
 assertSupplementalCaptureEvidence(evidence,config,level,{publicationRun,controllerSHA,buildInfoSHA256:evidence.buildInfoSHA256});fs.writeFileSync(path.join(out,'capture-source-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 const expected=[stem+'.json',stem+'.mp4',stem+'.jpg',stem+'-finish.jpg','capture-source-evidence.json'].sort();assert.deepEqual(fs.readdirSync(out).sort(),expected,'Only completed validated capture files may be uploaded');
 console.log(JSON.stringify({level,sourceCommit:config.sourceCommit,publicationRun,unchangedRecorder:true}));
}finally{server.kill('SIGTERM');}
