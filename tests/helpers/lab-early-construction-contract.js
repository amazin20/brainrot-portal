import assert from 'node:assert/strict';

const round=n=>Math.round(n*1e9)/1e9;
const vector=a=>a.map(round);
const at=(row,name)=>(row.mesh?.name??row.name)===name;

/** Only two existing optical signal drawings moved to meet their receivers.
 * They are also the actual camera/aim owners. Keep those owners coherent
 * with their drawing, and audit just these four query-row translations.
 * No collider, portal, terminal or other query row is exempted. */
export function originalRoom6Contract(contract){
 const baseline=structuredClone(contract);
 for(const key of ['camera','aim'])for(const p of [[0,3.475,-10.5],[9.7,3.535,-8]]){
  const rows=baseline[key].filter(r=>r.matrix[12]===p[0]&&r.matrix[14]===p[2]);
  assert.equal(rows.length,1,'An optical receiver must retain exactly one original query owner');
  const row=rows[0];
  assert.deepEqual(row,{name:'',visible:true,ancestorsVisible:true,raycastChildren:[],
   matrix:[1,0,0,0,0,1,0,0,0,0,1,0,...p,1],frame:null},
  'Only the approved live optical signal pose may differ from the original contract');
  row.matrix[13]=4.15;
 }
 return baseline;
}
function subtractClosedBodies(contract,name,approved){
 const rows=contract.colliders.filter(r=>at(r,name));assert.equal(rows.length,approved.length);
 for(let i=0;i<rows.length;i++){
  const [p,size]=approved[i],row=rows[i],half=size.map(n=>Math.fround(n/2));
  assert.deepEqual(row.mesh,{name,visible:true,ancestorsVisible:true,raycastChildren:[],matrix:[1,0,0,0,0,1,0,0,0,0,1,0,...p,1],frame:null});
  assert.deepEqual(row.box,{min:vector(p.map((n,a)=>n-half[a])),max:vector(p.map((n,a)=>n+half[a]))});
  assert.equal(row.enabled,true);assert.equal(row.frontPlane,null);
 }
 for(const k of ['camera','aim'])assert.deepEqual(contract[k].filter(r=>at(r,name)),rows.map(r=>r.mesh));
 assert.equal(contract.portalRegistry.filter(r=>at(r,name)).length,0);
 const baseline=structuredClone(contract);
 for(const k of ['colliders','camera','aim'])baseline[k]=baseline[k].filter(r=>!at(r,name));
 return baseline;
}

/** Accept only the two physically approved rear-post envelopes and the
 * single closed rear motor body, then retain every old room-nine record. */
export function originalRoom9Contract(contract){
 const baseline=subtractClosedBodies(contract,'Spring drop gantry / rear drive enclosure',[[[0,9.85,-8.75],[6.4,1.4,.65]]]);
 for(const x of [-3.4,3.4]){
  const posts=baseline.colliders.filter(r=>r.mesh.matrix[12]===x&&r.mesh.matrix[13]===6&&r.mesh.matrix[14]===-8.2);
  assert.equal(posts.length,1);const row=posts[0];
  assert.deepEqual(row.box,{min:[round(x-.224999994),0,-8.45],max:[round(x+.224999994),12,-7.95]});
  row.box={min:[round(x-.109999999),0,-8.319999997],max:[round(x+.109999999),12,-8.080000003]};
 }
 return baseline;
}

/** The closed utility bus is a real, approved extension. No other old force,
 * portal, target, load, blocker or interaction frame is exempted. */
export function originalRoom11Contract(contract){
 return subtractClosedBodies(contract,'Wind test service bus / closed power casing',[
  [[-11.6,6.55,-3.7],[.42,.42,15.4]],
  [[-11.6,4.325,4],[.24,4.45,.24]],
  [[-11.6,4.325,-11.4],[.24,4.45,.24]],
  [[-11.24,2.1,4],[.72,.24,.24]],
 ]);
}
