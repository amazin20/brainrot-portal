import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWER_STAGES} from '../src/game/LabTowerLayout.js';
import {towerCourse} from '../src/game/LabTowerCourses.js';

const PLAYER_RADIUS=.36,CARRIED_RADIUS=.62,PLAYER_HEIGHT=1.8;
function intersectsActor(p,box){
 if(box.role==='step'&&box.y+box.height/2-p.y<=.37)return false;
 const radius=box.height>PLAYER_HEIGHT?CARRIED_RADIUS:PLAYER_RADIUS;
 const horizontal=Math.abs(p.s-box.s)<box.along/2+radius
  &&Math.abs(p.n-box.n)<box.across/2+radius;
 const lower=box.y-box.height/2,upper=box.y+box.height/2;
 return horizontal&&p.y<upper-.015&&p.y+PLAYER_HEIGHT>lower+.015;
}

test('Tower course plans include the skybridge and accumulator chamber with physical, reversible paths',()=>{
 const plans=TOWER_STAGES.map(towerCourse);
 assert.equal(new Set(plans.map(p=>p.id)).size,18);
 assert.deepEqual([...new Set(plans.map(p=>p.topology))].sort(),
  ['accumulator-maze','broken-skybridge','enclosed-annex','forked-island','momentum-shaft','raised-causeway']);
 assert.equal(plans.filter(p=>p.topology==='enclosed-annex').length,6);
 assert.equal(plans.filter(p=>p.topology==='momentum-shaft').length,1);
 assert.equal(plans.filter(p=>p.topology==='raised-causeway').length,5);
 for(const [index,plan]of plans.entries()){
  const stage=TOWER_STAGES[index],last=plan.waypoints.at(-1);
  assert.deepEqual(last,{s:38,n:stage.reactorN,y:0,kind:'walk'});
  if(plan.topology!=='broken-skybridge')
   assert.deepEqual(plan.returnWaypoints,plan.waypoints.slice(0,-1).reverse());
  if(plan.topology==='momentum-shaft'){
   assert.equal(stage.id,'exchange');
   assert.equal(plan.solids.length,0,'The physical shaft replaces the terrace solids');
  }else assert.ok(plan.solids.length>=4);
  for(const point of plan.waypoints){
   assert.ok(point.s>28&&point.s<=38,`${stage.id}: goal path after the gate`);
   assert.ok(point.n>=plan.bounds.minN+.36&&point.n<=plan.bounds.maxN-.36,
    `${stage.id}: inside course footprint`);
   assert.ok(!plan.solids.some(box=>intersectsActor(point,box)),
    `${stage.id}: player body overlaps a course solid at ${JSON.stringify(point)}`);
  }
  if(!['raised-causeway','broken-skybridge'].includes(plan.topology)){
   let previous={s:28.4,n:0,y:0};
   for(const next of plan.waypoints){
    const length=Math.hypot(next.s-previous.s,next.n-previous.n);
    for(let step=1;step<=Math.ceil(length/.08);step++){
     const t=step/Math.ceil(length/.08);
     const position={s:previous.s+(next.s-previous.s)*t,
      n:previous.n+(next.n-previous.n)*t,y:0};
     assert.ok(!plan.solids.some(box=>intersectsActor(position,box)),
      `${stage.id}: route segment collides near ${JSON.stringify(position)}`);
    }
    previous=next;
   }
  }
  if(plan.topology==='enclosed-annex'){
   assert.equal(plan.wallGaps.length,2);
   assert.equal(plan.floors.length,1);
   assert.ok(plan.waypoints.some(p=>Math.abs(p.n)>7),`${stage.id}: route actually enters annex`);
   assert.ok(plan.solids.some(b=>b.role==='partition'&&b.across>11),
    `${stage.id}: main aisle has a real physical diversion`);
   for(const gap of plan.wallGaps){
    assert.ok(gap.s0>=28&&gap.s1<=38&&gap.s1-gap.s0>=2,
     `${stage.id}: side wall doorway is wide enough for the player`);
   }
  }else if(plan.topology==='broken-skybridge'){
   assert.equal(plan.wallGaps.length,2);
   assert.equal(plan.floors.length,4);
   assert.equal(plan.waypoints.filter(p=>p.kind==='jump').length,1);
   assert.equal(plan.returnWaypoints.filter(p=>p.kind==='jump').length,1);
   assert.ok(plan.waypoints.some(p=>p.y>=1.2&&p.n>20));
   assert.ok(!plan.floors.some(f=>f.s0<33&&f.s1>33&&f.n0<20.8&&f.n1>20.8),
    'The crossing needs an actual missing floor span');
  }else if(plan.topology==='accumulator-maze'){
   assert.equal(plan.wallGaps.length,2);
   assert.equal(plan.floors.length,2);
   assert.equal(plan.solids.filter(b=>b.role==='machine'&&b.height>7).length,5);
   assert.ok(plan.waypoints.some(p=>p.n>11)&&plan.waypoints.some(p=>p.n< -11),
    'The route reaches both outer wall openings');
  }else if(stage.id==='battery'){
   assert.equal(plan.topology,'forked-island');
   assert.equal(plan.wallGaps.length,1);
   assert.equal(plan.floors.length,3);
   assert.ok(plan.batteryBridge?.s1-plan.batteryBridge?.s0>5,
    'The beam charged transfer bridge spans a real nonjumpable floor gap');
   assert.ok(plan.solids.some(box=>box.role==='step'&&box.n>10),
    'The raised capacitor socket needs physical access');
  }else{
   assert.equal(plan.wallGaps.length,0);
   assert.equal(plan.floors.length,0);
  }
 }
});
