import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {infrastructureRoute,assertMemoryPhase} from '../scripts/lib/castle41-native-plan.mjs';
const s=(h=0,o=0,hp=0,op=0,gap=0)=>({sameCargoObject:true,sameBodyObject:true,resets:0,respawns:0,cargoResets:0,
 memory:{hydraulic:{retainingNotch:h},optical:{retainingNotch:o},inputs:{hydraulic:hp,optical:op}},doorGap:gap,
 water:{flowing:false,height:-5},light:{turned:false,beamPowered:false},player:[-28,18,30],grounded:true});
test('gallery route follows supported turns and the genuine ramp rather than a straight cross-storey shortcut',()=>{
 const edges=[[[0,0,54],[0,0,-52]],[[0,0,-52],[-6,0,-52]],[[-6,0,-52],[-6,18,18]],[[-6,18,18],[0,18,18]],[[0,18,18],[0,18,30]],[[0,18,30],[-21,18,30]]];
 const route=infrastructureRoute([0,0,54],[-10,18,30],edges);
 assert.ok(route.some(p=>p.every((v,i)=>v===edges[2][0][i])),'Must reach ramp foot');
 assert.ok(route.some(p=>p.every((v,i)=>v===edges[2][1][i])),'Must reach ramp landing');
 assert.deepEqual(route.at(-1),[-10,18,30]);
 for(let i=1;i<route.length;i++)assert.ok(edges.some(([a,b])=>{
  const d=b.map((v,j)=>v-a[j]);const on=p=>{const n=d.reduce((x,v)=>x+v*v,0),t=p.reduce((x,v,j)=>x+(v-a[j])*d[j],0)/n;
   return t>=-.001&&t<=1.001&&Math.hypot(...p.map((v,j)=>v-a[j]-t*d[j]))<.001;};return on(route[i-1])&&on(route[i]);}),'No unauthored crossing');
});
test('a disconnected gallery cannot become an invented movement connection',()=>{
 assert.throws(()=>infrastructureRoute([0,0,0],[10,18,0],[[[0,0,0],[0,0,2]],[[10,18,0],[10,18,2]]]),/Disconnected/);
});
test('one-sided evidence rejects an open door, a second powered source or a replaced companion',()=>{
 assert.doesNotThrow(()=>assertMemoryPhase('one-sided',s(1,0,1,0,0)));
 assert.throws(()=>assertMemoryPhase('one-sided',s(1,0,1,0,7)));
 assert.throws(()=>assertMemoryPhase('one-sided',s(1,0,1,1,0)));
 const replaced=s(1,0,1,0,0);replaced.sameBodyObject=false;assert.throws(()=>assertMemoryPhase('one-sided',replaced));
});
test('retained passage evidence rejects live power, moving water, below-deck falls and reset attempts',()=>{
 assert.doesNotThrow(()=>assertMemoryPhase('exit',s(1,1,0,0,7)));
 for(const mutate of [x=>x.memory.inputs.optical=1,x=>x.water.flowing=true,x=>x.player[1]=-4,x=>x.grounded=false,x=>x.resets=1]){
  const x=s(1,1,0,0,7);mutate(x);assert.throws(()=>assertMemoryPhase('exit',x));
 }
});

// Execute the exact deployed page callback independently of Puppeteer. This
// checks its tick/control contract; it does not stand in for WebGL images.
function detourBatch(g,q,document){
 const source=fs.readFileSync(new URL('../scripts/qa-castle41-native.mjs',import.meta.url),'utf8');
 const start=source.indexOf('await page.evaluate(n=>{',source.indexOf('async function step('));
 const end=source.indexOf('\n},n);',start);assert.ok(start>=0&&end>start,'Find the deployed detour callback');
 return vm.runInNewContext('('+source.slice(start+'await page.evaluate('.length,end)+'\n})',
  {window:{__NESI_DEMO_GAME__:g,__ARCHIVE_REVIEW__:q},document});
}
test('still detour batches retain every fixed and visual tick while submitting no redundant draw',()=>{
 const calls=[],canvas={},move=()=>{},g={state:'playing',externalBlocked:false,input:{getMove:move},renderer:{domElement:canvas},
  updatePlaying(dt){calls.push(['physics',dt]);},updateVisuals(dt,alpha){calls.push(['visual',dt,alpha]);},render(){throw Error('Unexpected batch render');}};
 const step=detourBatch(g,{detour:true,originalMove:move},{pointerLockElement:canvas});
 for(const n of [1,4,6,2,18])step(n);
 assert.equal(calls.length,31*3);
 for(let i=0;i<31;i++)assert.deepEqual(calls.slice(i*3,i*3+3),[['physics',1/120],['physics',1/120],['visual',1/60,1]]);
});
test('the deployed detour callback refuses lost lock, adapted input and inactive attempts before ticking',()=>{
 for(const fault of ['lock','adapter','driver','paused','blocked']){
  let ticks=0;const canvas={},move=()=>{},g={state:'playing',externalBlocked:false,input:{getMove:move},renderer:{domElement:canvas},
   updatePlaying(){ticks++;},updateVisuals(){ticks++;},render(){ticks++;}},q={detour:true,originalMove:move},document={pointerLockElement:canvas};
  if(fault==='lock')document.pointerLockElement=null;if(fault==='adapter')g.input.getMove=()=>{};
  if(fault==='driver')q.detour=false;if(fault==='paused')g.state='paused';if(fault==='blocked')g.externalBlocked=true;
  assert.throws(()=>detourBatch(g,q,document)(4));assert.equal(ticks,0);
 }
});
