import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertBaseArchiveRecovery,RECOVERY_ESCROW_ID,RECOVERY_ESCROW_DIGEST,RECOVERY_CAPTURE_RUN,RECOVERY_CAPTURE_SHA} from '../scripts/lib/expedition-recovery.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../tools/expedition-release.json',import.meta.url)));
const fixture=()=>({mode:'digest-pinned-preserved-inputs',artifact:{id:RECOVERY_ESCROW_ID,name:'expedition-publication-inputs',digest:RECOVERY_ESCROW_DIGEST,publicationRun:RECOVERY_CAPTURE_RUN,controllerSHA:RECOVERY_CAPTURE_SHA},previousArtifact:structuredClone(config.previousArtifact),snapshotSHA256:'a'.repeat(64),validationJobID:123});
test('preserved original Pages ZIP has explicit escrow provenance',()=>assert.equal(assertBaseArchiveRecovery(fixture(),config).artifact.id,RECOVERY_ESCROW_ID));
for(const [name,mutate]of Object.entries({
 'foreign escrow':p=>p.artifact.id++,
 'changed escrow digest':p=>p.artifact.digest='sha256:'+'b'.repeat(64),
 'wrong original run':p=>p.artifact.publicationRun++,
 'wrong controller':p=>p.artifact.controllerSHA='c'.repeat(40),
 'different nested Pages ZIP':p=>p.previousArtifact.digest='sha256:'+'d'.repeat(64),
 'missing snapshot digest':p=>delete p.snapshotSHA256,
 'missing successful validation identity':p=>p.validationJobID=0,
}))test('reject '+name,()=>{const p=fixture();mutate(p);assert.throws(()=>assertBaseArchiveRecovery(p,config));});
