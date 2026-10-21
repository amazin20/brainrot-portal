import {installPreciseLateAim,aimLateSurface} from './LabLateCampaignAim.js';
import * as THREE from 'three';
const check=(v,m)=>{if(!v)throw Error(m);};
function hopWalk(d,x,z){for(let n=0;n<1200;n++){const dx=x-d.game.playerPosition.x,dz=z-d.game.playerPosition.z,r=Math.hypot(dx,dz);if(r<.11){d.stop();d.until(()=>d.game.playerGrounded,3,'Ordinary debris jump did not land');return;}if(n%45===0)d.game.input.jumpQueued=true;const pace=Math.min(1,r*1.5);d.worldMove(dx/r*pace,dz/r*pace);d.frame();}d.stop();throw Error(`Physical debris blocked the ordinary jump route to ${x},${z}`);}
function crossArchive(d,z){d.walk(0,d.game.playerPosition.z>-4?-1.8:-8.2);hopWalk(d,0,z);}
function archiveOpening(d){const box=d.level.sheet.collider.box;return {box,x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2};}
function reachArchiveSide(d,side){
 const opening=archiveOpening(d),standOff=2.8;
 if((d.game.playerPosition.z-opening.z)*side>=standOff-.3)return;
 const beforeSide=d.game.playerPosition.z<opening.z?-1:1;
 if(beforeSide!==side)hopWalk(d,opening.x,opening.z+beforeSide*standOff);
 hopWalk(d,opening.x,opening.z+side*standOff);
}
function approachBrokenArchive(d,p,attempt){
 // A real impact can leave the original body beside either jamb. Approaching
 // every body from x-1.15 can put the target inside the intact 27m partition.
 // Read the original broken aperture, cross its actual opening first, then
 // approach from the cargo's side of that wall using ordinary jump inputs.
 const g=d.game,opening=archiveOpening(d),candidates=[],ray=new THREE.Raycaster();g.scene.updateMatrixWorld(true);
 // Read the same real support and blocker geometry a normal E press uses.
 // A low body beside a tilted fragment can be close to the feet while a
 // fragment still blocks the hand. Try an actually clear side instead of
 // asserting pickup from proximity or disabling any debris collision.
 for(const radius of [1.05,1.40,1.75])for(let i=0;i<16;i++){
  const a=i*Math.PI/8,x=p.x+Math.cos(a)*radius,z=p.z+Math.sin(a)*radius;
  const support=g.sampleFootSupport(x,z,2.1),y=support?.height;if(!Number.isFinite(y)||y<-.1)continue;
  const blocked=g.colliders.some(c=>{
   if(c.enabled===false||c.walkablePlane||c.box.max.y<=y+.37||c.box.min.y>=y+2.4)return false;
   const dx=x-THREE.MathUtils.clamp(x,c.box.min.x,c.box.max.x),dz=z-THREE.MathUtils.clamp(z,c.box.min.z,c.box.max.z);
   return dx*dx+dz*dz<.45*.45;
  });if(blocked)continue;
  const hand=new THREE.Vector3(x,y+1.1,z),delta=p.clone().sub(hand),distance=delta.length();if(distance>=2.20)continue;
  ray.set(hand,delta.normalize());ray.far=Math.max(0,distance-.1);
  if(ray.intersectObjects(g.cameraBlockers,true).some(hit=>hit.distance<distance-.1&&g.isActiveBlocker(hit.object)))continue;
  candidates.push({x,z,score:y*3+Math.hypot(x-g.playerPosition.x,z-g.playerPosition.z)*.1});
 }
 candidates.sort((a,b)=>a.score-b.score);
 const side=p.z<opening.z?-1:1;
 const target=candidates[attempt%Math.min(4,candidates.length)]??{x:opening.x,z:p.z+side*1.25};
 reachArchiveSide(d,target.z<opening.z?-1:1);
 hopWalk(d,target.x,target.z);
}
function collect(d){for(let n=0;n<12;n++){const p=d.game.cargo.position.clone(),amongDebris=d.level.fuse.broken&&Math.abs(p.x)<6&&p.z>-10&&p.z< -1;if(d.level.fuse.broken&&p.x>3&&p.x<17&&p.z< -7&&p.z> -17){const x=p.x>4.8&&p.x<13?p.x+1.25:p.x-1.25;d.walk(d.game.playerPosition.x,-12);d.walk(x,-12);d.walk(x,p.z);}else if(amongDebris)approachBrokenArchive(d,p,n);else d.walk(p.x-1.25,p.z);if(d.game.playerPosition.distanceTo(d.game.cargo.position)<2.2){if(amongDebris){d.game.interact();if(d.game.heldCube){d.wait(.55);return;}}else{d.pickup();return;}}}throw Error('Original companion cannot be collected');}
function enterJump(d,p){const f=p.getFrame(),before=d.game.teleportCount;d.walk(f.center.x+f.normal.x*1.35,f.center.z+f.normal.z*1.35);for(let n=0;n<240&&d.game.teleportCount===before;n++){if(n%45===0)d.game.input.jumpQueued=true;d.worldMove(-f.normal.x,-f.normal.z);d.frame();}d.stop();check(d.game.teleportCount>before,'The actual standing aperture did not accept a normal jump');}
export function runPuzzleProgression47(d,{stopAfter=null,noCargo=false,recover=false}={}){
 const {game:g,level:l}=d;installPreciseLateAim(d);check(l.puzzleProgression===47,'Impact archive room required');
 d.walk(-8,9);d.walk(-8,25.5);d.walk(0,25.5);d.walk(0,12);d.walk(-8,7);aimLateSurface(d,0,l.well.surface);
 d.walk(-8,0);d.walk(0,0);aimLateSurface(d,1,l.outlet);d.mark('The only pair routes a real high cargo fall into the ceramic');if(stopAfter==='routed')return;
 d.walk(8,0);d.walk(8,25.5);d.walk(-8,25.5);d.walk(-8,8.0);d.walk(-12,8.1);d.walk(-23,14);collect(d);
 d.walk(-16,9.1);d.walk(-16,8.55);d.walk(-16,8.50);d.stop();d.wait(.4);check(g.interact()&&!g.heldCube,'Original cargo drop failed');
 d.until(()=>l.fuse.broken,7,'Real free cargo impact did not break ceramic');d.mark('One sufficient real impact fractures the ceramic into physical pieces');if(stopAfter==='broken')return;
 d.walk(-8,9);d.walk(-8,25.5);d.walk(6,18);d.walk(6,0);d.walk(0,0);
 if(recover){crossArchive(d,-8);d.walk(-6,-8);d.walk(0,-8);crossArchive(d,0);d.mark('The dry recovery floor returns through the genuinely opened ceramic aperture');}
 crossArchive(d,-8);d.mark('The broken opening reveals the archive service court behind the ceramic');if(stopAfter==='inspected')return;collect(d);reachArchiveSide(d,-1);d.walk(g.playerPosition.x,-12);d.walk(-16,-12);d.walk(-16,-14);d.look(l.loadSupport.center);d.stop();d.wait(.3);check(g.interact()&&!g.heldCube,'Live motor cargo release failed');
 d.until(()=>l.loaded(),4,'The original body did not settle on the live motor support');d.until(()=>l.drive.body.position.x>8.2,12,'The live cargo did not drive the actual piston to its receiving stroke');d.mark('Original cargo weight drives a dynamic piston and its attached white address');if(stopAfter==='powered')return;
 d.walk(-16,-12);d.walk(20,-12);d.walk(22,-10.5);d.wait(.2);check(g.interact(),'The far contact pin terminal is unreachable');check(l.drive.pinInserted,'Contact pin input failed');d.until(()=>Math.abs(l.drive.pinBody.position.z+19.4)<.02,5,'The actual transverse pin did not enter behind the piston');d.mark('A real removable contact pin enters the guide behind the piston');if(stopAfter==='pinned')return;
 d.walk(20,-12);d.walk(-16,-12);collect(d);d.until(()=>!l.drive.powered&&l.drive.contacts>0,4,'Cargo removal did not leave the dynamic piston resting against its physical pin');check(l.drive.body.type===1,'A pinned piston must remain dynamic');d.mark('Returning the original cargo releases the motor; true pin contact preserves alignment');if(stopAfter==='retrieved')return;
 d.walk(-16,-8);d.look(l.loadSupport.center);d.stop();d.wait(.2);check(g.interact()&&!g.heldCube,'Freeing the hands on permanent mineral floor failed');d.wait(.6);
 d.walk(-20,-8);aimLateSurface(d,0,l.entrance);d.walk(0,-16);d.walk(8.3,-16);d.walk(8.3,-14.8);aimLateSurface(d,1,l.address);
 d.walk(0,-16);d.walk(0,-8);if(!noCargo)collect(d);
 d.walk(-20,-8);enterJump(d,l.entrance);d.walk(8.3,-12);d.until(()=>g.playerGrounded,4,'The aligned high receiving terrace did not catch the original player');check(g.playerPosition.y>7.8,`Upper terrace must require the aligned actual address: ${g.playerPosition.toArray()}`);d.mark('The sole pair carries the travellers through the physically aligned moving address');
 d.walk(10,-10);if(noCargo){d.wait(.8);check(g.state!=='won','The archive goal cannot accept the player alone');return;}d.until(()=>g.state==='won',3,'Original player and original companion did not reach the archive goal');d.mark('Both original travellers reach the high archive exit');
}
