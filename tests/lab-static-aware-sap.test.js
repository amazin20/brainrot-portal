import test from 'node:test';
import assert from 'node:assert/strict';
import {World,Body,Box,Vec3,SAPBroadphase} from 'cannon-es';
import {LabStaticAwareSAP} from '../src/game/LabStaticAwareSAP.js';
let seed=190721;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function pairs(broadphase,world){const a=[],b=[];broadphase.dirty=true;broadphase.collisionPairs(world,a,b);return a.map((n,i)=>[n.id,b[i].id]);}
test('static-aware SAP preserves the exact stock pair sequence across masks, axes and moving/sleeping bodies',()=>{
 for(let iteration=0;iteration<50;iteration++){
  const world=new World();
  for(let n=0;n<80;n++){
   const group=n<65?1:n<76?2:4,mask=n<65?2:n<76?5:2;
   const body=new Body({mass:n<65?0:1,type:n%4===0?Body.KINEMATIC:n<65?Body.STATIC:Body.DYNAMIC,shape:new Box(new Vec3(.1+random()*3,.1+random()*3,.1+random()*3)),position:new Vec3(random()*20,random()*20,random()*20),collisionFilterGroup:group,collisionFilterMask:n===70?-1:mask});
   if(n%17===0)body.sleep();world.addBody(body);
  }
  for(const axis of [0,1,2])for(const useBoundingBoxes of [false,true]){
   const stock=new SAPBroadphase(world),optimized=new LabStaticAwareSAP(world);stock.axisIndex=optimized.axisIndex=axis;stock.useBoundingBoxes=optimized.useBoundingBoxes=useBoundingBoxes;
   assert.deepEqual(pairs(optimized,world),pairs(stock,world));
  }
 }
});
test('a thousand mutually masked solids do not create a quadratic scan',()=>{
 const world=new World();
 for(let i=0;i<1000;i++)world.addBody(new Body({mass:0,shape:new Box(new Vec3(.5,.5,.5)),position:new Vec3(i%20,Math.floor(i/20),0),collisionFilterGroup:1,collisionFilterMask:2}));
 world.addBody(new Body({mass:1,shape:new Box(new Vec3(.4,.4,.4)),position:new Vec3(2,2,0),collisionFilterGroup:2,collisionFilterMask:1}));
 const optimized=new LabStaticAwareSAP(world),stock=new SAPBroadphase(world);
 assert.deepEqual(pairs(optimized,world),pairs(stock,world));assert.ok(optimized.candidateChecks<=1000);
});
