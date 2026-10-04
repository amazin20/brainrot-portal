// New speedrun tests for the folded castle. Production input only: no actor,
// body, portal transform or solution state is assigned. Authentic ordinary
// prefixes establish the prerequisite chambers. Finite tests are not exhaustive.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';
export async function runNewCastleCase(g, THREE, journey, name, {capture=async()=>{}}={}) {
  const V=(...p)=>new THREE.Vector3(...p), up=V(0,1,0), angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
  const l=g.firstLevel, body=g.physics.cargoBody.id, cargo=g.cargo;
  const originals={move:g.input.getMove,reset:g.resetRun,respawn:g.respawn,cargoReset:g.physics.resetCargo};
  const move=new THREE.Vector2();
  const r={name,frames:0,shots:[],interactions:[],walks:[],trajectory:[],marks:[],resets:0,respawns:0,cargoResets:0,routePrefix:null,error:null,observedProgress:[]};
  let observedCompleted=l.completedStages;const observedIds=new Set();
  function observeProgress(){
    const count=l.completedStages;if(count===observedCompleted)return;observedCompleted=count;
    const metrics=l.getTowerMetrics(),events=metrics.events.filter(e=>!observedIds.has(e.id));
    for(const e of events)observedIds.add(e.id);
    r.observedProgress.push({frame:r.frames,completedStages:count,state:g.state,events});
  }
  g.input.getMove=()=>move.clone();
  for(const key of ['reset','respawn'])g[key==='reset'?'resetRun':'respawn']=function(...args){r[key==='reset'?'resets':'respawns']++;observeProgress();return originals[key].apply(this,args);};
  g.physics.resetCargo=function(...args){r.cargoResets++;observeProgress();return originals.cargoReset.apply(this,args);};
  const snap=()=>({frame:r.frames,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,teleports:g.teleportCount,state:g.state,solved:l.getTowerMetrics().solvedIds});
  const P=(id,x,z=0,y=0)=>l.rooms.get(id).P(x,z,y), state=id=>l.machines.get(id).state;
  function stop(){move.set(0,0);g.input.keys.clear();}
  function worldMove(x,z){const q=V(x,0,z).applyAxisAngle(up,-g.yaw);move.set(q.x,q.z);}
  async function frame(){
    for(let j=0;j<2&&g.state==='playing';j++){g.updatePlaying(1/120);observeProgress();}
    g.updateVisuals(1/60,1);r.frames++;if(r.frames%120===0)r.trajectory.push(snap());
    if(g.cargo!==cargo||g.physics.cargoBody.id!==body)throw Error('Original cargo identity changed');
    if(r.resets||r.respawns||r.cargoResets)throw Error('Attack reset the attempt');
    if(r.frames%120===0&&typeof window!=='undefined')await new Promise(resolve=>setTimeout(resolve,0));
  }
  async function wait(seconds){stop();for(let i=0;i<seconds*60;i++)await frame();}
  async function mark(label){const m={label,...snap()};r.marks.push(m);await capture(m,g);}
  async function walk(target,{timeout=65,sprint=true,groundTolerance=.65,tolerance=.25,followFloor=false}={}){
    target=target.toArray?.()??target;r.walks.push({target,start:snap()});let best=Infinity,stuck=0;
    for(let i=0;i<timeout*60&&g.state==='playing';i++){
      const dx=target[0]-g.playerPosition.x,dz=target[2]-g.playerPosition.z,d=Math.hypot(dx,dz);
      if(d<tolerance&&(followFloor||Math.abs(target[1]-g.playerPosition.y)<groundTolerance)){stop();return;}
      if(d<best-.005){best=d;stuck=0;}else stuck++;
      if(stuck>260)throw Error(`Blocked ${target}; at ${g.playerPosition.toArray()}`);
      const desired=Math.atan2(-dx,-dz);g.yaw+=Math.max(-.065,Math.min(.065,angle(desired-g.yaw)));
      g.pitch+=Math.max(-.025,Math.min(.025,-.14-g.pitch));
      if(sprint)g.input.keys.add('ShiftLeft');else g.input.keys.delete('ShiftLeft');
      const speed=d<.65?Math.max(.16,d/.65):1;worldMove(dx/Math.max(d,.001)*speed,dz/Math.max(d,.001)*speed);await frame();
    }
    stop();if(g.state==='playing')throw Error('Walk timed out '+target);
  }
  async function force(target,seconds,{jump=true,skirt=false,interact=false}={}){
    r.inputAttackStarted=true;target=V(...target);g.input.keys.add('ShiftLeft');
    for(let i=0;i<seconds*60&&g.state==='playing';i++){
      const q=target.clone().sub(g.playerPosition);q.y=0;if(q.length()>.001)q.normalize();
      if(skirt){const phase=Math.floor(i/120)%4;if(phase===1||phase===2)q.applyAxisAngle(up,phase===1?Math.PI/3:-Math.PI/3);}
      const desired=Math.atan2(-q.x,-q.z);g.yaw+=Math.max(-.065,Math.min(.065,angle(desired-g.yaw)));worldMove(q.x,q.z);
      if(jump&&i%40===0)g.input.jumpQueued=true;if(interact&&i%60===0){const near=l.nearbyInteraction();const accepted=g.interact();r.interactions.push({kind:'speedrun-E',target:near?.kind??null,accepted,...snap()});}await frame();
    }stop();await wait(.3);
  }
  async function look(target){stop();const p=V(...(target.toArray?.()??target));
    for(let i=0;i<300;i++){
      g.scene.updateMatrixWorld(true);
      if(p.clone().sub(g.camera.position).dot(g.camera.getWorldDirection(V()))<0){g.yaw+=.16;await frame();continue;}
      const q=p.clone().project(g.camera),tol=Math.min(.005,.035/Math.max(1,p.distanceTo(g.camera.position)));
      if(i>20&&Math.abs(q.x)<tol&&Math.abs(q.y)<tol)return;
      g.yaw-=Math.max(-1,Math.min(1,q.x))*.21;g.pitch=Math.max(-1.15,Math.min(1.15,g.pitch+Math.max(-1,Math.min(1,q.y))*.19));await frame();
    }throw Error('Aim did not converge '+target);
  }
  async function shoot(slot,panel,{required=true}={}){
    const f=panel.frame(),p=f.center.clone();if(Math.abs(f.normal.y)<.1)p.y-=.4;
    await look(p);const accepted=g.firePortal(slot);
    for(let i=0;i<240&&(g.portalShots.queue.length||g.portalShots.active.length);i++)await frame();
    const result={slot,panel:panel.mesh.name,accepted,impact:g.portalShots.lastImpact,...snap()};r.shots.push(result);const valid=accepted&&result.impact?.valid;if(required&&!valid)throw Error('Setup portal shot rejected '+panel.mesh.name+' '+JSON.stringify(result.impact));return valid;
  }
  async function enter(panel){
    const f=panel.frame();await walk(f.center.clone().addScaledVector(f.normal,1.6).setY(f.center.y-2.4));
    const before=g.teleportCount;
    for(let i=0;i<240&&g.teleportCount===before;i++){worldMove(-f.normal.x,-f.normal.z);await frame();}
    stop();if(g.teleportCount===before)throw Error('Ordinary portal crossing failed');await wait(.2);
  }
  async function pickup(){
    if(g.heldCube)return;g.input.keys.delete('ShiftLeft');
    for(let i=0;i<600&&!g.heldCube;i++){
      const p=g.cargo.position,hand=g.playerPosition.clone().add(V(0,1.1,0));
      if(hand.distanceTo(p)<2&&i%12===0){stop();const accepted=g.interact();r.interactions.push({kind:'pickup',accepted,...snap()});if(g.heldCube){await wait(.35);return;}}
      const dx=p.x-g.playerPosition.x,dz=p.z-g.playerPosition.z,d=Math.hypot(dx,dz);
      const desired=Math.atan2(-dx,-dz);g.yaw+=Math.max(-.065,Math.min(.065,angle(desired-g.yaw)));
      const speed=d>1.6?Math.min(1,(d-1.5)*1.5):0;worldMove(dx/Math.max(d,.001)*speed,dz/Math.max(d,.001)*speed);await frame();
    }stop();if(!g.heldCube)throw Error('Original cargo could not be picked up through ordinary input');
  }
  async function dropAt(p,dir=[0,-1]){
    await walk([p[0]-dir[0]*3,p[1],p[2]-dir[1]*3],{sprint:false});
    await walk([p[0]-dir[0]*.85,p[1],p[2]-dir[1]*.85],{sprint:false});
    await look([p[0]+dir[0]*3,p[1]+1,p[2]+dir[1]*3]);await wait(.4);
    const accepted=!!g.heldCube&&g.interact();r.interactions.push({kind:'drop',accepted,...snap()});
    if(!accepted)throw Error('Ordinary drop rejected');await wait(1);
  }
  async function use(id){
    const t=l.terminals.find(t=>t.id===id);if(!t)throw Error('Missing control '+id);
    await walk([t.position.x,t.position.y-1,t.position.z+(g.playerPosition.z<t.position.z?-1.5:1.5)]);
    const accepted=g.interact();r.interactions.push({kind:'control',id,accepted,...snap()});await wait(.3);if(!accepted)throw Error('Setup control input rejected '+id);return accepted;
  }
  // Physical infrastructure graph only plans ordinary walking. Every edge is
  // executed against actual production collision; no solver signal is set.
  async function travel(target){
    const start=g.playerPosition.toArray(),end=target.toArray?.()??target,edges=l.edges,points=[start,end,...edges.flat()];
    for(const [a,b]of edges)for(const[c,d]of edges){
      if(a[1]!==b[1]||c[1]!==d[1]||a[1]!==c[1])continue;
      const ax=a[0]!==b[0],cx=c[0]!==d[0];if(ax===cx)continue;
      const h=ax?[a,b]:[c,d],v=ax?[c,d]:[a,b],p=[v[0][0],a[1],h[0][2]];
      if(p[0]>=Math.min(h[0][0],h[1][0])-.01&&p[0]<=Math.max(h[0][0],h[1][0])+.01&&p[2]>=Math.min(v[0][2],v[1][2])-.01&&p[2]<=Math.max(v[0][2],v[1][2])+.01)points.push(p);
    }
    for(const p of[start,end]){let best=null,dist=Infinity;for(const[a,b]of edges){const q=new THREE.Line3(V(...a),V(...b)).closestPointToPoint(V(...p),true,V());if(q.distanceTo(V(...p))<dist){dist=q.distanceTo(V(...p));best=q.toArray();}}if(best)points.push(best);}
    const nodes=[...new Map(points.map(p=>[p.map(n=>Math.round(n*100)/100).join(','),p])).values()],adj=nodes.map(()=>[]);
    const si=nodes.findIndex(p=>p.every((v,i)=>Math.abs(v-start[i])<.006)),ei=nodes.findIndex(p=>p.every((v,i)=>Math.abs(v-end[i])<.006));
    for(const[a,b]of edges){const line=new THREE.Line3(V(...a),V(...b));const near=nodes.map((p,i)=>({p,i,t:line.closestPointToPointParameter(V(...p),true)})).filter(n=>line.at(n.t,V()).distanceTo(V(...n.p))<.05).sort((a,b)=>a.t-b.t);
      for(let i=1;i<near.length;i++){const u=near[i-1].i,v=near[i].i,w=V(...nodes[u]).distanceTo(V(...nodes[v]));adj[u].push([v,w]);adj[v].push([u,w]);}}
    for(const i of[si,ei])if(!adj[i].length){const v=nodes.map((p,j)=>({j,d:V(...p).distanceTo(V(...nodes[i]))})).filter(v=>v.j!==i&&adj[v.j].length).sort((a,b)=>a.d-b.d)[0];adj[i].push([v.j,v.d]);adj[v.j].push([i,v.d]);}
    const distance=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),visited=new Set();distance[si]=0;
    while(!visited.has(ei)){let u=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(u<0||distance[i]<distance[u]))u=i;if(u<0||!Number.isFinite(distance[u]))throw Error('Disconnected real walkway graph');visited.add(u);for(const[v,w]of adj[u])if(distance[u]+w<distance[v]){distance[v]=distance[u]+w;prev[v]=u;}}
    const route=[];for(let u=ei;u!==si;u=prev[u])route.unshift(nodes[u]);for(const p of route)await walk(p);
  }
  async function stage(ids){
    stop();r.routePrefix=await journey(g,{order:ids,stopAfter:ids.at(-1),onMilestone:m=>{r.marks.push({label:'route: '+m.name,source:'native-prefix',...m});if(typeof window==='undefined'&&process.env.PROGRESS==='1')console.log(JSON.stringify({name,route:m.name,frame:m.frame,seconds:m.seconds}));}});
    await mark('Authentic staged state');
  }

  const first=['freight','sluice','optics','hoist','archive','flywheel','magnet'];
  async function pulse(p,seconds,{jumpAt=0}={}){
    r.inputAttackStarted=true;p=V(...p);g.input.keys.add('ShiftLeft');
    for(let i=0;i<seconds*60;i++){const q=p.clone().sub(g.playerPosition);q.y=0;if(q.length()>.001)q.normalize();worldMove(q.x,q.z);if(i===jumpAt)g.input.jumpQueued=true;await frame();}stop();
  }
  async function until(predicate,seconds,label){stop();for(let i=0;i<seconds*60;i++){if(predicate())return;await frame();}if(!predicate())throw Error(label+' '+JSON.stringify(snap()));}
  function testMark(label,extra={}){r.attackChecks??=[];r.attackChecks.push({label,...snap(),...extra});}
  async function blockedWalk(p,label){try{await walk(p);}catch(e){if(!String(e).startsWith('Error: Blocked '))throw e;r.expectedCollision={label,error:String(e)};stop();}}
  try{
    await wait(.1);await mark('Untouched spawn');
    r.scope=name;
    if(name==='canonical-full-journey'||name==='canonical-independent-order'){
      const order=name.endsWith('independent-order')?['optics','sluice','archive','flywheel','freight','hoist','magnet','migrant','pendulum','inertia','crown']:null;
      r.routePrefix=await journey(g,{order,onMilestone:m=>{r.marks.push({label:'route: '+m.name,source:'native-prefix',...m});if(typeof window==='undefined'&&process.env.PROGRESS==='1')console.log(JSON.stringify({name,route:m.name,frame:m.frame,seconds:m.seconds}));}});
      r.expectedWin=true;r.candidateBypass=false;
    }else if(name==='sluice-empty-gap-jump'||name==='sluice-empty-east-rim'){
      await travel(l.rooms.get('sluice').door);await walk(P('sluice',name.endsWith('east-rim')?20:0,12));
      await pulse(P('sluice',name.endsWith('east-rim')?20:0,23),1.5,{jumpAt:7});
      await force(P('sluice',0,22),5,{jump:true,skirt:true});testMark('Unfilled hydraulic bank reached attempt',{volumes:[...state('sluice').volumes],height:state('sluice').height});
    }else if(name==='freight-separated-cargo-transit'){
      await pickup();await travel(l.rooms.get('freight').door);await walk(P('freight',12,13));await dropAt(P('freight',12,13));
      await walk(P('freight',13,7));await shoot(0,state('freight').intake);await walk(P('freight',12,-10));await shoot(1,state('freight').outlet);
      const beforePlayer=g.teleportCount,beforeCargo=g.physics.portalTransports;
      await walk(P('freight',12,13));await pickup();r.inputAttackStarted=true;await dropAt(P('freight',8,7),[-1,0]);
      await force(P('freight',7,7),5,{jump:false});
      if(g.teleportCount===beforePlayer)await enter(state('freight').intake);
      r.actualPlayerPortalTransfer=g.teleportCount>beforePlayer;r.actualCargoPortalTransfer=g.physics.portalTransports>beforeCargo;
      if(r.actualCargoPortalTransfer){await pickup();await walk(state('freight').receiver);await wait(.5);}
      else{r.physicalCargoPortalRejected=true;}
      const event=l.getTowerMetrics().events.find(e=>e.id==='freight');
      r.actualFreightContact=!!event;r.validAlternate=!!event&&r.actualPlayerPortalTransfer&&r.actualCargoPortalTransfer;
      testMark(r.validAlternate?'Separate player and free-cargo portal delivery completed':'Separate free-cargo portal attempt ended before receiver contact',{carried:l.getTowerMetrics().carriedPortalCrossings.freight??0,playerPortal:r.actualPlayerPortalTransfer,cargoPortal:r.actualCargoPortalTransfer,contact:r.actualFreightContact});
      r.candidateBypass=!!event&&!r.validAlternate;
    }else if(name==='freight-airborne-cargo-service-slit'){
      await pickup();await travel(l.rooms.get('freight').door);await walk(P('freight',3,-10));await look(P('freight',-8,-10,1));
      r.inputAttackStarted=true;g.input.keys.add('ShiftLeft');worldMove(-1,0);g.input.jumpQueued=true;
      for(let i=0;i<100;i++){if(i===16){const accepted=g.interact();r.interactions.push({kind:'airborne-drop',accepted,...snap()});}worldMove(-1,0);await frame();}stop();await wait(1);
      testMark('Original companion released at service slit',{cargoPassedDivider:g.cargo.position.x<P('freight',0)[0]});
      if(g.cargo.position.x<P('freight',0)[0]){
        await walk(P('freight',13,7));await shoot(0,state('freight').intake);await walk(P('freight',12,-10));await shoot(1,state('freight').outlet);await enter(state('freight').intake);await pickup();await walk(state('freight').receiver);await wait(1);
        testMark('Receiver after separate cargo-window transfer',{carried:l.getTowerMetrics().carriedPortalCrossings.freight??0});
      }
    }else if(name==='freight-cargo-service-sill-hop'){
      await pickup();await travel(l.rooms.get('freight').door);await walk(P('freight',3,-10));await dropAt(P('freight',1,-10),[-1,0]);
      await pulse(P('freight',-3,-10),4,{jumpAt:20});await force(P('freight',-3,-10),8,{jump:true,skirt:true});testMark('Cargo as step at service sill');
    }else if(name==='optics-no-reflector-pair'||name==='optics-reflector-double-toggle'){
      await travel(l.rooms.get('optics').door);await walk(P('optics',20,12));await walk(P('optics',-17,12));
      if(name.endsWith('double-toggle')){await use('optics:mirror');await use('optics:mirror');}
      await walk(P('optics',-16,-1));await shoot(0,state('optics').intake);await walk(P('optics',-14,12));await walk(P('optics',3,12));await shoot(1,state('optics').outlet);await wait(3);
      testMark('Direct optical pair without final reflector alignment',{turned:state('optics').turned,lit:state('optics').lit});
    }else if(name==='hoist-no-lift-ride-exterior-stairs'||name==='hoist-no-portals-exterior-cargo'){
      await stage(['freight']);const beforeCargo=g.physics.portalTransports;await pickup();await travel(l.rooms.get('hoist').door);await walk(P('hoist',-18,-11));await dropAt(state('hoist').pad,[1,0]);
      await walk(P('hoist',0,-7));await use('hoist:lift');await walk(P('hoist',-18,-7));await walk(l.rooms.get('hoist').door);
      await travel([l.rooms.get('hoist').door[0],18,l.rooms.get('hoist').door[2]]);await walk(P('hoist',-18,0,18));await walk(P('hoist',-18,10,18));await use('hoist:pawl');
      if(name==='hoist-no-portals-exterior-cargo'){
        await walk(P('hoist',-18,10,18));await walk(P('hoist',-18,0,18));await walk([l.rooms.get('hoist').door[0],18,l.rooms.get('hoist').door[2]]);await travel(l.rooms.get('hoist').door);await walk(P('hoist',-18,-11));await pickup();await walk(l.rooms.get('hoist').door);await travel([l.rooms.get('hoist').door[0],18,l.rooms.get('hoist').door[2]]);await walk(P('hoist',-18,0,18));await walk(P('hoist',-18,10,18));await dropAt(P('hoist',-12,10,18),[1,0]);await wait(2);
      }else{await walk(P('hoist',-12,9,18));await shoot(1,state('hoist').outlet);await walk(P('hoist',-12,6.45,18));await shoot(0,state('hoist').intake);await wait(7);}
      testMark('Reached upper latch by exterior stairs',{hoist:state('hoist').height,locked:state('hoist').locked,proof:l.getTowerMetrics().events.find(e=>e.id==='hoist')?.proof});
      r.actualCargoPortalTransfer=g.physics.portalTransports>beforeCargo;const event=l.getTowerMetrics().events.find(e=>e.id==='hoist');r.validAlternate=name==='hoist-no-lift-ride-exterior-stairs'&&!!event&&r.actualCargoPortalTransfer&&event.proof.upperCatcherLoaded;r.candidateBypass=!!event&&!r.validAlternate;
    }else if(name==='archive-controls-spam-wall-pinch'){
      await stage(['sluice','optics']);await travel(l.rooms.get('archive').door);await use('archive:slide-a');
      for(let i=0;i<6;i++){const near=l.nearbyInteraction(),accepted=g.interact();r.interactions.push({kind:'rapid-slide-toggle',target:near?.kind??null,accepted,...snap()});if(!accepted||near?.kind!=='archive:slide-a')throw Error('Archive toggle setup did not address A');await wait(.08);}
      await force(P('archive',-15,7),16,{jump:true,skirt:true});testMark('Rapid archive toggles followed by wall and corner jump attempts without B',{A:state('archive').A,B:state('archive').B});
    }else if(name==='flywheel-wrong-ratio-max-crank'||name==='flywheel-unloaded-overspeed'){
      await stage(['sluice','optics','archive']);await travel(l.rooms.get('flywheel').door);await walk(P('flywheel',0,0));
      await use('flywheel:crank');for(let i=0;i<14;i++){const near=l.nearbyInteraction(),accepted=g.interact();r.interactions.push({kind:'rapid-crank',target:near?.kind??null,accepted,...snap()});if(!accepted||near?.kind!=='flywheel:crank')throw Error('Flywheel crank setup did not address crank');await wait(.11);}if(name.includes('wrong-ratio'))await use('flywheel:clutch');
      await wait(6);testMark('Alternate wheel signal',{ratio:state('flywheel').ratio,output:state('flywheel').output,clutch:state('flywheel').clutch});
    }else if(name==='magnet-direct-last-coil'){
      await stage(['freight','hoist']);await pickup();await travel(l.rooms.get('magnet').door);await walk(P('magnet',-16,0));await dropAt(state('magnet').sender,[1,0]);
      await walk(P('magnet',-17,-14));await walk(P('magnet',-19,-9.5));await walk(P('magnet',-19,6.5));await use('magnet:coil-2');await wait(20);
      testMark('Only final coil pulls original cargo',{magnet:state('magnet').magnet,passed:state('magnet').passed});
    }else if(name==='migrant-no-rail-portal-push'||name==='migrant-readdress-moving-transit'){
      await stage(first);await travel(l.rooms.get('migrant').door);await walk(P('migrant',-12,12));await shoot(0,state('migrant').intake);await walk(P('migrant',-13,0));await shoot(1,state('migrant').moving);
      if(name.endsWith('moving-transit')){await use('migrant:rail');r.inputAttackStarted=true;r.readdressSucceeded=await shoot(1,state('migrant').moving,{required:false});r.physicalShotRejected=!r.readdressSucceeded;testMark(r.readdressSucceeded?'Portal successfully readdressed during real carriage movement':'Moving readdress shot hit physical obstruction; prior portal retained',{travel:state('migrant').travel,shot:r.shots.at(-1)});await walk(P('migrant',-12,12));}
      await walk(P('migrant',-12,0));await walk(l.rooms.get('migrant').door);await travel([0,36,54]);await pickup();await travel(l.rooms.get('migrant').door);const beforePlayer=g.teleportCount,beforeCargo=g.physics.portalTransports;await enter(state('migrant').intake);
      await force(P('migrant',12,10,3),9,{jump:true,skirt:true});testMark('Carriage receiver attacked',{travel:state('migrant').travel});
      r.actualPlayerPortalTransfer=g.teleportCount>beforePlayer;r.actualCargoPortalTransfer=g.physics.portalTransports>beforeCargo;const event=l.getTowerMetrics().events.find(e=>e.id==='migrant');r.validAlternate=name.endsWith('moving-transit')&&!!event&&r.actualPlayerPortalTransfer&&r.actualCargoPortalTransfer&&event.proof.transportedOnMovingExit&&event.proof.travel>.98;
    }else if(name==='pendulum-catch-before-a'){
      await stage([...first,'migrant']);await travel(l.rooms.get('pendulum').door);await walk(P('pendulum',24,-19));await walk(P('pendulum',19,-19));
      await force(P('pendulum',15,11,6),12,{jump:true,skirt:true,interact:true});testMark('Exterior approach to upper catch attempted before A; catch remained inaccessible',{A:state('pendulum').A,B:state('pendulum').B});
    }else if(name==='inertia-west-wall-end-landing'||name==='inertia-cargo-west-wall-end'){
      await stage([...first,'migrant','pendulum']);if(name.includes('cargo')){await travel([0,36,54]);await pickup();}await travel(l.rooms.get('inertia').door);await walk(P('inertia',30,12));await walk(P('inertia',30,16));await walk(P('inertia',-22,16));await walk(P('inertia',-22,12));await walk(P('inertia',-4,13));
      if(name.includes('cargo')){
        await dropAt(P('inertia',-4,8.1),[0,-1]);r.inputAttackStarted=true;testMark('Original cargo placed for west-guard step');
        await force(P('inertia',6.3,3,-3.5),12,{jump:true,skirt:true,interact:true});testMark('Repeated cargo-step jump and E at guard');
      }else{
        let jumped=false;g.input.keys.add('ShiftLeft');
        for(let i=0;i<180;i++){worldMove(Math.SQRT1_2,-Math.SQRT1_2);if(!jumped&&g.playerPosition.z<P('inertia',0,7.3)[2]){g.input.jumpQueued=true;jumped=true;r.inputAttackStarted=true;testMark('West-corner jump input');}await frame();if(jumped&&g.playerGrounded&&g.playerPosition.y<53){break;}}
        stop();testMark('West-corner diagonal landing');
      }
      await walk(P('inertia',21,0,-3.5));await wait(1);
      testMark('Lower receiver reached around west end',{flew:state('inertia').flew,maxSpeed:state('inertia').maxSpeed,proof:l.getTowerMetrics().events.find(e=>e.id==='inertia')?.proof});
      r.candidateBypass=l.getTowerMetrics().solvedIds.includes('inertia')&&!l.getTowerMetrics().events.find(e=>e.id==='inertia')?.proof?.portalEntries;
    }else if(name==='crown-out-of-order-high-gallery'){
      await pickup();await travel([0,72,54]);const door=l.rooms.get('crown').door;try{await travel(door);}catch(e){if(!String(e).startsWith('Error: Blocked ')||g.playerPosition.distanceTo(V(...door))>1.15)throw e;r.expectedCollision={label:'Locked crown doorway reached by real galleries',error:String(e)};stop();}testMark('Locked crown doorway reached');await force(P('crown',12,13),12,{jump:true,skirt:true});
      testMark('Early crown door attacked with cargo');
    }else if(name==='crown-held-socket-contact'){
      await stage([...first,'migrant','pendulum','inertia']);await travel([0,36,54]);await pickup();await travel(l.rooms.get('crown').door);await walk(P('crown',12,13));await dropAt(P('crown',12,13));await walk(P('crown',13,7));await shoot(0,state('crown').intake);await walk(P('crown',12,-10));await shoot(1,state('crown').outlet);await walk(P('crown',12,13));await pickup();await enter(state('crown').intake);r.inputAttackStarted=true;await walk(state('crown').contact);await wait(2);testMark('Held cargo near contact, no independent socket');
    }else throw Error('Unknown new castle test '+name);
    await wait(.5);r.executed=true;
  }catch(error){r.error=String(error);r.executed=false;if(r.inputAttackStarted&&String(error).startsWith('Error: Blocked ')){r.executed=true;r.stoppedByPhysicalCollision=true;}if(String(error)==='Error: Attack reset the attempt'&&!error.singularityReport){r.endedByProductionDeath=true;r.executed=!!r.inputAttackStarted;r.setupDeath=!r.inputAttackStarted;}if(error.singularityReport)r.routeFailure=error.singularityReport;}
  finally{
    stop();r.finish=snap();r.metrics=l.getTowerMetrics();r.solvedDuringAttack=r.routeFailure?[]:[...new Set([...r.finish.solved,...observedIds])].filter(id=>!(r.routePrefix?.metrics?.solvedIds??r.routeFailure?.metrics?.solvedIds??[]).includes(id));
    const allowedAlternateId=r.validAlternate?({'freight-separated-cargo-transit':'freight','hoist-no-lift-ride-exterior-stairs':'hoist','migrant-readdress-moving-transit':'migrant'}[name]):null;r.allowedAlternateSolvedIds=allowedAlternateId?[allowedAlternateId]:[];r.unexpectedSolvedDuringAttack=r.solvedDuringAttack.filter(id=>id!==allowedAlternateId);
    r.candidateBypass=Boolean(r.candidateBypass||(!r.expectedWin&&r.unexpectedSolvedDuringAttack.length)||(!r.expectedWin&&r.finish.state==='won'));if(r.expectedWin)r.routeVerified=r.finish.state==='won'&&r.metrics.completedStages===11;r.sameCompanion=g.cargo===cargo&&g.physics.cargoBody.id===body;
    r.frameSeconds=r.frames/60;r.totalSimulationSeconds=r.frameSeconds+(r.routePrefix?.seconds??r.routeFailure?.seconds??0);r.finiteActors=[...g.playerPosition.toArray(),...g.cargo.position.toArray(),...g.playerVelocity.toArray()].every(Number.isFinite);
    await mark('Attack finish');g.input.getMove=originals.move;g.resetRun=originals.reset;g.respawn=originals.respawn;g.physics.resetCargo=originals.cargoReset;
  }return r;
}

