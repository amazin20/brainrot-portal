import {SAPBroadphase} from 'cannon-es';

/** The game has many static/kinematic solids, but only a few actor bodies.
 * Stock SAP scans every masked-out solid/solid pair before its sweep break.
 * Skip precisely those impossible pairs, retaining SAP's order, masks,
 * sleeping policy and intersection test for every eligible pair. */
export class LabStaticAwareSAP extends SAPBroadphase {
 collisionPairs(world,p1,p2){
  if(this.dirty){this.sortList();this.dirty=false;}
  const bodies=this.axisList,actors=[];
  for(let i=0;i<bodies.length;i++)if(bodies[i].collisionFilterGroup!==1)actors.push(i);
  this.candidateChecks=0;
  const pair=(a,b)=>{
   this.candidateChecks++;
   if(!this.needBroadphaseCollision(a,b))return true;
   if(!SAPBroadphase.checkBounds(a,b,this.axisIndex))return false;
   this.intersectionTest(a,b,p1,p2);return true;
  };
  for(let i=0;i<bodies.length;i++){
   const a=bodies[i];
   if(a.collisionFilterGroup===1&&!(a.collisionFilterMask&1)){
    for(const j of actors)if(j>i&&!pair(a,bodies[j]))break;
   }else{
    for(let j=i+1;j<bodies.length;j++)if(!pair(a,bodies[j]))break;
   }
  }
 }
}
