import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';

// These finite attacks run from each room's normal Play spawn. The driver
// changes movement/jump/E/yaw/shot inputs only; it never writes actors,
// velocities, portal planes, mechanism state, completion or puzzle flags.
// Distinct from earlier perimeter routes: attack the nearest visible solid's
// inward rounded corner while reversing the carry grip, then release/regrab
// against its underside. A missed approach is recorded, not called blocked.
const file=process.env.QA_OUT||'qa/release-collision-attacks.json',V=(...a)=>new THREE.Vector3(...a);
const g=await createHeadlessGame();g.chamberEdition='foundation';
const rooms=(process.env.ROOMS||Array.from({length:41},(_,i)=>i+1).join(',')).split(',').map(Number);
const expansionRequested=rooms.some(room=>room>41);
const sourceFiles=fs.readdirSync('src/game').filter(f=>f.endsWith('.js')
 && (expansionRequested||!f.startsWith('LabExpansion')) && f!=='LabCampaignMenu.js').sort();
const sha=()=>createHash('sha256').update(sourceFiles.map(f=>f+'\n'+fs.readFileSync('src/game/'+f)).join('\n')).digest('hex');
const report={scope:'Finite authored-room input-only inward-corner carry reversals, underside jump/release/regrab and restart during live shot. Requested rooms: '+rooms.join(',')+'. This does not prove that every exploit is absent. No render claim.',fingerprintScope:expansionRequested?'All original/expansion/core game modules; campaign-menu UI excluded.':'Original-room/core game modules; unrelated 42–51 expansion modules and campaign-menu UI excluded.',sourceFiles,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),started:new Date().toISOString(),sourceBefore:sha(),rows:[],inventory:[]};
const oldMove=g.input.getMove,move=new THREE.Vector2();g.input.getMove=()=>move.clone();let frames=0,resets=0,maxSpeed=0;
const oldReset=g.resetRun;g.resetRun=function(...a){resets++;return oldReset.apply(this,a);};
function frame(){for(let sub=0;sub<2&&g.state==='playing';sub++)g.updatePlaying(1/120);g.updateVisuals(1/60,1);frames++;maxSpeed=Math.max(maxSpeed,g.playerVelocity.length());}
function step(x,z){move.copy(new THREE.Vector2(x,z).rotateAround(new THREE.Vector2(),g.yaw));frame();}
function stop(){move.set(0,0);g.input.keys.clear();}
function toward(p,ticks,{jump=0,turn=0,everyE=0}={}){let minimumDistance=Infinity;g.input.keys.add('ShiftLeft');for(let n=0;n<ticks&&g.state==='playing';n++){
 minimumDistance=Math.min(minimumDistance,Math.hypot(p.x-g.playerPosition.x,p.z-g.playerPosition.z));
 const delta=V(p.x-g.playerPosition.x,0,p.z-g.playerPosition.z);if(delta.lengthSq()>.00001)delta.normalize();
 if(turn)delta.applyAxisAngle(V(0,1,0),turn);if(jump&&n%jump===0)g.input.jumpQueued=true;
 if(everyE&&n%everyE===0)g.interact();step(delta.x,delta.z);
}stop();return minimumDistance;}
function snap(){return {state:g.state,p:g.playerPosition.toArray(),v:g.playerVelocity.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,playerTeleports:g.teleportCount,cargoTeleports:g.physics.portalTransports,grounded:g.playerGrounded};}
function collect(){if(g.heldCube)return true;for(const [dx,dz]of[[1.15,0],[-1.15,0],[0,1.15],[0,-1.15]]){
 const p=g.cargo.position.clone().add(V(dx,0,dz));toward(p,150);if(g.interact()&&g.heldCube){for(let n=0;n<35;n++)frame();return true;}
}return false;}
function selectObstacle(){const p=g.playerPosition;return g.colliders.filter(c=>c.enabled!==false&&!c.frontPlane&&!c.walkablePlane&&c.box.max.y>p.y+.45&&c.box.min.y<p.y+4.8
 &&Math.min(c.box.max.x-c.box.min.x,c.box.max.z-c.box.min.z)<8)
 .map(c=>({c,point:c.box.clampPoint(p,V()),size:c.box.getSize(V())}))
 .filter(c=>c.point.distanceTo(p)<13).sort((a,b)=>a.point.distanceToSquared(p)-b.point.distanceToSquared(p))[0];}
function penetration(){return g.colliders.filter(c=>c.enabled!==false&&!c.frontPlane&&!c.walkablePlane&&g.playerPosition.y+.03<c.box.max.y&&g.playerPosition.y+2.36>c.box.min.y)
 .filter(c=>{const nearX=THREE.MathUtils.clamp(g.playerPosition.x,c.box.min.x,c.box.max.x),nearZ=THREE.MathUtils.clamp(g.playerPosition.z,c.box.min.z,c.box.max.z);return Math.hypot(g.playerPosition.x-nearX,g.playerPosition.z-nearZ)<.395;})
 .map(c=>({name:c.mesh.name,box:c.box.min.toArray().concat(c.box.max.toArray())}));}
