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

/** Independently specified reset envelopes of room eleven's output machine.
 * These are the only new physical/query owners accepted by the historical
 * art golden. Every old portal, machine, floor and interaction remains exact. */
const room11OutputBodies = [
 ['left enclosure',[-3.70,1.1,-8],[.15,2.2,1.65]],
 ['right enclosure',[-1.60,1.1,-8],[.15,2.2,1.65]],
 ['rear enclosure',[-2.65,1.1,-8.75],[1.95,2.2,.15]],
 ['enclosure roof',[-2.65,2.2,-8.075],[2.25,.16,1.35]],
 ['guide rail left',[-3.70,2.2,-7.25],[.10,4.4,.20]],
 ['guide rail right',[-1.60,2.2,-7.25],[.10,4.4,.20]],
 ['spring-return air shroud',[-2.65,3.25,-7.25],[1.95,2.1,.15],true],
 ['shaft casing',[-5.4,.18,-7.55],[.30,.36,2.52]],
 ['flywheel pedestal',[-5.4,.34,-8.8],[1.40,.68,.62]],
 ['output shaft casing',[-3.98,.18,-8.8],[2.54,.36,.30]],
];
function room11Box(name,p,size,{visible=true,kinematic}={}){
 const half=size.map(n=>Math.fround(n/2));
 return {mesh:{name:'Wind clutch / '+name,visible,ancestorsVisible:visible,raycastChildren:[],
  matrix:[1,0,0,0,0,1,0,0,0,0,1,0,...p,1],frame:null},
  box:{min:vector(p.map((n,a)=>n-half[a])),max:vector(p.map((n,a)=>n+half[a]))},
  enabled:true,...(kinematic===undefined?{}:{kinematic}),frontPlane:null};
}
function subtractRoom11Output(contract){
 const baseline=structuredClone(contract),prefix='Wind clutch / ';
 // The added command uses the same original terminal shell. Its dimensions
 // are anchored to that retained owner, whose complete row is still hashed.
 const originalCommand=baseline.colliders.filter(r=>r.mesh.matrix[12]===-4.7&&r.mesh.matrix[13]===.75&&r.mesh.matrix[14]===6);
 assert.equal(originalCommand.length,1,'The original fan terminal must retain its one physical owner');
 const command=structuredClone(originalCommand[0]);command.mesh.name=prefix+'command body';
 const delta=[2.05,0,-14];
 for(let a=0;a<3;a++){
  command.mesh.matrix[12+a]=round(command.mesh.matrix[12+a]+delta[a]);
  for(const edge of ['min','max'])command.box[edge][a]=round(command.box[edge][a]+delta[a]);
 }
 const expected=room11OutputBodies.map(([name,p,size,kinematic])=>room11Box(name,p,size,{kinematic}));
 expected.splice(7,0,command);
 expected.push(room11Box('flywheel swept body',[-5.4,1.35,-8.8],[1.44,1.44,.36],{visible:false,kinematic:false}));
 assert.deepEqual(baseline.colliders.filter(r=>r.mesh.name.startsWith(prefix)),expected,
  'Only the twelve explicitly audited output-machine envelopes may be added');
 const names=new Set(expected.map(r=>r.mesh.name));
 for(const key of ['camera','aim'])assert.deepEqual(baseline[key].filter(r=>r.name.startsWith(prefix)),expected.map(r=>r.mesh),
  'The new output machine needs exactly one matching camera/aim owner per solid');
 assert.equal(baseline.portalRegistry.some(r=>r.name.startsWith(prefix)),false,'The output machine must not add portal addresses');
 for(const key of ['colliders','camera','aim'])baseline[key]=baseline[key].filter(r=>!names.has(r.mesh?.name??r.name));
 const terminal={position:[-2.65,.8,-8],kind:'drive-clutch'};
 assert.deepEqual(baseline.terminals.filter(t=>t.kind==='drive-clutch'),[terminal]);
 baseline.terminals=baseline.terminals.filter(t=>t.kind!=='drive-clutch');
 assert.deepEqual(baseline.state['drive-clutchControl'],{...terminal,lesson:'E — подключить маховик к створкам.'});
 assert.deepEqual(baseline.state.outputDrive,{energyPerStroke:420,outputLoad:8,lastOutputWork:0,inputTorque:0,airflow:0,previousStroke:0,stroke:0,clutch:false});
 assert.equal(baseline.state.flywheel.clutch,false,'The output must start physically disconnected');
 delete baseline.state['drive-clutchControl'];delete baseline.state.outputDrive;
 baseline.state.flywheel.clutch=true;
 return baseline;
}

/** Preserve both historical room-eleven goldens after independently checking
 * the exact service bus and the intentionally new finite-work output drive.
 * No generic collider, state field or interaction exception is permitted. */
export function originalRoom11Contract(contract){
 const baseline=subtractClosedBodies(contract,'Wind test service bus / closed power casing',[
  [[-11.6,6.55,-3.7],[.42,.42,15.4]],
  [[-11.6,4.325,4],[.24,4.45,.24]],
  [[-11.6,3.275,-11.4],[.24,6.55,.24]],
  [[-11.24,2.1,4],[.72,.24,.24]],
 ]);
 return subtractRoom11Output(baseline);
}
