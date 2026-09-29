import * as THREE from 'three';
import {V} from './LabSingularityKit.js';
const check=(p,m)=>{if(!p)throw Error(m);},UP=V(0,1,0),angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
/** Read-only route planning plus ordinary movement, E, jump and aimed shots.
 * The driver never sets an actor position, velocity, portal or puzzle signal. */
export async function runSingularityJourney(game,{onMilestone=()=>{},stopAfter=null,order=null,onFrame=null}={}){
 const level=game.firstLevel;check(level.singularity&&game.state==='playing','Start the new Tower through Play');
 check(level.completedStages===0,'A route must start with an untouched attempt');
 const original={move:game.input.getMove,reset:game.resetRun,respawn:game.respawn,cargoReset:game.physics.resetCargo};
 const companion=game.cargo,body=game.physics.cargoBody.id,move=new THREE.Vector2();
 const report={id:level.id,level:41,pass:false,frames:0,physicsSteps:0,seconds:0,activeSeconds:0,distance:0,shots:0,jumps:0,interactions:0,resets:0,respawns:0,cargoResets:0,milestones:[],actions:[],maxIdleSeconds:0};
 let idle=0,previousYaw=game.yaw,previousPitch=game.pitch;
 game.input.getMove=()=>move.clone();
 game.resetRun=function(...a){report.resets++;return original.reset.apply(this,a);};game.respawn=function(...a){report.respawns++;return original.respawn.apply(this,a);};game.physics.resetCargo=function(...a){report.cargoResets++;return original.cargoReset.apply(this,a);};
 const S=()=>({frame:report.frames,seconds:report.physicsSteps/120,player:game.playerPosition.toArray(),cargo:game.cargo.position.toArray(),solved:level.getTowerMetrics().solvedIds,state:game.state});
 function stop(){move.set(0,0);game.input.keys.clear();}
 function worldMove(x,z){const p=V(x,0,z).applyAxisAngle(UP,-game.yaw);move.set(p.x,p.z);}
 function turn(dx,dz){const desired=Math.atan2(-dx,-dz);game.yaw+=THREE.MathUtils.clamp(angle(desired-game.yaw),-.065,.065);game.pitch+=THREE.MathUtils.clamp(-.14-game.pitch,-.025,.025);}
 async function frame(){
  const before=game.playerPosition.clone();for(let s=0;s<2&&game.state==='playing';s++){game.updatePlaying(1/120);report.physicsSteps++;}
  game.updateVisuals(1/60,1);const distance=before.distanceTo(game.playerPosition);report.distance+=distance;
  const active=distance>.0001||Math.abs(angle(game.yaw-previousYaw))+Math.abs(game.pitch-previousPitch)>.0001;report.activeSeconds+=active?1/60:0;idle=active?0:idle+1/60;report.maxIdleSeconds=Math.max(idle,report.maxIdleSeconds);previousYaw=game.yaw;previousPitch=game.pitch;
  check(game.cargo===companion&&game.physics.cargoBody.id===body,'Companion identity changed');check(!report.resets&&!report.respawns&&!report.cargoResets,'A Tower attempt reset');
  if(onFrame)await onFrame({...S(),visualFrame:report.frames,cargoBodyId:body});
  if(globalThis.__SINGULARITY_FRAME__)await globalThis.__SINGULARITY_FRAME__({...S(),visualFrame:report.frames,cargoBodyId:body});
  report.frames++;if(report.frames%120===0)await globalThis.__SINGULARITY_FLUSH__?.();
 }
 async function wait(s){stop();for(let i=0;i<Math.ceil(s*60);i++)await frame();}
 async function until(predicate,seconds,label){stop();for(let i=0;i<seconds*60;i++){if(predicate())return;await frame();}check(predicate(),`${label}: ${JSON.stringify(S())}`);}
 async function walk(p,{sprint=true,tolerance=.22,timeout=90}={}){
  p=p.toArray?.()??p;report.actions.push({kind:'walk',target:p,frame:report.frames});let best=Infinity,stuck=0;
  for(let i=0;i<timeout*60;i++){
   const dx=p[0]-game.playerPosition.x,dz=p[2]-game.playerPosition.z,d=Math.hypot(dx,dz);
   if(d<tolerance&&Math.abs(p[1]-game.playerPosition.y)<.65){stop();return;}
   if(d<best-.005){best=d;stuck=0;}else stuck++;
   check(stuck<260,`Blocked walking to ${p}; at ${game.playerPosition.toArray()}`);
   turn(dx,dz);if(sprint)game.input.keys.add('ShiftLeft');else game.input.keys.delete('ShiftLeft');
   const speed=d<.65?Math.max(.16,d/.65):1;worldMove(dx/Math.max(d,.001)*speed,dz/Math.max(d,.001)*speed);await frame();
  }throw Error(`Walk timed out ${p}`);
 }
 async function look(p){stop();p=V(...(p.toArray?.()??p));for(let i=0;i<300;i++){
  game.scene.updateMatrixWorld(true);if(p.clone().sub(game.camera.position).dot(game.camera.getWorldDirection(V()))<0){game.yaw+=.16;await frame();continue;}
  const q=p.clone().project(game.camera);if(i>20&&Math.abs(q.x)<.014&&Math.abs(q.y)<.014)return;
  game.yaw-=THREE.MathUtils.clamp(q.x,-1,1)*.21;game.pitch=THREE.MathUtils.clamp(game.pitch+THREE.MathUtils.clamp(q.y,-1,1)*.19,-1.15,1.15);await frame();
 }throw Error('Cannot aim at '+p.toArray());}
 async function shoot(slot,p){check(!game.heldCube,'Set companion down before firing');p=[...(p.toArray?.()??p)];const panel=game.portalPanels.find(a=>(a.userData.portalFrame?.()?.center??a.userData.center).distanceTo(V(...p))<.08);if(panel&&Math.abs((panel.userData.portalFrame?.()?.normal??panel.userData.normal).y)<.1)p[1]-=.4;await look(p);check(game.firePortal(slot),'Portal input rejected');report.shots++;report.actions.push({kind:'shoot',slot,...S()});await until(()=>!game.portalShots.queue.length&&!game.portalShots.active.length,4,'Unresolved shot');check(game.portalShots.lastImpact?.valid,'Invalid portal impact '+JSON.stringify(game.portalShots.lastImpact));}
 async function use(id,{approach=true,side=null}={}){const t=level.terminals.find(t=>t.id===id);check(t,'Unknown console '+id);if(approach)await walk([t.position.x,t.position.y-1,t.position.z+(side??(game.playerPosition.z<t.position.z?-1:1))*1.5]);check(!game.heldCube,'Hands occupied at '+id);check(game.interact(),'Interaction rejected '+id+' at '+game.playerPosition.toArray());report.interactions++;report.actions.push({kind:'use',id,...S()});await wait(.28);}
 async function pickup(){for(let i=0;i<4&&!game.heldCube;i++){
  const p=game.cargo.position;if(game.playerPosition.clone().add(V(0,1.1,0)).distanceTo(p)>1.9)await walk([p.x,game.playerPosition.y,p.z+1.1]);
  if(game.interact()&&game.heldCube){report.interactions++;await wait(.35);return;}await wait(.35);
 }check(game.heldCube,'Could not pick up original companion '+JSON.stringify(S()));}
 async function dropAt(p,dir=[0,-1]){await walk([p[0]-dir[0]*3,p[1],p[2]-dir[1]*3],{sprint:false});await walk([p[0]-dir[0]*.85,p[1],p[2]-dir[1]*.85],{sprint:false});await look([p[0]+dir[0]*3,p[1]+1,p[2]+dir[1]*3]);await wait(.4);check(game.heldCube&&game.interact(),'Drop failed');report.interactions++;await wait(1);}
 async function enter(panel){const f=panel.frame();check(Math.abs(f.normal.y)<.1,'Use falling input for floor portals');await walk(f.center.clone().addScaledVector(f.normal,1.6).setY(f.center.y-2.4).toArray());const old=game.teleportCount;
  for(let i=0;i<240&&game.teleportCount===old;i++){worldMove(-f.normal.x,-f.normal.z);await frame();}stop();check(game.teleportCount>old,'Portal crossing failed');await wait(.2);}
 async function jump(){check(game.playerGrounded,'Jump requires grounded feet');game.input.jumpQueued=true;report.jumps++;await frame();}
 function mark(name){const s={name,...S()};report.milestones.push(s);onMilestone(s,game);}
 const P=(id,x,z=0,y=0)=>level.rooms.get(id).P(x,z,y),st=id=>level.machines.get(id).state;
 const infrastructure=[[[0,0,-87],[0,0,73]],[[-37,0,0],[37,0,0]],...level.edges];
 async function travel(to){
  const start=game.playerPosition.toArray(),end=to.toArray?.()??to;const points=[start,end,...infrastructure.flat()];
  for(const [a,b]of infrastructure)for(const [c,d]of infrastructure){if(a[1]!==b[1]||c[1]!==d[1]||a[1]!==c[1])continue;
   const ax=a[0]!==b[0],cx=c[0]!==d[0];if(ax===cx)continue;const h=ax?[a,b]:[c,d],v=ax?[c,d]:[a,b],p=[v[0][0],a[1],h[0][2]];
   if(p[0]>=Math.min(h[0][0],h[1][0])-.01&&p[0]<=Math.max(h[0][0],h[1][0])+.01&&p[2]>=Math.min(v[0][2],v[1][2])-.01&&p[2]<=Math.max(v[0][2],v[1][2])+.01)points.push(p);
  }
  for(const p of [start,end]){let best=null,dist=Infinity;for(const [a,b]of infrastructure){const q=new THREE.Line3(V(...a),V(...b)).closestPointToPoint(V(...p),true,V());if(q.distanceTo(V(...p))<dist){dist=q.distanceTo(V(...p));best=q.toArray();}}if(best)points.push(best);}
  const map=new Map(points.map(p=>[p.map(n=>Math.round(n*100)/100).join(','),p]));const nodes=[...map.values()],adj=nodes.map(()=>[]);const si=nodes.findIndex(p=>p.every((v,i)=>Math.abs(v-start[i])<.006)),ei=nodes.findIndex(p=>p.every((v,i)=>Math.abs(v-end[i])<.006));
  for(const [a,b]of infrastructure){const line=new THREE.Line3(V(...a),V(...b)),near=nodes.map((p,i)=>({p,i,t:line.closestPointToPointParameter(V(...p),true)})).filter(n=>line.at(n.t,V()).distanceTo(V(...n.p))<.05).sort((x,y)=>x.t-y.t);
   for(let i=1;i<near.length;i++){const u=near[i-1].i,v=near[i].i,dist=V(...nodes[u]).distanceTo(V(...nodes[v]));adj[u].push([v,dist]);adj[v].push([u,dist]);}}
  for(const id of [si,ei]){if(adj[id].length)continue;let candidates=nodes.map((p,j)=>({j,d:V(...p).distanceTo(V(...nodes[id]))})).filter(v=>v.j!==id&&adj[v.j].length).sort((a,b)=>a.d-b.d);check(candidates.length,'Missing route junction');const v=candidates[0];adj[id].push([v.j,v.d]);adj[v.j].push([id,v.d]);}
  const distance=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),visited=new Set();distance[si]=0;
  while(!visited.has(ei)){let u=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(u<0||distance[i]<distance[u]))u=i;check(u>=0&&Number.isFinite(distance[u]),'Disconnected infrastructure');visited.add(u);for(const [v,w]of adj[u])if(distance[u]+w<distance[v]){distance[v]=distance[u]+w;prev[v]=u;}}
  const route=[];for(let u=ei;u!==si;u=prev[u])route.unshift(nodes[u]);for(const p of route)await walk(p);
 }
 async function arrive(id){await travel(level.rooms.get(id).door);await walk(P(id,0,0));mark('Entered '+id);}
 async function leave(id,via=[]){for(const p of via)await walk(p);await walk(level.rooms.get(id).door);}
 const routines={
  async orrery(){await travel(level.rooms.get('orrery').door);await walk(P('orrery',20,13));
   for(const [i,count]of [[2,2],[1,3],[0,3]]){await use('orrery:orbit-'+i);for(let n=1;n<count;n++)await use('orrery:orbit-'+i,{approach:false});}
   await walk(P('orrery',20,13));await walk(P('orrery',20,0));await walk(P('orrery',-21,0));await until(()=>level.getTowerMetrics().solvedIds.includes('orrery'),2,'Orrery not solved');await walk(P('orrery',20,0));await leave('orrery');},
  async drydock(){if(!game.heldCube){await travel([0,0,12]);await pickup();}await travel(level.rooms.get('drydock').door);await walk(P('drydock',-18,-11));await dropAt(st('drydock').pad,[1,0]);
   await walk(P('drydock',0,-7));await walk(P('drydock',0,0));await use('drydock:lift');await until(()=>game.playerPosition.y>7.7,7,'Elevator did not rise');await walk(P('drydock',0,10,8));await use('drydock:pawl');
   await walk(P('drydock',-12,9,8));await shoot(1,st('drydock').panels.receiving.center);await walk(P('drydock',-12,6.45,8));await shoot(0,st('drydock').panels.floorPortal.center);
   await until(()=>level.getTowerMetrics().solvedIds.includes('drydock'),6,'Companion not returned to upper dock');await pickup();await walk(P('drydock',16,12,8));await walk(P('drydock',18,6,8));await walk(P('drydock',18,21));await walk(P('drydock',0,22));await leave('drydock',[P('drydock',-18,22),P('drydock',-18,0)]);
   await travel([0,0,12]);await dropAt([2,0,12]);},
  async optics(){await travel(level.rooms.get('optics').door);await walk(P('optics',-17,12));await use('optics:mirror');await walk(P('optics',-16,-1));await shoot(0,st('optics').intake.center);await walk(P('optics',-14,12));await walk(P('optics',3,12));await shoot(1,st('optics').outlet.center);
   await until(()=>level.getTowerMetrics().solvedIds.includes('optics'),3,'No reflected beam');await leave('optics',[P('optics',0,14)]);},
  async reservoir(){await arrive('reservoir');for(const pair of ['0-1','1-2','2-0','1-2','0-1','1-2','2-0']){await use('reservoir:'+pair);await until(()=>!st('reservoir').flowing,3,'Fluid transfer unfinished');}
   await walk(P('reservoir',0,12));await wait(1.5);await walk(P('reservoir',0,22));await until(()=>level.getTowerMetrics().solvedIds.includes('reservoir'),2,'Water split failed');await walk(P('reservoir',0,12));await leave('reservoir',[P('reservoir',18,12),P('reservoir',18,0)]);},
  async echo(){await travel(level.rooms.get('echo').door);await walk(P('echo',-20,-14));await shoot(0,st('echo').input.center);await walk(P('echo',0,0));await shoot(1,st('echo').output.center);
   await walk(P('echo',-23,6));await use('echo:record');await walk(st('echo').A);await wait(2.5);await walk(P('echo',-23,6));await use('echo:record');await use('echo:replay');await enter(st('echo').input);await walk(st('echo').B);
   await until(()=>level.getTowerMetrics().solvedIds.includes('echo'),25,'Echo and player did not coincide');await use('echo:replay');await leave('echo');},
  async magnet(){await travel([0,0,12]);await pickup();await travel(level.rooms.get('magnet').door);await walk(P('magnet',-16,0));await dropAt(st('magnet').sender,[1,0]);await walk(P('magnet',-17,-14));await use('magnet:coil-0');
   await until(()=>game.cargo.position.y>4.2,6,'Magnet failed to lift');await use('magnet:coil-1');await until(()=>st('magnet').passed,9,'Cargo did not pass behind screen');await use('magnet:coil-2');await until(()=>Math.hypot(game.cargo.position.x-P('magnet',12)[0],game.cargo.position.z-P('magnet',0,0)[2])<.5,12,'Cargo missed receiver');
   await use('magnet:coil-2',{approach:false});await until(()=>level.getTowerMetrics().solvedIds.includes('magnet'),6,'Cargo did not settle');await walk(P('magnet',20.2,-14));await walk(P('magnet',20.2,18.8));await walk(P('magnet',18,18.8));await walk(P('magnet',18,3,4.2));await walk(P('magnet',13,2,4.2));await pickup();
   await walk(P('magnet',18,3,4.2));await walk(P('magnet',18,18.8));await walk(P('magnet',-17,18.8));await leave('magnet',[P('magnet',-17,0)]);await travel([0,0,12]);await dropAt([2,0,12]);},
  async transmission(){await arrive('transmission');await use('transmission:ratio');await use('transmission:crank');for(let i=0;i<4;i++)await use('transmission:crank',{approach:false});await use('transmission:clutch');
   if(st('transmission').output>6.0){await use('transmission:brake');await until(()=>st('transmission').output<5.7,5,'Brake feedback');await use('transmission:brake',{approach:false});}
   await until(()=>level.getTowerMetrics().solvedIds.includes('transmission'),6,'Flywheel speed unstable');await leave('transmission',[P('transmission',13,0)]);},
  async accumulator(){await travel(level.rooms.get('accumulator').door);await walk(P('accumulator',-10,-11));await shoot(0,st('accumulator').input.center);await walk(P('accumulator',-10,19));await walk(P('accumulator',12,19));await shoot(1,st('accumulator').output.center);
   await walk(P('accumulator',-10,19));await walk(st('accumulator').pad);await until(()=>st('accumulator').charge>.99,3,'Capacitor did not charge');await enter(st('accumulator').input);await use('accumulator:discharge');await walk(P('accumulator',12,19));await walk(P('accumulator',-10,19));await leave('accumulator',[P('accumulator',-10,0)]);},
  async archive(){await travel(level.rooms.get('archive').door);await use('archive:slide-a');await walk(P('archive',12,-13));await walk(P('archive',-7,-13));await use('archive:slide-b');await walk(P('archive',-5,-13));await walk(P('archive',-5,7));await walk(P('archive',-15,7));await until(()=>level.getTowerMetrics().solvedIds.includes('archive'),2,'Archive did not align');await walk(P('archive',-5,7));await walk(P('archive',-5,-13));await walk(P('archive',12,-13));await leave('archive',[P('archive',14,0)]);},
  async migrant(){await travel(level.rooms.get('migrant').door);await walk(P('migrant',-12,12));await shoot(0,st('migrant').intake.center);await walk(P('migrant',-13,0));await shoot(1,st('migrant').moving.frame().center);await use('migrant:rail');
   await walk(P('migrant',-12,12));await until(()=>st('migrant').travel>.99,7,'Rail did not reach far end');await enter(st('migrant').intake);await walk(P('migrant',12,10,3));await until(()=>level.getTowerMetrics().solvedIds.includes('migrant'),2,'Moving portal arrival not registered');await enter(st('migrant').moving);await walk(P('migrant',-12,12));await leave('migrant',[P('migrant',-12,0)]);},
  async inertia(){await travel(level.rooms.get('inertia').door);await walk(P('inertia',-22,12));await walk(P('inertia',-22,-4));await shoot(0,st('inertia').intake.center);await walk(P('inertia',-22,12));await walk(P('inertia',-10,12));await shoot(1,st('inertia').outlet.center);await walk(P('inertia',-27,10));await walk(P('inertia',-27,-14,12));await walk(P('inertia',-1,-14,12));await walk(P('inertia',-1,-11.35,12),{sprint:false,tolerance:.06});
   const before=game.teleportCount;for(let i=0;i<8*60&&game.teleportCount===before;i++){worldMove(0,.42);await frame();}stop();check(game.teleportCount>before,'Falling intake missed');await until(()=>game.playerGrounded,6,'Fling did not land');await walk(P('inertia',21,0,-3.5));await until(()=>level.getTowerMetrics().solvedIds.includes('inertia'),2,'Momentum proof missing');await walk(P('inertia',25,3,-3.5));await walk(P('inertia',25,13));await leave('inertia',[P('inertia',0,13)]);},
  async inversion(){await travel(level.rooms.get('inversion').door);await walk(P('inversion',10,-12));await use('inversion:polarity');await walk(P('inversion',0,0));await jump();
   await until(()=>game.playerPosition.y>69.6,6,'Gravity ascent did not rise');for(let i=0;i<5*60&&game.playerPosition.z<P('inversion',0,10)[2];i++){worldMove(0,1);await frame();}stop();await until(()=>game.playerGrounded,6,'Upper inversion landing missed');await walk(P('inversion',9,12,14));await until(()=>level.getTowerMetrics().solvedIds.includes('inversion'),2,'Inversion incomplete');},
 };
 try{
  const sequence=order??['orrery','optics','reservoir','transmission','echo','accumulator','drydock','magnet','archive','migrant','inertia','inversion'];
  for(const id of sequence){check(routines[id],'Unknown route '+id);mark('Start '+id);await routines[id]();check(level.getTowerMetrics().solvedIds.includes(id),'Missing solved machine '+id);mark('Solved '+id);await globalThis.__SINGULARITY_FLUSH__?.();if(stopAfter===id){report.partial=true;break;}}
  if(!report.partial){
   // The final retrieval is a real two-way portal path to the original body.
   await walk(P('inversion',12,10,14));await shoot(0,level.panels.upperPortal.center);
   await walk(P('inversion',15,0,14));await shoot(1,level.panels.basePortal.center);await enter(level.panels.upperPortal);
   await walk([2,0,12]);await pickup();await enter(level.panels.basePortal);await walk(P('inversion',12,10,14));await dropAt(P('inversion',12,10,14));
   await walk(P('inversion',15,0,14));await shoot(1,level.panels.crownPortal.center);await walk(P('inversion',12,10,14));await pickup();await enter(level.panels.upperPortal);await walk([0,72,5]);await until(()=>game.state==='won',3,'Crown joint arrival failed');report.pass=true;mark('Crown completed with original companion');
  }
  report.seconds=report.physicsSteps/120;report.teleports=game.teleportCount;report.metrics=level.getTowerMetrics();report.sameCompanion=game.cargo===companion&&game.physics.cargoBody.id===body;return report;
 }catch(error){report.seconds=report.physicsSteps/120;report.failure={error:String(error),...S()};report.metrics=level.getTowerMetrics();error.singularityReport=report;throw error;}
 finally{stop();game.input.getMove=original.move;game.resetRun=original.reset;game.respawn=original.respawn;game.physics.resetCargo=original.cargoReset;await globalThis.__SINGULARITY_FLUSH__?.();}
}
