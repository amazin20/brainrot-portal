import test from 'node:test';
import assert from 'node:assert/strict';
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