function save(){fs.mkdirSync('qa',{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');}
try{
 for(const room of rooms){
  await g.selectLevel(room-1,false);const l=g.firstLevel;
  report.inventory.push({room,id:l.id,title:l.title,panelNames:Object.keys(l.panels||{}),roles:l.puzzleGeometry?.portalRoles,orders:l.puzzleGeometry?.orders,deductions:l.puzzleGeometry?.deductions,controls:l.terminals?.map(t=>t.kind)});
  for(const kind of ['inward-corner-grip-reversal','underside-jump-release-regrab','restart-live-shot-and-jump']){
   g.resetRun(true);stop();frames=resets=maxSpeed=0;const row={room,id:l.id,kind,sourceBefore:sha(),start:snap()};const cargo=g.cargo,body=g.physics.cargoBody;
   try{
    for(let n=0;n<30;n++)frame();row.settledSpawn=snap();
    if(kind==='restart-live-shot-and-jump'){
     row.shotAccepted=g.firePortal(0);g.input.jumpQueued=true;step(1,0);
     for(let n=0;n<[0,14,24][room%3];n++)frame();
     row.beforeRestart={...snap(),pending:g.portalShots.queue.length,flying:g.portalShots.active.length,epoch:g.portalShots.epoch};
     g.restart();stop();row.afterRestart={...snap(),pending:g.portalShots.queue.length,flying:g.portalShots.active.length,epoch:g.portalShots.epoch,jumpWindup:g.jumpWindup,jumpBuffer:g.jumpBuffer};
     for(let n=0;n<120;n++)frame();
     row.outcome=g.portalShots.queue.length||g.portalShots.active.length||g.portals.ready||g.teleportCount||Math.abs(g.playerPosition.y-row.settledSpawn.p[1])>.08?'restart-residual-candidate':'restart-cleared';
    }else{
     row.collected=collect();const chosen=selectObstacle();
     if(resets){row.outcome='setup-ended-by-production-death';}
     else if(!chosen){row.outcome='no-reachable-obstacle-candidate';}
     else{
      const b=chosen.c.box,center=b.getCenter(V()),p=g.playerPosition;row.obstacle={name:chosen.c.mesh.name,box:b.min.toArray().concat(b.max.toArray()),startDistance:chosen.point.distanceTo(p)};
      // Enter the inside of the rounded nearest corner rather than follow a
      // standard wall perimeter. Reverse the facing with natural movement.
      const x=Math.abs(p.x-b.min.x)<Math.abs(p.x-b.max.x)?b.min.x:b.max.x;
      const z=Math.abs(p.z-b.min.z)<Math.abs(p.z-b.max.z)?b.min.z:b.max.z;
      const corner=V(x,p.y,z);row.minimumApproachDistance=toward(corner,180,{jump:kind==='underside-jump-release-regrab'?17:0});
      row.atContact=snap();row.reachedContact=row.minimumApproachDistance<1.2;
      for(let phase=0;phase<8&&g.state==='playing'&&!resets;phase++){
       const target=phase%2?center:corner;
       toward(target,50,{jump:kind==='underside-jump-release-regrab'?9:21,turn:(phase%2?1:-1)*Math.PI/10,everyE:kind==='underside-jump-release-regrab'?13:0});
      }
      row.afterContact=snap();row.penetrating=penetration();
      if(g.state==='playing'&&!resets&&l.goal?.position)toward(l.goal.position,300,{jump:17});
      row.outcome=g.state==='won'?'completion-needs-causal-review':resets?'attack-ended-by-production-death':row.penetrating.length?'collision-contact-needs-review':row.reachedContact?'finite-contact-trial-no-completion':'approach-did-not-reach-contact';
     }
    }
   }catch(error){row.outcome='driver-error';row.error=String(error);}
   finally{row.frames=frames;row.gameResets=resets;row.maxSpeed=maxSpeed;row.final=snap();row.sameCargo=g.cargo===cargo;row.sameBody=g.physics.cargoBody===body;row.sourceAfter=sha();row.sourceStable=row.sourceBefore===row.sourceAfter;report.rows.push(row);save();console.log(JSON.stringify({room,kind,outcome:row.outcome,frames,resets,reached:row.reachedContact,p:row.final.p}));}
  }
 }
}finally{g.input.getMove=oldMove;g.resetRun=oldReset;g.physics.dispose();g.portals.dispose();report.finished=new Date().toISOString();report.sourceAfter=sha();report.sourceStable=report.sourceBefore===report.sourceAfter;report.counts=Object.fromEntries([...new Set(report.rows.map(r=>r.outcome))].map(k=>[k,report.rows.filter(r=>r.outcome===k).length]));save();console.log('SUMMARY',JSON.stringify(report.counts));}
