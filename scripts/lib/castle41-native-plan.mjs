import assert from 'node:assert/strict';

// This is a research consumer of an existing build, never a build recipe.
export const PIN=Object.freeze({
 repo:'amazin20/brainrot-portal',commit:'8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e',
 tree:'1bb0546cb29fe6919209103ece67d20a7ddb2377',run:37733898439,attempt:1,
 artifact:11531051164,artifactName:'campaign-browser',artifactBytes:4315287,
 outerSha256:'c67d6ece4c65d0fe0f762626c5107fc32d7238974fe2c03a194bb831f055bf4a',
 buildInfoSha256:'3136174c7d142880fb6290b243636af35abde5f0cd98ca75323c8e140054d844',
 sourceInputsSha256:'dfaa06820a807f14a0c9bcb321f165912335716c533b03ddb249c6303789c93a',
 sourceInputFiles:277,packageFilesSha256:'c6d43e3a84c769fc72e5793c0328345da17eb8b7dc817993f99fb5ddf1f3b665',
 workflow:'.github/workflows/verified-build.yml',workflowSha256:'2b8ac9e5b33666399bec1d39f01333ca45f96079a2dd419ca2e06481097b0fca',
 captureHelperSha256:'9af34e80cc9e935e63725098134f3ee218b51c5f10602f48443e0b133d123904',
 controlsSha256:'5d5b60dab09325719ed18153c289afebc3767c7585b07f73dd23eca38544ddae',
 inputSha256:'9c426261cc522c6a632672875f0b14e68422f3dd4f46dd18e2ba888c4a00c530',
});
export const ORDER=['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','crown'];
export const LIMITS=Object.freeze({captures:18,detourVisualFrames:30000,totalVisualFrames:120000,
 legVisualFrames:5400,aimIterations:60,settleVisualFrames:600,wallMs:2700000});
export const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const near=(a,b,t=.006)=>distance(a,b)<t;
function project(p,a,b){const d=b.map((v,i)=>v-a[i]),len=d.reduce((s,v)=>s+v*v,0);
 const t=Math.max(0,Math.min(1,p.reduce((s,v,i)=>s+(v-a[i])*d[i],0)/(len||1)));
 return {p:a.map((v,i)=>v+t*d[i]),t};}

/** Source-derived infrastructure routing. Returns movement targets only.
 * Endpoints may connect to their nearest authored gallery; the ordinary
 * controller must still reach each target through collision and gravity. */
export function infrastructureRoute(start,end,edges){
 assert.ok(edges.length,'No authored infrastructure');
 const points=[start,end,...edges.flat()];
 for(const [a,b]of edges)for(const [c,d]of edges){
  if(a[1]!==b[1]||c[1]!==d[1]||a[1]!==c[1])continue;
  const ax=a[0]!==b[0],cx=c[0]!==d[0];if(ax===cx)continue;
  const [h,v]=ax?[[a,b],[c,d]]:[[c,d],[a,b]],p=[v[0][0],a[1],h[0][2]];
  if(p[0]>=Math.min(h[0][0],h[1][0])-.01&&p[0]<=Math.max(h[0][0],h[1][0])+.01&&
   p[2]>=Math.min(v[0][2],v[1][2])-.01&&p[2]<=Math.max(v[0][2],v[1][2])+.01)points.push(p);
 }
 for(const p of [start,end]){const closest=edges.map(([a,b])=>project(p,a,b).p).sort((a,b)=>distance(p,a)-distance(p,b))[0];points.push(closest);}
 const nodes=[...new Map(points.map(p=>[p.map(v=>Math.round(v*100)/100).join(','),p])).values()];
 const adj=nodes.map(()=>[]),si=nodes.findIndex(p=>near(p,start)),ei=nodes.findIndex(p=>near(p,end));
 assert.ok(si>=0&&ei>=0,'Missing endpoint');
 for(const [a,b]of edges){const on=nodes.map((p,i)=>({p,i,...project(p,a,b)})).filter(n=>distance(nodes[n.i],n.p)<.05).sort((a,b)=>a.t-b.t);
  for(let i=1;i<on.length;i++){const u=on[i-1].i,v=on[i].i,w=distance(nodes[u],nodes[v]);adj[u].push([v,w]);adj[v].push([u,w]);}}
 for(const i of [si,ei])if(!adj[i].length){const n=nodes.map((p,j)=>({j,d:distance(nodes[i],p)})).filter(n=>n.j!==i&&adj[n.j].length).sort((a,b)=>a.d-b.d)[0];
  assert.ok(n,'Missing route junction');adj[i].push([n.j,n.d]);adj[n.j].push([i,n.d]);}
 const ds=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),seen=new Set();ds[si]=0;
 while(!seen.has(ei)){let u=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(u<0||ds[i]<ds[u]))u=i;
  assert.ok(u>=0&&Number.isFinite(ds[u]),'Disconnected infrastructure');seen.add(u);
  for(const [v,w]of adj[u])if(ds[u]+w<ds[v]){ds[v]=ds[u]+w;previous[v]=u;}}
 const route=[];for(let u=ei;u!==si;u=previous[u])route.unshift(nodes[u]);return route;
}

export function assertMemoryPhase(phase,s){
 const m=s.memory;assert.ok(s.sameCargoObject&&s.sameBodyObject,'Original physical companion changed');
 assert.equal(s.resets+s.respawns+s.cargoResets,0,'Attempt restarted');
 const h=m.hydraulic.retainingNotch,o=m.optical.retainingNotch;
 if(phase==='zero'){assert.equal(h,0);assert.equal(o,0);assert.equal(m.inputs.hydraulic,0);assert.equal(m.inputs.optical,0);assert.ok(s.doorGap<.01);}
 else if(phase==='one-sided'){assert.equal(h,1);assert.equal(o,0);assert.ok(m.inputs.hydraulic>.99);assert.equal(m.inputs.optical,0);assert.ok(s.doorGap<.01);}
 else if(phase==='both-latched'){assert.equal(h,1);assert.equal(o,1);assert.ok(m.inputs.hydraulic>.99);assert.equal(m.inputs.optical,1);assert.ok(s.doorGap>6.9);}
 else if(phase==='both-latched-off-optics'){assert.equal(h,1);assert.equal(o,1);assert.ok(m.inputs.hydraulic>.99);assert.equal(m.inputs.optical,0);assert.ok(s.doorGap>6.9);
  assert.equal(s.light.turned,false);assert.equal(s.light.beamPowered,false);}
 else if(phase==='both-off'||phase==='exit'){assert.equal(h,1);assert.equal(o,1);assert.equal(m.inputs.hydraulic,0);assert.equal(m.inputs.optical,0);assert.ok(s.doorGap>6.9);
  assert.equal(s.water.flowing,false);assert.ok(s.water.height< -4.97);assert.equal(s.light.turned,false);assert.equal(s.light.beamPowered,false);}
 else assert.fail('Unknown archive phase '+phase);
 if(phase==='exit'){assert.ok(s.player[0]< -27.7);assert.ok(Math.abs(s.player[1]-18)<.1);assert.ok(Math.abs(s.player[2]-30)<.4);assert.equal(s.grounded,true);}
}