if(import.meta.url===new URL(process.argv[1],'file:').href){
 const out=path.resolve(process.env.REPORT||'qa/speedrun-castle-new.json');fs.mkdirSync(path.dirname(out),{recursive:true});
 const defaultNames=['canonical-full-journey','canonical-independent-order','sluice-empty-gap-jump','sluice-empty-east-rim','freight-separated-cargo-transit','freight-cargo-service-sill-hop','freight-airborne-cargo-service-slit','optics-no-reflector-pair','optics-reflector-double-toggle','hoist-no-lift-ride-exterior-stairs','hoist-no-portals-exterior-cargo','archive-controls-spam-wall-pinch','flywheel-wrong-ratio-max-crank','flywheel-unloaded-overspeed','magnet-direct-last-coil','migrant-no-rail-portal-push','migrant-readdress-moving-transit','pendulum-catch-before-a','inertia-west-wall-end-landing','inertia-cargo-west-wall-end','crown-out-of-order-high-gallery','crown-held-socket-contact'];
 const names=process.env.CASES?.split(',')??defaultNames;
 const files=fs.readdirSync('src/game',{recursive:true}).filter(f=>fs.statSync(path.join('src/game',f)).isFile()).sort();
 const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('src/game/'+f)).digest('hex')]));
 const harnessHash=()=>crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');
 const report={level:41,edition:'foundation',version:'new-input-speedrun-castle-v1',backend:'production-headless-physics',sources:hashes(),harnessSha256:harnessHash(),limitations:['Finite ordinary-input tests do not prove every alternate route is absent.','An incomplete authentic prefix is a setup failure, not a tested blocked alternate route.','Headless physics provides no visual, FPS or human-playtest evidence.'],rows:[]};
 report.fullGameFingerprint=crypto.createHash('sha256').update(JSON.stringify(report.sources)).digest('hex');
 const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');const g=await createHeadlessGame();g.chamberEdition='foundation';
 try{for(const name of names){await g.selectLevel(40,true);const start=Date.now();const row=await runNewCastleCase(g,THREE,runSingularityJourney,name);row.wallSeconds=(Date.now()-start)/1000;report.rows.push(row);save();console.log(JSON.stringify({name,error:row.error,executed:row.executed,solved:row.finish.solved,candidateBypass:row.candidateBypass,routeVerified:row.routeVerified,wallSeconds:row.wallSeconds}));}
 report.sourcesAfter=hashes();report.fullGameFingerprintAfter=crypto.createHash('sha256').update(JSON.stringify(report.sourcesAfter)).digest('hex');report.harnessSha256After=harnessHash();report.harnessDrift=report.harnessSha256!==report.harnessSha256After;report.sourceDrift=files.filter(f=>report.sources[f]!==report.sourcesAfter[f]);report.finished=true;report.bypasses=report.rows.filter(r=>r.candidateBypass).map(r=>r.name);report.setupFailures=report.rows.filter(r=>!r.executed).map(r=>({name:r.name,error:r.error}));report.pass=!report.bypasses.length&&!report.setupFailures.length&&!report.sourceDrift.length&&!report.harnessDrift&&report.rows.every(r=>r.finiteActors&&r.sameCompanion&&(r.endedByProductionDeath||(!r.resets&&!r.respawns&&!r.cargoResets)));save();if(!report.pass)process.exitCode=1;
 }finally{g.physics?.dispose();g.portals?.dispose();save();}
}
