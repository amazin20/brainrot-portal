import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Browser engines can change final floating-point bits when render-only work
// changes optimization timing. This tolerance is absolute, below 0.00001mm
// for positions; it never applies to frame counts, identities or state flags.
export const NATIVE_POSE_TOLERANCE=1e-8;
const counts=new Set(['level','frames','respawns','resets','teleports']);

export function compareEarlyArt(before,after,{revision=null}={}){
 assert.equal(before.pass,true,'The baseline ordinary route must pass');
 assert.equal(after.pass,true,'The upgraded ordinary route must pass');
 assert.deepEqual(before.errors,[],'Baseline browser errors');
 assert.deepEqual(after.errors,[],'Upgraded browser errors');
 let maxNumericDelta=0,maxNumericDeltaPath=null,numericComparisons=0;
 function same(prior,next,path,key=''){
  assert.equal(typeof next,typeof prior,`${path}: value type changed`);
  if(typeof prior==='number'){
   assert.ok(Number.isFinite(prior)&&Number.isFinite(next),`${path}: numbers must be finite`);
   const delta=Math.abs(next-prior);numericComparisons++;
   if(delta>maxNumericDelta){maxNumericDelta=delta;maxNumericDeltaPath=path;}
   if(counts.has(key)){
    assert.ok(Number.isInteger(prior)&&Number.isInteger(next),`${path}: counts must remain integers`);
    assert.equal(next,prior,`${path}: physical event or frame count changed`);
   }else assert.ok(delta<=NATIVE_POSE_TOLERANCE,`${path}: numeric delta ${delta} exceeds ${NATIVE_POSE_TOLERANCE}`);
   return;
  }
  if(prior===null||typeof prior!=='object'){assert.equal(next,prior,`${path}: value changed`);return;}
  assert.equal(Array.isArray(next),Array.isArray(prior),`${path}: container type changed`);
  if(Array.isArray(prior))assert.equal(next.length,prior.length,`${path}: count changed`);
  assert.deepEqual(Object.keys(next).sort(),Object.keys(prior).sort(),`${path}: fields changed`);
  for(const name of Object.keys(prior))same(prior[name],next[name],`${path}.${name}`,name);
 }
 same(before.routes,after.routes,'routes');
 assert.equal(after.renderSamples.length,before.renderSamples.length,'Native milestone count changed');
 const samples=before.renderSamples.map((prior,i)=>{
  const next=after.renderSamples[i];
  for(const key of ['level','elapsed','player','camera','portals'])same(prior[key],next[key],`renderSamples.${i}.${key}`,key);
  return {sample:i,elapsed:next.elapsed,
   before:{passes:prior.passes,calls:prior.calls,triangles:prior.triangles},
   after:{passes:next.passes,calls:next.calls,triangles:next.triangles}};
 });
 return {pass:true,baseRevision:'3d9e1d22f6765aac53140fb5ee49d0334109c80b',revision,
  renderer:after.renderer,numericTolerance:NATIVE_POSE_TOLERANCE,maxNumericDelta,maxNumericDeltaPath,numericComparisons,samples};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const directory=process.argv[2]??'early-art';
 const read=phase=>JSON.parse(fs.readFileSync(`${directory}/${phase}/report.json`));
 const result=compareEarlyArt(read('before'),read('after'),{revision:process.env.GITHUB_SHA??null});
 fs.writeFileSync(`${directory}/comparison.json`,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
