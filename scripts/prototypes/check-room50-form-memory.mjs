import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {inspectForms,formGeometry,retrievalAccess,FORM_POSES,RETRIEVAL_FRAME} from './room50-form-memory.mjs';
const output=path.resolve(process.argv[2]||'qa/room50-form-geometry.json');
const report=inspectForms(),[initial,short,long]=report.rows;
assert.equal(initial.floorGraph.connected,false);
assert.equal(short.floorGraph.connected,true);assert.equal(short.floorGraph.length,12);
assert.equal(long.floorGraph.connected,true);assert.equal(long.floorGraph.length,24);
assert.equal(initial.access.shotLine.clear,false);assert.equal(initial.access.exitVolume.clear,false);
assert.equal(short.access.shotLine.clear,false);assert.equal(short.access.exitVolume.clear,false);
assert.equal(long.access.shotLine.clear,true);assert.equal(long.access.exitVolume.clear,true);
// Counterfactual already-retained floor R stays exactly the same object and
// overlaps the independent rigid leaf after refolding. Whether production
// transit rejects, moves or ejects the body is deliberately not claimed here.
const frame=RETRIEVAL_FRAME;
assert.equal(retrievalAccess(formGeometry(FORM_POSES.long),{retainedFrame:frame}).exitVolume.clear,true);
assert.equal(retrievalAccess(formGeometry(FORM_POSES.short),{retainedFrame:frame}).exitVolume.clear,false);
assert.equal(frame,RETRIEVAL_FRAME);
report.commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
report.sourceFiles=['scripts/prototypes/room50-form-memory.mjs','scripts/prototypes/check-room50-form-memory.mjs'];
report.sha256=Object.fromEntries(report.sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
report.geometryChecksPassed=true;report.ordinaryPrototypeRoutesPassed=false;report.acceptedAsCampaignReplacement=false;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('GEOMETRY PASS: initial unconnected; short12 / long24; initial/short obstruct R rays and overlap its nominal exit volume, long clears both. Actual transit/ordinary gameplay/uniqueness remain unproved.');
