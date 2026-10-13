/** New finite support-graph shortcuts. Only movement/jump/E inputs change.
 * Initial room geometry suggests a path; production collisions decide whether
 * a step is reachable. Failed approaches never count as a blocked exploit. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const g=await createHeadlessGame();g.chamberEdition='foundation';
const rooms=(process.env.ROOMS||Array.from({length:51},(_,i)=>i+1).join(',')).split(',').map(Number);
const out=process.env.QA_OUT||'qa/atlas-roof-probes.json';fs.mkdirSync(path.dirname(out),{recursive:true});
const hash=()=>{const h=crypto.createHash('sha256');for(const f of fs.readdirSync('src/game').filter(n=>n.endsWith('.js')).sort()){h.update(f);h.update(fs.readFileSync('src/game/'+f));}return h.digest('hex');};
const report={scope:'New finite input-only nearest-support graph search. Visible floors and solid tops suggest possible routes; collision contact, approach failure and reset are recorded separately. No portal, actuator, actor, velocity or victory setter is used. This is not exhaustive or a render claim.',sourceCommit:process.env.GAME_SOURCE_SHA||'local-working-tree',gameModulesSHA256:hash(),probeSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),rows:[]};
const move=new THREE.Vector2(),oldMove=g.input.getMove;g.input.getMove=()=>move.clone();let row,frames,resets;
const oldReset=g.resetRun;g.resetRun=function(...args){if(row)resets++;return oldReset.apply(this,args);};
function snap(){return {p:g.playerPosition.toArray(),v:g.playerVelocity.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,state:g.state,grounded:g.playerGrounded,teleports:g.teleportCount,cargoTransports:g.physics.portalTransports};}
function frame(){for(let n=0;n<2&&g.state==='playing';n++)g.updatePlaying(1/120);g.updateVisuals(1/60,1);frames++;if(frames%30===0&&row)row.trace.push({frame:frames,...snap()});}
function stop(){move.set(0,0);g.input.keys.clear();}
function seek(target,budget=150,{jump=false,tolerance=.3}={}){g.input.keys.add('ShiftLeft');let distance=Infinity;for(let n=0;n<budget&&g.state==='playing'&&!resets;n++){
 const delta=target.clone().sub(g.playerPosition);delta.y=0;distance=delta.length();if(distance<tolerance&&Math.abs(target.y-g.playerPosition.y)<.4&&g.playerGrounded){stop();return true;}
 if(distance>.05)delta.normalize().multiplyScalar(Math.min(1,distance*2));
 move.set(delta.x,delta.z).rotateAround(new THREE.Vector2(),g.yaw);
 if(jump&&g.playerGrounded&&n%12===0)g.input.jumpQueued=true;frame();
}stop();return g.state==='won';}
function collect(){for(const [dx,dz]of[[1.1,0],[-1.1,0],[0,1.1],[0,-1.1]]){const p=g.cargo.position.clone().add(V(dx,-.5,dz));seek(p,120,{tolerance:.6});g.interact();for(let i=0;i<20;i++)frame();if(g.heldCube)return true;if(resets)return false;}return false;}
function supports(){const list=[];const add=(kind,x0,x1,z0,z1,y)=>{if(![x0,x1,z0,z1,y].every(Number.isFinite)||x1-x0<.65||z1-z0<.65||y< -12||y>100)return;list.push({kind,x0,x1,z0,z1,y});};
 for(const f of g.floors)if(f.enabled!==false)add('floor',f.minX,f.maxX,f.minZ,f.maxZ,f.y);
 for(const c of g.colliders)if(c.enabled!==false&&!c.walkablePlane&&!c.frontPlane)add('solid-top',c.box.min.x,c.box.max.x,c.box.min.z,c.box.max.z,c.box.max.y);
 return [...new Map(list.map(s=>[JSON.stringify([s.x0,s.x1,s.z0,s.z1,s.y]),s])).values()];
}
const inside=(s,p)=>p.x>=s.x0-.1&&p.x<=s.x1+.1&&p.z>=s.z0-.1&&p.z<=s.z1+.1;
const clamp=(s,p,pad=.36)=>V(THREE.MathUtils.clamp(p.x,s.x0+pad,s.x1-pad),s.y,THREE.MathUtils.clamp(p.z,s.z0+pad,s.z1-pad));
function plan(list,p,goal,gap){const starts=list.map((s,i)=>({s,i})).filter(({s})=>inside(s,p)&&Math.abs(s.y-p.y)<.45).map(x=>x.i);if(!starts.length)return {path:[],reachedGoalSupport:false,reason:'spawn support not represented'};
 const queue=[...starts],parent=new Map(starts.map(i=>[i,-1])),distance=s=>clamp(s,goal).distanceTo(goal);let best=starts[0],bestScore=distance(list[best]);
 for(let n=0;n<queue.length;n++){const i=queue[n],a=list[i];if(distance(a)<bestScore){best=i;bestScore=distance(a);}
  for(let j=0;j<list.length;j++){if(parent.has(j))continue;const b=list[j],dy=b.y-a.y;if(dy>1.56||dy< -4.5)continue;const dx=Math.max(0,a.x0-b.x1,b.x0-a.x1),dz=Math.max(0,a.z0-b.z1,b.z0-a.z1);if(Math.hypot(dx,dz)>gap)continue;parent.set(j,i);queue.push(j);}
 }
 const route=[];for(let i=best;i!==-1;i=parent.get(i))route.unshift(list[i]);return {path:route,reachedGoalSupport:inside(list[best],goal)&&Math.abs(list[best].y-goal.y)<.5,nearestGoalDistance:bestScore,exploredSupports:parent.size};
}
try{for(const room of rooms){if(!Number.isInteger(room)||room<1||room>51)throw Error('Invalid room');await g.selectLevel(room-1,false);
 for(const carry of [false,true]){row=null;g.resetRun(true);stop();frames=resets=0;row={room,carryRequested:carry,start:snap(),trace:[],contacts:[]};const original=g.cargo,body=g.physics.cargoBody;
 try{for(let n=0;n<30;n++)frame();row.collected=carry?collect():false;
  if(resets)row.outcome='setup-reset-not-a-blocking-proof';else if(carry&&!row.collected)row.outcome='cargo-approach-failed-not-a-blocking-proof';else{
   const geometry=supports(),l=g.firstLevel,goal=l.goal?.position||(l.singularity?V(...l.machines.get('crown').state.contact):null);if(!goal)throw Error('No physical goal position');row.plan=plan(geometry,g.playerPosition,goal,carry?3.6:4.1);
   let reached=true;for(let i=1;i<Math.min(row.plan.path.length,21)&&g.state==='playing'&&!resets;i++){
    const a=row.plan.path[i-1],b=row.plan.path[i],arrival=clamp(b,g.playerPosition,.45),departure=clamp(a,arrival,.48);departure.y=g.playerPosition.y;
    const approach=seek(departure,150,{tolerance:.4});row.contacts.push({step:i,phase:'approach',reached:approach,...snap()});
    if(!approach||resets){reached=false;break;}g.input.jumpQueued=true;const landed=seek(arrival,180,{jump:true,tolerance:.6});row.contacts.push({step:i,phase:'landing',reached:landed,...snap()});if(!landed){reached=false;break;}
   }
   if(reached&&!resets&&g.state==='playing')row.finalRush=seek(goal,240,{jump:true,tolerance:.15});
   row.outcome=g.state==='won'?'completion-requires-causal-review':resets?'production-reset-during-attempt':!row.plan.path.length?'no-geometric-start-support':!reached?'planned-support-approach-not-reached':'finite-support-route-no-completion';
  }
 }catch(error){row.error=String(error);row.outcome='driver-error';process.exitCode=1;}
 row.frames=frames;row.resets=resets;row.final=snap();row.sameCompanion=g.cargo===original&&g.physics.cargoBody===body;report.rows.push(row);fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(room,carry,row.outcome,frames);row=null;
 }}
}finally{g.input.getMove=oldMove;g.resetRun=oldReset;g.physics.dispose();g.portals.dispose();report.gameModulesAfterSHA256=hash();report.sourceStable=report.gameModulesSHA256===report.gameModulesAfterSHA256;report.counts=Object.fromEntries([...new Set(report.rows.map(r=>r.outcome))].map(k=>[k,report.rows.filter(r=>r.outcome===k).length]));fs.writeFileSync(out,JSON.stringify(report,null,2));console.log('ROOF PROBES',JSON.stringify(report.counts));}
