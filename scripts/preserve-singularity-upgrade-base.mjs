import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Preserve the last exact public package before its one-day Pages artifact
// expires. Its root game still has the original approved campaign commit.
const BASE_COMMIT='a74726ff1bfb22f21662d076fc47951b2bf368cd';
const PUBLISHER_COMMIT='a3878d7f17c69319178238db2106a6c41d87cd84';
const PUBLISHER_RUN=36580171792,ARTIFACT_ID=11039257191;
const ARCHIVE_SHA256='7c310c2220d9ae7839d6bddd030f52e1c7730091ade768805975d605f5b8352d';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const files=root=>fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(root,e.name)):[path.join(root,e.name)]);
const archives=files('base-pages').filter(p=>p.endsWith('.tar'));assert.equal(archives.length,1,'Expected one original Pages archive');
const archive=archives[0],root=path.resolve('base-snapshot');fs.mkdirSync(root,{recursive:true});
assert.equal(hash(archive),ARCHIVE_SHA256,'The preserved archive must be the exact inspected public package');
execFileSync('tar',['--no-same-owner','-xf',archive,'-C',root]);
assert.equal(read(path.join(root,'build-info.json')).commit,BASE_COMMIT);
assert.equal(read(path.join(root,'tower-singularity/preview-release.json')).sourceCommit,'b1bf88fb90b85e3b0786c651fcd2ba2edcf92696');
const approval=read('docs/approved-walkthroughs-40.json'),approved=approval.originalManifest.levels;
const gallery=read(path.join(root,'walkthroughs/manifest.json'));
const expectedEntries=approved.map(e=>({...e,sourceCommit:approval.originalManifest.sourceCommit,reused:true,
 provenance:{kind:'approved-existing-recording',manifestSha256:approval.manifestSha256,captureRunId:approval.captureRunId,verificationRunId:approval.verificationRunId}}));
assert.deepEqual(gallery.levels.filter(e=>e.level<=40),expectedEntries,'The preserved base must contain the forty approved entries with their original publication provenance');
for(const e of approved){assert.equal(hash(path.join(root,e.src)),e.sha256);assert.equal(fs.statSync(path.join(root,e.src)).size,e.bytes);assert.ok(fs.statSync(path.join(root,e.poster)).size>0);}
const snapshot=files(root).map(p=>({path:path.relative(root,p),bytes:fs.statSync(p).size,sha256:hash(p)})).sort((a,b)=>a.path.localeCompare(b.path));
const provenance={schemaVersion:1,rootCommit:BASE_COMMIT,originalCampaignRun:36509639087,publisherRun:PUBLISHER_RUN,publisherCommit:PUBLISHER_COMMIT,
 publisherWorkflow:'.github/workflows/publish-singularity-preview.yml',originalArtifactId:ARTIFACT_ID,archiveFilename:'artifact.tar',archiveSHA256:hash(archive),archiveBytes:fs.statSync(archive).size,
 preservedBySourceCommit:process.env.GITHUB_SHA,preservedByRun:process.env.GITHUB_RUN_ID,siteBytes:snapshot.reduce((s,f)=>s+f.bytes,0),files:snapshot};
fs.mkdirSync('primary-game-base',{recursive:true});fs.copyFileSync(archive,'primary-game-base/artifact.tar');
fs.writeFileSync('primary-game-base/base-provenance.json',JSON.stringify(provenance,null,2)+'\n');
console.log('APPROVED PUBLIC BASE PRESERVED',JSON.stringify({rootCommit:BASE_COMMIT,publisherRun:PUBLISHER_RUN,archiveSHA256:provenance.archiveSHA256,archiveBytes:provenance.archiveBytes,siteBytes:provenance.siteBytes,retainedLevels:approved.length}));
