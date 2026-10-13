import * as THREE from 'three';
import {runSingularityJourney} from './LabSingularityJourney.js';

const V=(...p)=>new THREE.Vector3(...p),UP=V(0,1,0),DT=1/120;
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));

/** Directed causal omissions using the actual ordinary castle and its input
 * handlers. No actor, body, portal, mechanism or completion state is assigned.
 * A blocked setup is NOTREACHED; it cannot stand in for an executed attack. */
export async function runSingularityCausalNegativeJourney(game,{scenario,onMilestone=()=>{},onPhysicsStep=()=>{}}={}){
 const level=game.firstLevel;
 check(level?.singularity&&game.state==='playing'&&level.completedStages===0,'Begin an untouched ordinary Tower41 attempt');
 check(['archive-roof-without-controls','flywheel-without-load'].includes(scenario),'Unknown causal omission');
 const cargo=game.cargo,body=game.physics.cargoBody,move=new THREE.Vector2();
 const originals={move:game.input.getMove,reset:game.resetRun,respawn:game.respawn,cargoReset:game.physics.resetCargo};
 const report={scenario,backend:'production-headless-physics',status:'NOTREACHED/OPEN',pass:false,frames:0,physicsSteps:0,actions:[],milestones:[],samples:[],resets:0,respawns:0,cargoResets:0,originalCargoBodyId:body.id,inputAttackStarted:false,fullBypassResistanceAccepted:false,prefixCargoSupportObservations:[]};
 const P=(id,x,z=0,y=0)=>level.rooms.get(id).P(x,z,y),state=id=>level.machines.get(id).state;
 const snapshot=()=>({frame:report.frames,worldStep:game.physics.world.stepnumber,player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),held:!!game.heldCube,grounded:game.playerGrounded,solved:level.getTowerMetrics().solvedIds,state:game.state});
 let observe=()=>{};
 function stop(){move.set(0,0);game.input.keys.clear();}
 function worldMove(x,z){const q=V(x,0,z).applyAxisAngle(UP,-game.yaw);move.set(q.x,q.z);}
 function turn(dx,dz){game.yaw+=THREE.MathUtils.clamp(angle(Math.atan2(-dx,-dz)-game.yaw),-.065,.065);game.pitch+=THREE.MathUtils.clamp(-.14-game.pitch,-.025,.025);}
 async function frame(){
  for(let i=0;i<2&&game.state==='playing';i++){
   const before=game.physics.world.stepnumber;game.updatePlaying(DT);report.physicsSteps++;
   check(game.physics.world.stepnumber===before+1,'The ordinary simulation did not execute one actual physics step');
   check(game.cargo===cargo&&game.physics.cargoBody===body,'Original cargo identity changed');
   check(!report.resets&&!report.respawns&&!report.cargoResets,'Attempt reset during a directed omission');
   observe();onPhysicsStep(snapshot(),game);
  }
  game.updateVisuals(1/60,1);report.frames++;
  if(report.frames%120===0&&typeof window!=='undefined')await new Promise(resolve=>setTimeout(resolve,0));
 }
 async function wait(seconds){stop();for(let i=0;i<Math.ceil(seconds*60);i++)await frame();}
 async function mark(label){const s={label,...snapshot()};report.milestones.push(s);await onMilestone(s,game);}
 async function walk(target,{sprint=true,tolerance=.22,groundTolerance=.65,timeout=90}={}){
  target=target.toArray?.()??target;report.actions.push({kind:'walk',target,start:snapshot()});let best=Infinity,stuck=0;
  for(let i=0;i<timeout*60&&game.state==='playing';i++){
   const dx=target[0]-game.playerPosition.x,dz=target[2]-game.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<tolerance&&Math.abs(target[1]-game.playerPosition.y)<groundTolerance){stop();return;}
   if(d<best-.005){best=d;stuck=0;}else stuck++;
   check(stuck<260,`Blocked walking to ${target}; at ${game.playerPosition.toArray()}`);
   turn(dx,dz);if(sprint)game.input.keys.add('ShiftLeft');else game.input.keys.delete('ShiftLeft');
   const speed=d<.65?Math.max(.16,d/.65):1;worldMove(dx/Math.max(d,.001)*speed,dz/Math.max(d,.001)*speed);await frame();
  }throw new Error('Ordinary walk timed out '+target);
 }
 // This graph plans only the already authored physical infrastructure. Its
 // edges still execute through production movement and production collision.
 async function travel(target){
  const start=game.playerPosition.toArray(),end=target.toArray?.()??target,edges=level.edges,points=[start,end,...edges.flat()];
  for(const[a,b]of edges)for(const[c,d]of edges){
   if(a[1]!==b[1]||c[1]!==d[1]||a[1]!==c[1]||(a[0]!==b[0])===(c[0]!==d[0]))continue;
   const[h,v]=a[0]!==b[0]?[[a,b],[c,d]]:[[c,d],[a,b]],p=[v[0][0],a[1],h[0][2]];
   if(p[0]>=Math.min(h[0][0],h[1][0])-.01&&p[0]<=Math.max(h[0][0],h[1][0])+.01&&p[2]>=Math.min(v[0][2],v[1][2])-.01&&p[2]<=Math.max(v[0][2],v[1][2])+.01)points.push(p);
  }
  for(const p of[start,end]){let nearest=null,distance=Infinity;for(const[a,b]of edges){const q=new THREE.Line3(V(...a),V(...b)).closestPointToPoint(V(...p),true,V());if(q.distanceTo(V(...p))<distance){distance=q.distanceTo(V(...p));nearest=q.toArray();}}if(nearest)points.push(nearest);}
  const nodes=[...new Map(points.map(p=>[p.map(n=>Math.round(n*100)/100).join(','),p])).values()],adj=nodes.map(()=>[]);
  const si=nodes.findIndex(p=>p.every((n,i)=>Math.abs(n-start[i])<.006)),ei=nodes.findIndex(p=>p.every((n,i)=>Math.abs(n-end[i])<.006));
  for(const[a,b]of edges){const line=new THREE.Line3(V(...a),V(...b)),near=nodes.map((p,i)=>({p,i,t:line.closestPointToPointParameter(V(...p),true)})).filter(n=>line.at(n.t,V()).distanceTo(V(...n.p))<.05).sort((a,b)=>a.t-b.t);
   for(let i=1;i<near.length;i++){const u=near[i-1].i,v=near[i].i,d=V(...nodes[u]).distanceTo(V(...nodes[v]));adj[u].push([v,d]);adj[v].push([u,d]);}}
  for(const i of[si,ei])if(!adj[i].length){const near=nodes.map((p,j)=>({j,d:V(...p).distanceTo(V(...nodes[i]))})).filter(n=>n.j!==i&&adj[n.j].length).sort((a,b)=>a.d-b.d)[0];check(near,'Missing physical route junction');adj[i].push([near.j,near.d]);adj[near.j].push([i,near.d]);}
  const distance=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();distance[si]=0;
  while(!visited.has(ei)){let u=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(u<0||distance[i]<distance[u]))u=i;check(u>=0&&Number.isFinite(distance[u]),'Disconnected physical route');visited.add(u);for(const[v,d]of adj[u])if(distance[u]+d<distance[v]){distance[v]=distance[u]+d;previous[v]=u;}}
  const route=[];for(let i=ei;i!==si;i=previous[i])route.unshift(nodes[i]);for(const p of route)await walk(p);
 }
 async function use(id,{approach=true,side=null}={}){
  const t=level.terminals.find(t=>t.id===id);check(t,'Missing ordinary control '+id);
  if(approach)await walk([t.position.x,t.position.y-1,t.position.z+(side??(game.playerPosition.z<t.position.z?-1:1))*1.5]);
  check(!game.heldCube,'Hands occupied at control');const before=t.actuator?.rotation.x;
  check(game.interact(),'Ordinary E rejected '+id);check(!game.heldCube,'E picked up cargo instead of operating '+id);
  if(t.actuator)check(before!==t.actuator.rotation.x,'E operated a different control');
  report.actions.push({kind:'E',id,...snapshot()});await wait(.28);
 }
 async function vector(x,z,seconds){
  report.inputAttackStarted=true;report.actions.push({kind:'attack-move',direction:[x,z],seconds,...snapshot()});game.input.keys.add('ShiftLeft');
  for(let i=0;i<Math.ceil(seconds*60)&&game.state==='playing';i++){worldMove(x,z);await frame();}stop();
 }
 async function prefix(ids){
  stop();report.routePrefix=await runSingularityJourney(game,{order:ids,stopAfter:ids.at(-1),onMilestone:m=>onMilestone({label:'prefix: '+m.name,...m},game),onFrame:s=>{
   const contacts=game.physics.world.contacts.filter(c=>c.enabled!==false&&[c.bi,c.bj].includes(body)&&c.multiplier>1e-6&&Math.abs(c.ni.y)>.65);
   if(contacts.length&&report.prefixCargoSupportObservations.length<3)report.prefixCargoSupportObservations.push({worldStep:game.physics.world.stepnumber,bodyId:body.id,free:!game.heldCube&&!game.physics.carryTarget,position:body.position.toArray(),actualContactCount:contacts.length,totalPositiveNormalForce:contacts.reduce((sum,c)=>sum+c.multiplier,0),contactDetailsLimitedTo:4,contacts:contacts.slice(0,4).map(c=>({supportBodyId:c.bi===body?c.bj.id:c.bi.id,normal:c.ni.toArray(),normalForce:c.multiplier,enabled:c.enabled!==false}))});
  }});
  check(report.routePrefix.partial&&ids.every(id=>report.routePrefix.metrics.solvedIds.includes(id)),'Actual ordinary prefix incomplete');
  await mark('Actual ordinary prefix completed');
 }
 game.input.getMove=()=>move.clone();
 game.resetRun=function(...args){report.resets++;return originals.reset.apply(this,args);};
 game.respawn=function(...args){report.respawns++;return originals.respawn.apply(this,args);};
 game.physics.resetCargo=function(...args){report.cargoResets++;return originals.cargoReset.apply(this,args);};
 try{
  if(scenario==='archive-roof-without-controls'){
   await prefix(['sluice','optics']);
   report.archive={availabilityBeforeAttack:level.archiveMemory.diagnostics(),controlsBefore:{A:state('archive').A,B:state('archive').B},boundaryEncountered:false,roofSupportedTicks:0,southApertureApproachTicks:0,receivingPlateTicks:0,attackPhysicsSteps:0,minimumPlateDistance:Infinity};
   check(report.archive.availabilityBeforeAttack.released,'Actual archive source-driven ratchets have not released');
   check(!state('archive').A&&!state('archive').B,'Archive controls already changed');
   const room=level.rooms.get('archive'),plate=V(...P('archive',-15,7));
   observe=()=>{
    if(!report.inputAttackStarted)return;
    const a=report.archive,p=game.playerPosition,s=state('archive'),distance=Math.hypot(p.x-plate.x,p.z-plate.z);
    a.attackPhysicsSteps++;a.minimumPlateDistance=Math.min(a.minimumPlateDistance,distance);
    const roof=game.playerGrounded&&Math.abs(p.y-(room.def.at[1]+room.def.h+.5))<.08&&p.x>=room.b.x0-.35&&p.x<=room.b.x1+.35&&p.z>=room.b.z0-.35&&p.z<=room.b.z1+.35;
    const aperture=Math.abs(p.x+39)<.8&&Math.abs(p.z-room.b.z1)<1.2&&p.y>=18&&p.y<=32;
    a.roofSupportedTicks+=Number(roof);a.southApertureApproachTicks+=Number(aperture);a.boundaryEncountered||=roof||aperture;
    a.receivingPlateTicks+=Number(game.playerGrounded&&distance<1.3&&Math.abs(p.y-plate.y)<.3);
    check(!s.A&&!s.B,'Attack accidentally used an archive wall control');
    if(a.attackPhysicsSteps%120===0||roof&&a.roofSupportedTicks===1||aperture&&a.southApertureApproachTicks===1)report.samples.push({...snapshot(),A:s.A,B:s.B,roof,aperture,plateDistance:distance,availability:level.archiveMemory.diagnostics()});
   };
   await travel([0,36,54]);await travel([0,36,33]);await walk([-20,36,33]);
   await vector(-1,0,1);await vector(0,-1,1);await wait(2);await mark('Roof attack executed');
   await walk([-39,31.5,44],{groundTolerance:1});
   await vector(0,1,.7);await mark('South slit approached');await vector(0,-1,4);await wait(.5);
   await walk([-39,18,44]);await walk([-57,18,44]);await walk(P('archive',-15,7));await wait(.5);
   report.archive.receivingPlateReached=report.archive.receivingPlateTicks>0;
   report.status=level.getTowerMetrics().solvedIds.includes('archive')?'BYPASS_OBSERVED':'NOTREACHED/OPEN';
  }else{
   await prefix(['sluice','optics','archive']);
   const cell=state('flywheel');
   report.flywheel={cargoStart:body.position.toArray(),bodyWorldMember:game.physics.world.bodies.includes(body),cargoFree:!game.heldCube&&!game.physics.carryTarget,qualifiedOtherConditionsTicks:0,consecutiveOtherConditionsTicks:0,maxConsecutiveOtherConditionsTicks:0,actualTrayContactTicks:0,positiveTrayNormalImpulse:0,originalCargoSupportedTicks:0,sleepingGroundedCargoTicks:0,emptyTrayTicks:0,startWorldStep:game.physics.world.stepnumber,crankCountBefore:cell.diagnostics().crankCount};
   check(report.flywheel.cargoFree&&report.flywheel.bodyWorldMember,'Original companion must remain free in the actual world');
   observe=()=>{
    const f=report.flywheel,d=cell.diagnostics(),actual=game.physics.world.stepnumber;
    check(d.worldStep===actual&&d.contactStep===actual,'Flywheel load sample is stale');
    check(game.physics.world.bodies.includes(body)&&body===cell.originalCargoBody,'Original cargo is no longer the live body');
    const contacts=game.physics.world.contacts.filter(c=>c.enabled!==false&&[c.bi,c.bj].includes(body)&&[c.bi,c.bj].includes(cell.fixedBody)&&[c.si,c.sj].includes(cell.fixedBody.shapes[cell.trayShapeIndex])&&c.multiplier>1e-6);
    f.actualTrayContactTicks+=Number(contacts.length>0);for(const c of contacts)f.positiveTrayNormalImpulse+=c.multiplier*DT;
    const supported=game.physics.world.contacts.some(c=>c.enabled!==false&&[c.bi,c.bj].includes(body)&&c.multiplier>1e-6&&Math.abs(c.ni.y)>.65);
    f.originalCargoSupportedTicks+=Number(supported);f.sleepingGroundedCargoTicks+=Number(body.sleepState===2&&game.physics.grounded);
    const outside=body.position.distanceTo({x:cell.loadCargoPosition.x,y:cell.loadCargoPosition.y,z:cell.loadCargoPosition.z})>3;
    const omitted=!d.loadContact&&d.loadNormalForce===0&&!game.heldCube&&!game.physics.carryTarget&&outside;
    f.emptyTrayTicks+=Number(omitted);
    const otherConditions=d.ratio===1&&Math.abs(d.ratioValue-2/3)<1e-12&&d.clutch&&!d.brake&&d.output>4.9&&d.output<6.1;
    if(omitted&&otherConditions){f.qualifiedOtherConditionsTicks++;f.consecutiveOtherConditionsTicks++;}else f.consecutiveOtherConditionsTicks=0;
    f.maxConsecutiveOtherConditionsTicks=Math.max(f.maxConsecutiveOtherConditionsTicks,f.consecutiveOtherConditionsTicks);
    if(report.inputAttackStarted&&f.consecutiveOtherConditionsTicks>0&&(f.consecutiveOtherConditionsTicks===1||f.consecutiveOtherConditionsTicks%30===0))report.samples.push({...snapshot(),outsideTray:outside,originalCargoSupportingContact:supported,cell:d});
    if(level.getTowerMetrics().solvedIds.includes('flywheel'))throw new Error('Flywheel solved without the original physical load');
   };
   await travel(level.rooms.get('flywheel').door);await walk(P('flywheel',13,10));await walk(P('flywheel',11,8.5));
   await use('flywheel:ratio',{side:1});await walk(P('flywheel',13.7,8.5));await use('flywheel:clutch',{side:1});
   await walk(P('flywheel',-11,8.5));report.inputAttackStarted=true;await mark('Missing-load crank attack begun');
   await use('flywheel:crank');for(let i=0;i<4;i++)await use('flywheel:crank',{approach:false});
   await wait(2.5);
   report.flywheel.finish=cell.diagnostics();report.flywheel.cargoFinish=body.position.toArray();report.flywheel.crankCountAfter=cell.diagnostics().crankCount;
   report.status=report.flywheel.maxConsecutiveOtherConditionsTicks>240?'LOAD_OMISSION_REJECTED':'NOTREACHED/OPEN';
   report.pass=report.status==='LOAD_OMISSION_REJECTED';
  }
 }catch(error){
  report.failure={message:String(error),...snapshot()};
  if(level.getTowerMetrics().solvedIds.includes(scenario.startsWith('archive')?'archive':'flywheel'))report.status='BYPASS_OBSERVED';
  else if(scenario==='archive-roof-without-controls'&&report.inputAttackStarted&&report.archive?.boundaryEncountered&&String(error).startsWith('Error: Blocked walking')){
   const p=game.playerPosition;
   // Read the production capsule's finite 0.43 m radius and 2.4 m height
   // against the same enabled collider boxes used by resolveBody. Cargo's
   // distant-body streaming is recorded separately; it is not an actor contact.
   report.archive.blockingGeometry=game.colliders.filter(c=>c.enabled!==false&&!c.orientedBox&&c.box.max.y>p.y+.43&&c.box.min.y<p.y+2.4-.43).map(c=>{
    const b=c.box,gap=Math.hypot(Math.max(b.min.x-p.x,0,p.x-b.max.x),Math.max(b.min.z-p.z,0,p.z-b.max.z))-.43,item=game.physics.solids.get(c.mesh.uuid);
    return{meshName:c.mesh.name,enabled:c.enabled!==false,bounds:{min:b.min.toArray(),max:b.max.toArray()},horizontalCapsuleGap:gap,staticRegistryPresent:!!item,bodyId:item?.body.id??null,cargoBodyStreamedIn:!!item&&game.physics.world.bodies.includes(item.body)};
   }).filter(c=>c.horizontalCapsuleGap>=-1e-5&&c.horizontalCapsuleGap<.002);
   if(report.archive.blockingGeometry.length){report.status='ARCHIVE_BOUNDARY_REJECTED';report.pass=true;report.archive.stoppedByPhysicalCollision=true;}
  }
 }finally{
  stop();report.finish=snapshot();report.metrics=level.getTowerMetrics();report.sameCargo=game.cargo===cargo&&game.physics.cargoBody===body;
  if(report.archive){report.archive.controlsAfter={A:state('archive').A,B:state('archive').B};report.archive.receivingPlateReached=report.archive.receivingPlateTicks>0;}
  game.input.getMove=originals.move;game.resetRun=originals.reset;game.respawn=originals.respawn;game.physics.resetCargo=originals.cargoReset;
  report.observersRestored=game.input.getMove===originals.move&&game.resetRun===originals.reset&&game.respawn===originals.respawn&&game.physics.resetCargo===originals.cargoReset;
  report.seconds=report.physicsSteps/120;report.totalSimulationSeconds=report.seconds+(report.routePrefix?.seconds??0);
 }
 return report;
}
