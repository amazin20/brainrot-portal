/** Deterministic, blob-guarded publication-only migration. No game input changes. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const blobHash=text=>{const b=Buffer.from(text);return createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');};
function migrate(filename,expected,changes){
 const original=fs.readFileSync(filename,'utf8');
 assert.equal(blobHash(original),expected,'Publication source changed; audit before applying: '+filename);
 let result=original;
 for(const [before,after] of changes){assert.equal(result.split(before).length,2,'Patch anchor missing/ambiguous: '+filename);result=result.replace(before,after);}
 fs.writeFileSync(filename,result);
 console.log(JSON.stringify({file:filename,before:expected,after:blobHash(result)}));
}
migrate('scripts/assemble-expedition.mjs','0779c7176efb7b54daaeb03ca0887ad7eba98c41',[
 ["import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport {resolveSupplementalProof} from './lib/expedition-recovery.mjs';"],
 ["if(!reviewOnly)supplementalRecordingProof=assertSupplementalPublicationProof(proof,config,{publicationRun:Number(process.env.GITHUB_RUN_ID),controllerSHA:process.env.GITHUB_SHA});", "if(!reviewOnly)supplementalRecordingProof=resolveSupplementalProof(proof,config,{publicationRun:Number(process.env.GITHUB_RUN_ID),controllerSHA:process.env.GITHUB_SHA,recover:process.env.EXPEDITION_RECOVER_CAPTURES==='1'});"],
]);
const before = ` assert.equal(proof.mode,'current-publication-run');assert.equal(proof.sourceCommit,config.sourceCommit);assert.equal(proof.candidateRun,config.candidateRun);
 assert.ok(Number.isSafeInteger(proof.publicationRun)&&proof.publicationRun>0,'Supplemental captures need their real publication run');
 assert.match(proof.controllerSHA,COMMIT,'Supplemental captures need the publication controller commit');
 if(!(prepublication&&release.publicationRun===null))assert.equal(String(proof.publicationRun),String(release.publicationRun),'Supplemental captures must belong to this publication run');
 if(publicationRun!==undefined)assert.equal(String(proof.publicationRun),String(publicationRun),'Supplemental captures belong to another workflow run');
 if(controllerSHA!==undefined)assert.equal(proof.controllerSHA,controllerSHA,'Supplemental captures belong to another controller commit');`;
const after = ` assert.equal(proof.sourceCommit,config.sourceCommit);assert.equal(proof.candidateRun,config.candidateRun);
 if(proof.mode==='recovered-publication-captures'){
  assertRecoveredRecordingOrigin(proof,release,config,{publicationRun,controllerSHA});
 }else{
  assert.equal(proof.mode,'current-publication-run');
  assert.ok(Number.isSafeInteger(proof.publicationRun)&&proof.publicationRun>0,'Supplemental captures need their real publication run');
  assert.match(proof.controllerSHA,COMMIT,'Supplemental captures need the publication controller commit');
  if(!(prepublication&&release.publicationRun===null))assert.equal(String(proof.publicationRun),String(release.publicationRun),'Supplemental captures must belong to this publication run');
  if(publicationRun!==undefined)assert.equal(String(proof.publicationRun),String(publicationRun),'Supplemental captures belong to another workflow run');
  if(controllerSHA!==undefined)assert.equal(proof.controllerSHA,controllerSHA,'Supplemental captures belong to another controller commit');
 }`;
migrate('scripts/verify-expedition-public.mjs','38b0a9ad0c90a2fcaf793fbd42c008c075638a12',[
 ["import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport {assertRecoveredRecordingOrigin} from './lib/expedition-recovery.mjs';"],
 [before,after],
]);
