import test from 'node:test';
import assert from 'node:assert/strict';
import {CROSSFLOW_BASELINE_COMMIT,assertKnownCrossflowBaselineFailure,acceptCrossflowComparison} from '../scripts/lib/crossflow-baseline-policy.mjs';

const options={baselineCommit:CROSSFLOW_BASELINE_COMMIT,route:'retrieve-first'};
function witness(){return{version:'before',view:'portrait',viewport:{width:390,height:844},pass:false,errors:[],consoleErrors:[],route:{
  state:'playing',updates:11090,sameOriginal:true,resets:0,respawns:0,cargoResets:0,deletions:0,
  player:[-20.24940038134421,16,11.852195497630987],cargo:[-16.82116803631819,.5149981471550285,20.384053626834756],
  pictures:['the original load opens a real air shutter','the first permanent gallery preserves height','crossing streams expose the upper retaining dock'].map(name=>({mark:{name}})),
  error:'Error: Portal impact rejected at -17,0.12500000000000003,21: '+JSON.stringify({valid:false,index:0,position:[-22.370422866809747,16.000000001490115,9.150404202807888],sequence:2,surface:'Return observation arm / collision',reason:'surface'})+'\n    at retained historical bundle',
}};}

test('only the exact old portrait witness matches, and its route stays failed',()=>{
  for(const route of ['retrieve-first','air-freight']){
    const row=witness(),result=assertKnownCrossflowBaselineFailure(row,{...options,route});
    assert.equal(result.matched,true);assert.equal(result.routePassed,false);assert.equal(row.pass,false);
    assert.equal(result.error,row.route.error);
  }
});

test('a different source, route, viewport or a successful baseline cannot reuse the known failure',()=>{
  for(const patch of [{baselineCommit:'f0adf70b984c50d2306f72f307e8ba3475d43183'},{route:'new-route'}])
    assert.throws(()=>assertKnownCrossflowBaselineFailure(witness(),{...options,...patch}));
  for(const change of [r=>r.version='after',r=>r.view='wide',r=>r.viewport.height=800,r=>r.pass=true]){
    const row=witness();change(row);assert.throws(()=>assertKnownCrossflowBaselineFailure(row,options));
  }
});

test('new errors, substituted actors, resets and incomplete approaches fail the negative-control gate',()=>{
  const changes=[
    r=>r.route.error='Navigation failed',r=>r.route.error=r.route.error.replace('Return observation arm / collision','Different wall / collision'),
    r=>r.route.error=r.route.error.replace('-22.370422866809747','-22.1'),r=>r.route.error=r.route.error.replace('0.12500000000000003,21','1,21'),
    r=>r.route.error=r.route.error.replace('"valid":false','"valid":true'),r=>r.route.sameOriginal=false,
    r=>r.route.updates--,r=>r.route.state='won',r=>r.route.player[0]+=.01,r=>r.route.cargo[2]+=.01,
    r=>r.route.pictures.pop(),r=>r.errors.push('WebGL failure'),r=>r.consoleErrors.push('Resource failed'),
    ...['resets','respawns','cargoResets','deletions'].map(key=>r=>r.route[key]++),
  ];
  for(const change of changes){const row=witness();change(row);assert.throws(()=>assertKnownCrossflowBaselineFailure(row,options));}
});

test('comparison requires two current wins, one baseline win and the exact failed negative control',()=>{
  const old=witness();old.baselineExpectation=assertKnownCrossflowBaselineFailure(old,options);
  const rows=[{version:'before',view:'wide',pass:true},old,{version:'after',view:'wide',pass:true},{version:'after',view:'portrait',pass:true}];
  const accepted=acceptCrossflowComparison(rows,options);
  assert.equal(accepted.pass,true);assert.equal(accepted.allRoutesPassed,false);assert.equal(accepted.baselineRoutesFailed,1);
  for(const index of [0,2,3]){const changed=structuredClone(rows);changed[index].pass=false;assert.throws(()=>acceptCrossflowComparison(changed,options));}
  const missing=structuredClone(rows);delete missing[1].baselineExpectation;assert.throws(()=>acceptCrossflowComparison(missing,options));
  const duplicated=structuredClone(rows);duplicated[3].view='wide';assert.throws(()=>acceptCrossflowComparison(duplicated,options));
});
