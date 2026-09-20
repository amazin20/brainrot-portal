import assert from 'node:assert/strict';

/** Route poses contain player position/velocity, cargo position, camera pose,
 * FOV, then the exact discrete fields teleportCount/state/held. Equivalent
 * floating-point matrix evaluation orders can differ in their final bits;
 * sub-nanometre absolute tolerance accepts that rounding, never changed input
 * timing, transitions, route length or gameplay-scale displacement. */
export function compareRenderTraces(before,after,{absoluteTolerance=1e-9}={}){
 assert.ok(Array.isArray(before)&&Array.isArray(after),'full raw render traces required');
 assert.ok(before.length>0,'render trace must contain frames');
 assert.equal(after.length,before.length,'same number of simulated display frames');
 assert.ok(absoluteTolerance>0&&absoluteTolerance<=1e-9,'comparison tolerance must stay strict');
 const result={frames:before.length,absoluteTolerance,maxAbsoluteDifference:0,maxFrame:null,maxField:null,roundedValues:0};
 for(let frame=0;frame<before.length;frame++){
  const a=before[frame],b=after[frame];
  assert.equal(a.length,20,'complete pose layout');assert.equal(b.length,20,'complete pose layout');
  for(let field=0;field<20;field++){
   if(field>=17){assert.equal(b[field],a[field],`discrete route state frame ${frame}, field ${field}`);continue;}
   assert.ok(Number.isFinite(a[field])&&Number.isFinite(b[field]),`finite pose frame ${frame}, field ${field}`);
   const difference=Math.abs(a[field]-b[field]);
   if(difference>0)result.roundedValues++;
   if(difference>result.maxAbsoluteDifference){result.maxAbsoluteDifference=difference;result.maxFrame=frame;result.maxField=field;}
   assert.ok(difference<=absoluteTolerance,`route pose changed at frame ${frame}, field ${field}: ${a[field]} → ${b[field]} (difference ${difference}, tolerance ${absoluteTolerance})`);
  }
 }
 return result;
}
