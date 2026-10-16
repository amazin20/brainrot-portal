import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {hasCurrentUpperRide} from '../scripts/lib/v58-readability-capture.mjs';
const witness=()=>({ready:true,disposed:false,currentCollisionValid:true,worldStep:1002,contactStep:1002,rideTicks:80,rideLow:{worldStep:900,bodyId:14,shapeId:140},height:1.2,lift:{id:14,velocity:[0,.9,0]},deckShapeId:140});
test('current diagnostics and a newly counted real support step select the ride, including browser serialization',()=>{
 const d=witness(),before=structuredClone(d);assert.equal(hasCurrentUpperRide(d,78,1002,true),true);assert.equal(vm.runInNewContext('('+hasCurrentUpperRide.toString()+')')(d,78,1002,true),true);assert.deepEqual(d,before);
});
const rejects={
 'uninitialized cell':d=>d.ready=false,'disposed cell':d=>d.disposed=true,'invalid live collision':d=>d.currentCollisionValid=false,
 'stale world clock':d=>d.worldStep--,'stale contact clock':d=>d.contactStep--,'no new support step':d=>d.rideTicks=78,
 'missing low ride witness':d=>d.rideLow=null,'future low witness':d=>d.rideLow.worldStep=1002,
 'foreign lift body':d=>d.rideLow.bodyId=15,'foreign deck shape':d=>d.rideLow.shapeId=141,
 'below selected ascent window':d=>d.height=.8,'above selected ascent window':d=>d.height=3,
 'resting car':d=>d.lift.velocity[1]=0,'descending car':d=>d.lift.velocity[1]=-.9,
};
for(const[name,mutate]of Object.entries(rejects))test('ride selection rejects '+name,()=>{const d=witness();mutate(d);assert.equal(hasCurrentUpperRide(d,78,1002,true),false);});
test('airborne player or absent diagnostics cannot select a ride',()=>{assert.equal(hasCurrentUpperRide(witness(),78,1002,false),false);assert.equal(hasCurrentUpperRide(undefined,78,1002,true),false);});
