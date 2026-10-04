// New speedrun tests for the folded castle. Production input only: no actor,
// body, portal transform or solution state is assigned. Authentic ordinary
// prefixes establish the prerequisite chambers. Finite tests are not exhaustive.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';
export async function runUnexploredCastleCase(g, THREE, journey, name, {capture=async()=>{}}={}) {
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
  const markCheck=(label,extra={})=>{r.attackChecks??=[];r.attackChecks.push({label,...snap(),...extra});};
  async function vector(x,z,seconds,{jumpAt=-1,interactEvery=0}={}){
    r.inputAttackStarted=true;g.input.keys.add('ShiftLeft');
    for(let i=0;i<seconds*60&&g.state==='playing';i++){
      worldMove(x,z);if(i===jumpAt)g.input.jumpQueued=true;
      if(interactEvery&&i%interactEvery===0){const near=l.nearbyInteraction(),accepted=g.interact();r.interactions.push({kind:'attack-E',target:near?.kind??null,accepted,...snap()});}
      await frame();
    }stop();
  }
  async function until(predicate,seconds,label){stop();for(let i=0;i<seconds*60;i++){if(predicate())return;await frame();}if(!predicate())throw Error(label+' '+JSON.stringify(snap()));}
  async function blockedWalk(p,label){try{await walk(p);}catch(e){if(!String(e).startsWith('Error: Blocked '))throw e;r.expectedCollision={label,error:String(e)};stop();}}
  try{
    await wait(.1);await mark('Untouched spawn');r.scope=name;
    if(name==='archive-roof-south-window-no-controls'){
      await stage(['sluice','optics']);
      await travel([0,36,54]);await travel([0,36,33]);await walk([-20,36,33]);
      await vector(-1,0,1.0);await vector(0,-1,1.0);await wait(2);
      markCheck('Archive roof entered from pendulum entrance gallery',{A:state('archive').A,B:state('archive').B});
      await walk([-39,31.5,44],{groundTolerance:1});
      await vector(0,1,.7);markCheck('Stepped beyond roof at south slit');
      await vector(0,-1,4);await wait(.5);markCheck('Falling inward through exterior south aperture',{A:state('archive').A,B:state('archive').B});
      await walk([-39,18,44]);await walk([-57,18,44]);await walk(P('archive',-15,7));await wait(.5);
      markCheck('Archive receiving plate reached without either sliding wall',{A:state('archive').A,B:state('archive').B});
    }else throw Error('Unknown unexplored castle case '+name);
    await wait(.5);r.executed=true;
  }catch(error){r.error=String(error);r.executed=false;if(r.inputAttackStarted&&String(error).startsWith('Error: Blocked ')){r.executed=true;r.stoppedByPhysicalCollision=true;}if(String(error)==='Error: Attack reset the attempt'&&!error.singularityReport){r.endedByProductionDeath=true;r.executed=!!r.inputAttackStarted;r.setupDeath=!r.inputAttackStarted;}if(error.singularityReport)r.routeFailure=error.singularityReport;}
  finally{
    stop();r.finish=snap();r.metrics=l.getTowerMetrics();r.solvedDuringAttack=r.routeFailure?[]:[...new Set([...r.finish.solved,...observedIds])].filter(id=>!(r.routePrefix?.metrics?.solvedIds??r.routeFailure?.metrics?.solvedIds??[]).includes(id));
    const allowedAlternateId=r.validAlternate?(({})[name]):null;r.allowedAlternateSolvedIds=allowedAlternateId?[allowedAlternateId]:[];r.unexpectedSolvedDuringAttack=r.solvedDuringAttack.filter(id=>id!==allowedAlternateId);
    r.candidateBypass=Boolean(r.candidateBypass||(!r.expectedWin&&r.unexpectedSolvedDuringAttack.length)||(!r.expectedWin&&r.finish.state==='won'));if(r.expectedWin)r.routeVerified=r.finish.state==='won'&&r.metrics.completedStages===11;r.sameCompanion=g.cargo===cargo&&g.physics.cargoBody.id===body;
    r.frameSeconds=r.frames/60;r.totalSimulationSeconds=r.frameSeconds+(r.routePrefix?.seconds??r.routeFailure?.seconds??0);r.finiteActors=[...g.playerPosition.toArray(),...g.cargo.position.toArray(),...g.playerVelocity.toArray()].every(Number.isFinite);
    await mark('Attack finish');g.input.getMove=originals.move;g.resetRun=originals.reset;g.respawn=originals.respawn;g.physics.resetCargo=originals.cargoReset;
  }return r;
}


if(import.meta.url===new URL(process.argv[1],'file:').href){
 const out=path.resolve(process.env.REPORT||'qa/unexplored-castle.json');fs.mkdirSync(path.dirname(out),{recursive:true});
 const names=process.env.CASES?.split(',')??['archive-roof-south-window-no-controls'];
 const files=fs.readdirSync('src/game',{recursive:true}).filter(f=>fs.statSync(path.join('src/game',f)).isFile()).sort();
 const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync('src/game/'+f)).digest('hex')]));
 const report={level:41,edition:'foundation',version:'unexplored-input-castle-v1',backend:'production-headless-physics',sources:hashes(),rows:[],limitations:['Finite attack trials; no proof of all bypasses being absent.','Source unchanged; original actor/cargo/machine states never assigned.','Inputs are production movement, jump, E and actual aimed portal shots.']};
 report.fullGameFingerprint=crypto.createHash('sha256').update(JSON.stringify(report.sources)).digest('hex');
 const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');const g=await createHeadlessGame();g.chamberEdition='foundation';
 try{for(const name of names){await g.selectLevel(40,true);const start=Date.now();const row=await runUnexploredCastleCase(g,THREE,runSingularityJourney,name);row.wallSeconds=(Date.now()-start)/1000;report.rows.push(row);save();console.log(JSON.stringify({name,error:row.error,executed:row.executed,solved:row.finish.solved,candidateBypass:row.candidateBypass,wallSeconds:row.wallSeconds,marks:row.attackChecks}));}
 report.sourcesAfter=hashes();report.sourceDrift=files.filter(f=>report.sources[f]!==report.sourcesAfter[f]);report.finished=true;report.bypasses=report.rows.filter(r=>r.candidateBypass).map(r=>r.name);report.setupFailures=report.rows.filter(r=>!r.executed).map(r=>({name:r.name,error:r.error}));save();
 }finally{g.physics?.dispose();g.portals?.dispose();save();}
}
