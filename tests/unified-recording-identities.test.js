import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLICATION_TARGET as target,recordingStem} from '../scripts/lib/unified-publication-config.mjs';
import {acceptedRecordings} from '../scripts/verify-unified-public.mjs';
const source='8f2132cabdee6225bc9ebe34356a3bb1cf643dfe';
function receipt(){return {gameCommit:source,interfaceCommit:source,reviewConclusion:'success',successfulJobs:target.expectedJobs,
 recordings:target.recordings.map(record=>({id:record.id,publicVideo:'walkthroughs/'+recordingStem(record,source)+'.mp4',publicEvidence:'walkthroughs/'+recordingStem(record,source)+'.json',
  originalEvidence:{sourceCommit:source,level:record.level,fps:record.fps,alternative:record.alternative,continuous:true,durationSeconds:71.25,
   route:{pass:true,resets:0,respawns:0},firstFrame:{cargoBodyId:42},lastFrame:{cargoBodyId:42,state:'won'}}}))};}
test('current seven gallery identities and durations come from the accepted source receipt',()=>{
 const row=receipt();row.recordings[3].originalEvidence.durationSeconds=123.25;
 const records=acceptedRecordings(row,source);
 assert.equal(records.length,7);assert.equal(records[3].duration,123.25);
 assert.ok(records.every(record=>record.src.includes('v54-8f2132c-')));
});
for(const [name,mutate] of [
 ['old F source',row=>row.gameCommit='578c31ebee7fd2ef01af5de8e673589c67e9daf0'],
 ['old47job review',row=>row.successfulJobs=47],
 ['missing Room47 manual-impact video',row=>{row.recordings=row.recordings.filter(record=>record.id!=='47-manual-impact');}],
 ['old50job I review',row=>row.successfulJobs=50],
 ['missing new video',row=>row.recordings.pop()],
 ['duplicated video',row=>{row.recordings[5]=row.recordings[4];}],
 ['old v54 path',row=>row.recordings[0].publicVideo='walkthroughs/v54-level-17.mp4'],
 ['wrong source capture',row=>row.recordings[3].originalEvidence.sourceCommit='f'.repeat(40)],
 ['wrong alternate identity',row=>row.recordings.find(record=>record.id==='47-manual-impact').originalEvidence.alternative=''],
 ['replacement cargo',row=>row.recordings[5].originalEvidence.lastFrame.cargoBodyId=44],
 ['route respawn',row=>row.recordings[5].originalEvidence.route.respawns=1],
 ['nonfinite duration',row=>row.recordings[5].originalEvidence.durationSeconds=NaN],
])test(`current gallery rejects ${name}`,()=>{const row=receipt();mutate(row);assert.throws(()=>acceptedRecordings(row,source));});
