/** New finite ordinary-input probes for stable castle 41, displayed as campaign final 51.
 * No actor/body/portal/mechanism/solution state assignment; authentic journey
 * prefixes and production walk, jump, E and aimed shots only. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {createHeadlessGame} from './lab-headless.mjs';
import {runSingularityJourney} from '../src/game/LabSingularityJourney.js';
import {ACTIVE_FOUNDATION_RUNTIME_FLAGS} from '../src/game/ReleaseIdentity.js';
export const CAMPAIGN_CASTLE_SHORTCUTS=['crown-high-gallery-locked-targeted-shots','crown-high-gallery-dropped-cargo-jamb-step','crown-cargo-slit-running-airdrop'];
export async function runCampaignCastleShortcut(g, THREE, journey, name, {capture=async()=>{}}={}) {
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
    }r.aimFailure={target:p.toArray(),camera:g.camera.position.toArray(),yaw:g.yaw,pitch:g.pitch,projection:p.clone().project(g.camera).toArray(),direction:g.camera.getWorldDirection(V()).toArray()};throw Error('Aim did not converge '+p.toArray());
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


  const prerequisite=['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia'];
  const crown=l.rooms.get('crown'),door=crown.door;
  const begin=(label,extra={})=>{r.attackReached=true;r.inputAttackStarted=true;r.attackStart??=snap();r.attackChecks??=[];r.attackChecks.push({label,...snap(),...extra});};
  const check=(label,extra={})=>{r.attackChecks??=[];r.attackChecks.push({label,...snap(),...extra});};
  const crownInside=()=>g.playerPosition.x<door[0]-.65&&Math.abs(g.playerPosition.z-door[2])<crown.def.d/2&&g.playerPosition.y>71.5;
  async function highGallery({carry=false}={}){
    if(carry)await pickup();await travel([0,72,54]);
    if(g.playerPosition.y<71.5)throw Error('Authentic physical stairs did not reach top gallery');
    check('Actual physical five-storey stair ascent completed',{carried:!!g.heldCube});
  }
  try{
    await wait(.1);await mark('Untouched campaign castle spawn');
    if(name==='crown-high-gallery-locked-targeted-shots'){
      await highGallery();
      const stances=[[0,72,49],[-6,72,39],[-6,72,27],[door[0]+1.15,72,door[2]], [door[0]+1.15,72,door[2]-2], [door[0]+1.15,72,door[2]+2]];
      r.forbiddenAddress=[];
      for(const stance of stances){
        if(stance[0]>door[0]+2)await travel(stance);else await walk(stance);
        begin('Locked crown panel shots from reached real gallery stance',{stance});
        for(const panel of [state('crown').intake,state('crown').outlet]){
          const valid=await shoot(1,panel,{required:false});
          const installed=g.portals.portals[1];const addressed=valid&&installed.surfaceId===panel.mesh.uuid;
          check('Actual targeted portal shot at locked crown',{stance,shot:r.shots.at(-1),addressed});
          if(addressed){
            r.forbiddenAddress.push({stance,panel:panel.mesh.name});
            // Reached address is useful even if unavailable machinery cannot
            // grant victory. Execute actual gallery aperture to test entrance.
            await travel([0,72,49]);await shoot(0,l.panels.upperPortal);await enter(l.panels.upperPortal);
            check('Actual teleport attempt into locked crown',{physicalPenetration:crownInside()});
            r.physicalCrownPenetration=crownInside();break;
          }
        }if(r.forbiddenAddress.length)break;
      }
      r.physicalBlockedProof={forbiddenPanelsInstalled:r.forbiddenAddress.length,lockedCrownPhysicallyEntered:!!r.physicalCrownPenetration,shots:r.shots.filter(s=>s.panel.includes('crown')).map(s=>({panel:s.panel,valid:!!s.impact?.valid,reason:s.impact?.reason,impact:s.impact}))};
      r.candidateBypass=!!r.physicalCrownPenetration;
    }else if(name==='crown-high-gallery-dropped-cargo-jamb-step'){
      await highGallery({carry:true});await travel([door[0]+1.2,72,door[2]]);
      await dropAt([door[0]+.9,72,door[2]],[-1,0]);
      begin('Original companion dropped at locked crown for shoulder and step jumps');
      for(const dz of [-1,0,1]){
        await walk([door[0]+1.25,72,door[2]+dz]);await wait(.4);
        await force([door[0]-3.5,72,door[2]+dz],6,{jump:true,skirt:false,interact:false});
        check('Finite locked-jamb jump with cargo at latch',{shoulder:dz,physicalPenetration:crownInside()});
        if(crownInside()){r.physicalCrownPenetration=true;break;}
      }
      r.physicalBlockedProof={lockedCrownPhysicallyEntered:!!r.physicalCrownPenetration,door,cargoAfter:g.cargo.position.toArray(),jambSamples:r.attackChecks.filter(c=>c.label.includes('Finite locked-jamb'))};
      r.candidateBypass=!!r.physicalCrownPenetration;
    }else if(name==='crown-cargo-slit-running-airdrop'){
      await stage(prerequisite);await travel([0,36,54]);await pickup();await travel(crown.door);await walk(P('crown',3,-10));await look(P('crown',-8,-10,1));
      const beforeCarried=l.getTowerMetrics().carriedPortalCrossings.crown??0,beforeCargo=g.physics.portalTransports;
      begin('Running airborne original-cargo drop against crown aiming slit',{beforeCarried,beforeCargo});
      g.input.keys.add('ShiftLeft');worldMove(-1,0);g.input.jumpQueued=true;
      for(let i=0;i<150;i++){
        if(i===16){const accepted=g.interact();r.interactions.push({kind:'running-airborne-drop',accepted,...snap()});if(!accepted||g.heldCube)throw Error('Attack cargo release did not occur');}
        worldMove(-1,0);await frame();
      }stop();await wait(1.5);
      r.cargoPassedDivider=g.cargo.position.x<P('crown',0)[0]-.75;
      check('Cargo release settled at actual slit',{cargoPassedDivider:r.cargoPassedDivider});
      if(r.cargoPassedDivider){
        await walk(P('crown',13,7));await shoot(0,state('crown').intake);await walk(P('crown',12,-10));await shoot(1,state('crown').outlet);await enter(state('crown').intake);
        await pickup();await dropAt(state('crown').socket);await walk(state('crown').contact);await wait(2);
        r.candidateBypass=g.state==='won'&&(l.getTowerMetrics().carriedPortalCrossings.crown??0)===beforeCarried;
        check('Independent load attempt after free-cargo slit transfer',{samePortalCrossings:(l.getTowerMetrics().carriedPortalCrossings.crown??0)===beforeCarried});
      }
      r.physicalBlockedProof={cargoPassedDivider:r.cargoPassedDivider,cargoTransportsBefore:beforeCargo,cargoTransportsAfter:g.physics.portalTransports,carriedCrownBefore:beforeCarried,carriedCrownAfter:l.getTowerMetrics().carriedPortalCrossings.crown??0,slitFinalCargo:g.cargo.position.toArray()};
    }else throw Error('Unknown new campaign castle test '+name);
    await wait(.5);r.executed=true;
  }catch(error){
    r.error=String(error);r.executed=false;
    if(r.attackReached&&String(error).startsWith('Error: Blocked ')){r.executed=true;const target=r.walks.at(-1)?.target;r.stoppedByPhysicalCollision=!!target&&Math.abs(g.playerPosition.y-target[1])<1;r.navigationError=!r.stoppedByPhysicalCollision;r.physicalBlockedProof??={collisionAtRequestedFloor:r.stoppedByPhysicalCollision,error:String(error),at:snap()};}
    if(String(error)==='Error: Attack reset the attempt'&&!error.singularityReport){r.endedByProductionDeath=true;r.executed=!!r.attackReached;r.setupDeath=!r.attackReached;}
    if(error.singularityReport)r.routeFailure=error.singularityReport;
  }finally{
    stop();r.finish=snap();r.metrics=l.getTowerMetrics();r.solvedDuringAttack=r.routeFailure?[]:[...new Set([...r.finish.solved,...observedIds])].filter(id=>!(r.routePrefix?.metrics?.solvedIds??r.routeFailure?.metrics?.solvedIds??[]).includes(id));
    r.candidateBypass=Boolean(r.candidateBypass||r.solvedDuringAttack.length||r.finish.state==='won');
    r.sameCompanion=g.cargo===cargo&&g.physics.cargoBody.id===body;r.finiteActors=[...g.playerPosition.toArray(),...g.cargo.position.toArray(),...g.playerVelocity.toArray()].every(Number.isFinite);
    r.frameSeconds=r.frames/60;r.totalSimulationSeconds=r.frameSeconds+(r.routePrefix?.seconds??r.routeFailure?.seconds??0);
    r.outcome=!r.attackReached?'setup_failure':r.candidateBypass?'bypass_candidate':r.endedByProductionDeath?'production_death':r.navigationError?'navigation_error':r.executed?'finite_attack_observed':'attack_error';
    await mark('Attack finish');g.input.getMove=originals.move;g.resetRun=originals.reset;g.respawn=originals.respawn;g.physics.resetCargo=originals.cargoReset;
  }return r;
}

async function main(){
 const digest=v=>crypto.createHash('sha256').update(v).digest('hex'),hashes=()=>Object.fromEntries(fs.readdirSync('src/game',{recursive:true}).filter(f=>fs.statSync(path.join('src/game',f)).isFile()).sort().map(f=>['src/game/'+f,digest(fs.readFileSync('src/game/'+f))]));
 const names=process.env.CASES?.split(',')??CAMPAIGN_CASTLE_SHORTCUTS,out=path.resolve(process.env.REPORT??'qa/campaign-castle-shortcuts.json');fs.mkdirSync(path.dirname(out),{recursive:true});
 const report={sourceCommit:process.env.BUILD_COMMIT??null,stableLevel:41,campaignDisplayLevel:51,edition:'foundation',runtime:ACTIVE_FOUNDATION_RUNTIME_FLAGS,version:'campaign-castle-shortcuts-v1',backend:'production-headless-physics',generatedAt:new Date().toISOString(),sources:hashes(),harnessSha256:digest(fs.readFileSync(fileURLToPath(import.meta.url))),rows:[],limitations:['Three finite attack strategies do not prove all alternate paths are absent.','Authentic prerequisite prefix failures are setup failures, never physical-block proof.','Headless simulation provides no rendering, FPS, browser, or human-playtest evidence.']};
 report.fingerprint=digest(JSON.stringify(report.sources));const save=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');save();
 const g=await createHeadlessGame();g.chamberEdition='foundation';Object.assign(g,ACTIVE_FOUNDATION_RUNTIME_FLAGS);
 try{for(const name of names){await g.selectLevel(40,true);const started=Date.now();const row=await runCampaignCastleShortcut(g,THREE,runSingularityJourney,name);row.wallSeconds=(Date.now()-started)/1000;report.rows.push(row);save();console.log(JSON.stringify({name,outcome:row.outcome,attackReached:row.attackReached,error:row.error,physicalCrownPenetration:row.physicalCrownPenetration,cargoPassedDivider:row.cargoPassedDivider,forbiddenAddress:row.forbiddenAddress,candidateBypass:row.candidateBypass,wallSeconds:row.wallSeconds}));}}
 finally{report.sourcesAfter=hashes();report.sourceDrift=Object.keys(report.sources).filter(p=>report.sources[p]!==report.sourcesAfter[p]);report.harnessSha256After=digest(fs.readFileSync(fileURLToPath(import.meta.url)));report.finished=true;report.summary={total:report.rows.length,reachedAttacks:report.rows.filter(r=>r.attackReached).length,bypassCandidates:report.rows.filter(r=>r.candidateBypass).map(r=>r.name),setupFailures:report.rows.filter(r=>!r.attackReached).map(r=>r.name),attackErrors:report.rows.filter(r=>['attack_error','navigation_error'].includes(r.outcome)).map(r=>r.name)};report.pass=!report.sourceDrift.length&&report.harnessSha256===report.harnessSha256After&&!report.summary.bypassCandidates.length&&!report.summary.setupFailures.length&&!report.summary.attackErrors.length&&report.rows.every(r=>r.sameCompanion&&r.finiteActors);save();g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();if(!report.pass)process.exitCode=1;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
