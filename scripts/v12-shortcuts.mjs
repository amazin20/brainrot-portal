import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
const g=await createHeadlessGame(),V=(...p)=>new THREE.Vector3(...p);
const report={scope:'Bounded production-physics jumps and early ray probes; fixtures are NOT positive solution routes.',jumpAttempts:0,bypasses:[],sightProbes:0,earlyShots:[],levels:[]};
for(let index=5;index<10;index++){
 await g.selectLevel(index,false);let attempts=0;
 for(const [stageIndex,s]of g.firstLevel.stages.entries()){
  let from,to,reached;
  if(s.type==='fling'){
   from=[[-3.48,5,2.5],[-3.48,5,1],[-4.5,5,2.5]].map(p=>s.point(...p));
   to=[[6,3.5,4.7],[8,3.5,5],[11,3.5,6]].map(p=>s.point(...p));
   reached=p=>{const sign=s.reverse?-1:1,x=(p.x-s.origin[0])*sign,z=(p.z-s.origin[2])*sign;return x>5.8&&x<13&&z>4.5&&z<13&&p.y>=s.landingY-.01;};
  }else{
   from=[-2,0,2].map(x=>V(x,0,s.z+2.8));to=[-2,0,2].map(x=>V(x,s.type==='lift'?5:0,s.z-(s.type==='lift'?8.4:4)));
   reached=p=>s.type==='lift'?p.z<s.z-8&&p.y>=4.99:p.z<s.z-.7;
  }
  for(const start of from)for(const end of to)for(const carried of [false,true])for(const elevation of [0,.9]){
   g.resetRun(true);g.playerPosition.copy(start);g.playerPosition.y+=elevation;g.previousPlayerPosition.copy(g.playerPosition);g.playerGrounded=true;g.coyoteTime=.1;
   const direction=end.clone().sub(start);direction.y=0;direction.normalize();g.yaw=0;g.input.getMove=()=>new THREE.Vector2(direction.x,direction.z);
   g.input.keys.add('ShiftLeft');g.input.jumpQueued=true;g.heldCube=carried?g.cargo:null;g.playerVelocity.copy(direction).multiplyScalar(carried?4.5:5);
   let hit=false;for(let n=0;n<300;n++){g.updatePlayer(1/120);if(g.playerGrounded&&reached(g.playerPosition)){hit=true;break;}if(g.playerPosition.y< -9)break;}
   attempts++;if(hit)report.bypasses.push({level:index+1,stage:stageIndex+1,start:start.toArray(),end:end.toArray(),carried,elevation});
  }
 }
 g.resetRun(true);g.scene.updateMatrixWorld(true);
 const stages=g.firstLevel.stages;
 for(const [i,s]of stages.entries()){
  const starts=s.type==='fling'?[-8,-6,-3.6].flatMap(x=>[-8,-3,2].map(z=>s.point(x,6.75,z))):[-6,0,6].flatMap(x=>[3,8,12].map(z=>V(x,1.75,s.z+z)));
  const targets=[];
  if(s.receiver)targets.push({stage:i,frame:s.receiver.getFrame()});
  for(let j=i+1;j<stages.length;j++){
   const t=stages[j];
   for(const p of [t.input,t.entry,t.receiver,t.lift?.panel])if(p)targets.push({stage:j,frame:p.getFrame()});
   if(t.rotator)targets.push({stage:j,frame:t.rotator.mechanism.getPortalFrame()});
   if(t.pad)targets.push({stage:j,frame:t.pad.mechanism.getPortalFrame()});
  }
  for(const start of starts)for(const target of targets){
   const delta=target.frame.center.clone().sub(start),distance=delta.length(),direction=delta.normalize();
   if(direction.dot(target.frame.normal)>=-.02)continue;
   const ray=new THREE.Raycaster(start,direction,0,distance+.05);
   const first=ray.intersectObjects(g.aimBlockers,true).find(h=>(h.object.visible||h.object.userData.collisionProxy)&&g.isActiveBlocker(h.object));
   report.sightProbes++;
   if(first?.object.userData.portalable&&first.distance>=distance-.3)report.earlyShots.push({level:index+1,fromStage:i+1,toStage:target.stage+1,start:start.toArray(),target:target.frame.center.toArray()});
  }
 }
 report.jumpAttempts+=attempts;report.levels.push({level:index+1,jumpAttempts:attempts,stages:stages.length});console.log('Extended audit',index+1,attempts,'jumps');
}
fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/v12-shortcuts.json',JSON.stringify(report,null,2));
assert.equal(report.bypasses.length,0,'Direct jump shortcut');assert.equal(report.earlyShots.length,0,'Later portal visible before its stage');
console.log('PASS',report.jumpAttempts,'jump attempts;',report.sightProbes,'early sight probes');g.physics.dispose();g.portals.dispose();
