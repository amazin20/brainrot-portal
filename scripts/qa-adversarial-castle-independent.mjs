// Independent, finite attacks against the current folded-castle finale.
// Actors, bodies, portal transforms and solution flags are never assigned.
// Ordinary route prefixes create authentic intermediate states; all attacks
// use production movement/jump/fire/E. Camera-only captures are not route proof.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import * as THREE from 'three';

// Reads the rendered interface after the production tutorial cadence has run.
// Geometry overlap is reported separately from pointer hit-testing because the
// tutorial intentionally has pointer-events:none but can still obscure a button.
export function measureCastleTouchUi() {
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return !e.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0;};
  const tutorial=document.querySelector('.lab-tutorial'),tr=rect(tutorial);
  const selectors=['#joystick','#jump-button','#sprint-button',...Array.from({length:4},(_,i)=>`.lab-mobile button:nth-child(${i+1})`)];
  const controls=selectors.map(selector=>{
    const e=document.querySelector(selector),r=rect(e),samples=[[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>{
      const px=r.x+r.width*x,py=r.y+r.height*y,hit=document.elementFromPoint(px,py);
      return{x:px,y:py,hit:hit?.id||hit?.getAttribute('aria-label')||hit?.className||hit?.tagName||null,reachable:!!hit&&(hit===e||e.contains(hit))};
    });
    const overlapWidth=Math.max(0,Math.min(tr.right,r.right)-Math.max(tr.x,r.x)),overlapHeight=Math.max(0,Math.min(tr.bottom,r.bottom)-Math.max(tr.y,r.y));
    return{selector,label:e.getAttribute('aria-label')||e.textContent.trim(),rect:r,visible:visible(e),inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,tutorialOverlapArea:visible(tutorial)?overlapWidth*overlapHeight:0,samples,reachable:samples.every(s=>s.reachable)};
  });
  const result={viewport:{width:innerWidth,height:innerHeight},coarseTouch:matchMedia('(pointer:coarse)').matches,maxTouchPoints:navigator.maxTouchPoints,
    state:document.body.dataset.playState,tutorial:{text:tutorial.textContent.trim(),rect:tr,visible:visible(tutorial),inViewport:tr.x>=0&&tr.y>=0&&tr.right<=innerWidth&&tr.bottom<=innerHeight},controls};
  result.pass=result.coarseTouch&&result.maxTouchPoints>0&&result.state==='playing'&&result.tutorial.visible&&result.tutorial.inViewport&&controls.every(c=>c.visible&&c.inViewport&&c.reachable&&c.tutorialOverlapArea===0);
  return result;
}

export async function runCastleCase(g, THREE, journey, name, {capture=async()=>{}}={}) {
  const V=(...p)=>new THREE.Vector3(...p), up=V(0,1,0), angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
  const l=g.firstLevel, body=g.physics.cargoBody.id, cargo=g.cargo;
  const originals={move:g.input.getMove,reset:g.resetRun,respawn:g.respawn,cargoReset:g.physics.resetCargo};
  const move=new THREE.Vector2();
  const r={name,frames:0,shots:[],interactions:[],walks:[],trajectory:[],marks:[],resets:0,respawns:0,cargoResets:0,routePrefix:null,error:null};
  g.input.getMove=()=>move.clone();
  for(const key of ['reset','respawn'])g[key==='reset'?'resetRun':'respawn']=function(...args){r[key==='reset'?'resets':'respawns']++;return originals[key].apply(this,args);};
  g.physics.resetCargo=function(...args){r.cargoResets++;return originals.cargoReset.apply(this,args);};
  const snap=()=>({frame:r.frames,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray(),held:!!g.heldCube,teleports:g.teleportCount,state:g.state,solved:l.getTowerMetrics().solvedIds});
  const P=(id,x,z=0,y=0)=>l.rooms.get(id).P(x,z,y), state=id=>l.machines.get(id).state;
  function stop(){move.set(0,0);g.input.keys.clear();}
  function worldMove(x,z){const q=V(x,0,z).applyAxisAngle(up,-g.yaw);move.set(q.x,q.z);}
  async function frame(){
    for(let j=0;j<2&&g.state==='playing';j++)g.updatePlaying(1/120);
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
  async function force(target,seconds,{jump=true,skirt=false}={}){
    target=V(...target);g.input.keys.add('ShiftLeft');
    for(let i=0;i<seconds*60&&g.state==='playing';i++){
      const q=target.clone().sub(g.playerPosition);q.y=0;if(q.length()>.001)q.normalize();
      if(skirt){const phase=Math.floor(i/120)%4;if(phase===1||phase===2)q.applyAxisAngle(up,phase===1?Math.PI/3:-Math.PI/3);}
      const desired=Math.atan2(-q.x,-q.z);g.yaw+=Math.max(-.065,Math.min(.065,angle(desired-g.yaw)));worldMove(q.x,q.z);
      if(jump&&i%40===0)g.input.jumpQueued=true;await frame();
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
  async function shoot(slot,panel){
    const f=panel.frame(),p=f.center.clone();if(Math.abs(f.normal.y)<.1)p.y-=.4;
    await look(p);const accepted=g.firePortal(slot);
    for(let i=0;i<240&&(g.portalShots.queue.length||g.portalShots.active.length);i++)await frame();
    const result={slot,panel:panel.mesh.name,accepted,impact:g.portalShots.lastImpact,...snap()};r.shots.push(result);return accepted&&result.impact?.valid;
  }
  async function enter(panel){
    const f=panel.frame();await walk(f.center.clone().addScaledVector(f.normal,1.6).setY(f.center.y-2.4));
    const before=g.teleportCount;
    for(let i=0;i<240&&g.teleportCount===before;i++){worldMove(-f.normal.x,-f.normal.z);await frame();}
    stop();if(g.teleportCount===before)throw Error('Ordinary portal crossing failed');await wait(.2);
  }
  async function pickup(){
    if(g.heldCube)return;
    const p=g.cargo.position;await walk([p.x,g.playerPosition.y,p.z+1.1],{sprint:false});
    const accepted=g.interact();r.interactions.push({kind:'pickup',accepted,...snap()});await wait(.35);
    if(!g.heldCube)throw Error('Original cargo could not be picked up');
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
    const accepted=g.interact();r.interactions.push({kind:'control',id,accepted,...snap()});await wait(.3);return accepted;
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
    stop();r.routePrefix=await journey(g,{order:ids,stopAfter:ids.at(-1),onMilestone:m=>r.marks.push({label:'route: '+m.name,source:'native-prefix',...m})});
    await mark('Authentic staged state');
  }
  try{
    await wait(.1);await mark('Untouched spawn');
    if(name.startsWith('spawn-crown-stairs')){
      if(name.endsWith('carry'))await pickup();
      const door=l.rooms.get('crown').door;
      try{await travel(door);}catch(error){
        // The planner targets the physical door centre. Reaching its closed
        // collision face is the expected arrival when all ten sources are off.
        if(!String(error).startsWith('Error: Blocked ')||g.playerPosition.distanceTo(V(...door))>1.15)throw error;
        r.expectedDoorBlock=String(error);stop();
      }
      await mark('Locked crown entrance reached through stairs');
      await force(P('crown',-9,12),14,{skirt:true});
    }else if(name==='spawn-direct-upper-portal'){
      await travel([0,0,0]);await mark('Ground viewpoint far enough below the upper receiver');await shoot(1,l.panels.upperPortal);await travel([0,0,54]);await shoot(0,l.panels.basePortal);
      await pickup();await force([.5,0,49],12);await mark('Attempted direct ground-to-top pair');
    }else if(name==='collapsed-ground-pair'){
      await shoot(0,l.panels.basePortal);await shoot(1,l.panels.basePortal);
      await pickup();await force([.5,0,49],12);await mark('Attempted overlapping same-panel pair with cargo');
    }else if(name==='freight-service-window-alone'){
      await travel(l.rooms.get('freight').door);await walk(P('freight',3,-10));
      await force(P('freight',-3,-10),12,{skirt:false});await mark('Player tried cargo-sized service aperture');
    }else if(name==='freight-cargo-corner-push'){
      await pickup();await travel(l.rooms.get('freight').door);await walk(P('freight',3,-10));
      await dropAt(P('freight',.9,-10),[-1,0]);await force(P('freight',-.9,-10),12,{jump:false});await mark('Free cargo pressed into physical service corner');
    }else if(name==='hoist-upper-entry-no-load'){
      await stage(['freight']);await travel([l.rooms.get('hoist').door[0],18,l.rooms.get('hoist').door[2]]);
      await walk(P('hoist',-18,0,18));await walk(P('hoist',-18,10,18));await use('hoist:pawl');await mark('Upper pawl attempted from external stairs without load');
      r.mechanism={height:state('hoist').height,locked:state('hoist').locked};
    }else if(name==='archive-neither-slide'||name==='archive-a-only'){
      await stage(['sluice','optics']);await travel(l.rooms.get('archive').door);await walk(P('archive',14,0));
      if(name==='archive-a-only'){
        await use('archive:slide-a');await wait(2);await walk(P('archive',12,0));await walk(P('archive',-15,0));await walk(P('archive',-15,7));
      }else await force(P('archive',-15,7),18,{jump:true,skirt:true});
      await mark('Archive receiving bay attacked without moving B');r.mechanism={A:state('archive').A,B:state('archive').B};
      r.candidateBypass=l.getTowerMetrics().solvedIds.includes('archive');
    }else if(name==='magnet-carry-around-screen'){
      await stage(['freight','hoist']);await pickup();await travel(l.rooms.get('magnet').door);
      await walk(P('magnet',-17,0));await walk(P('magnet',-17,18.8));await walk(P('magnet',0,18.8));
      await dropAt(P('magnet',0,17),[0,-1]);await mark('Dropped original cargo behind screen without any coil');
      r.passedWithoutCoils=state('magnet').passed;await pickup();await walk(P('magnet',18,18.8));
      await walk(P('magnet',18,3,4.2));await walk(P('magnet',13,2,4.2));
      await dropAt(state('magnet').receiver,[-1,0]);await mark('Carried cargo up return stairs onto receiver without coils');
      r.mechanism={magnet:state('magnet').magnet,passed:state('magnet').passed};r.candidateBypass=l.getTowerMetrics().solvedIds.includes('magnet');
    }else if(name==='magnet-player-lowhood-after-hoist'){
      await stage(['freight','hoist']);await travel(l.rooms.get('magnet').door);await walk(P('magnet',-3,11));
      await force(P('magnet',3,11,4.2),14,{jump:true});await mark('Player attempted elevated cargo-only loading slit');
      r.candidateBypass=l.getTowerMetrics().solvedIds.includes('magnet');
    }else if(name==='migrant-gap-jump-carry'){
      await stage(['freight','sluice','optics','hoist','archive','flywheel','magnet']);await pickup();
      await travel(l.rooms.get('migrant').door);await walk(P('migrant',-6,13));
      await force(P('migrant',12,10,3),14,{jump:true,skirt:true});await mark('Gap and shield attacked without moving the carriage or firing a new pair');
      r.candidateBypass=l.getTowerMetrics().solvedIds.includes('migrant');
    }else if(name==='pendulum-return-stairs-no-span'){
      await stage(['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant']);
      await travel(l.rooms.get('pendulum').door);await walk(P('pendulum',24,-19));
      await walk(P('pendulum',-17,-19));await walk(P('pendulum',-17,-11.5));for(let i=0;i<660&&state('pendulum').ya>=.15;i++)await frame();await use('pendulum:catch-a');if(!state('pendulum').A)throw Error('Ordinary lower catch was not engaged at the intended stage');
      await walk(P('pendulum',-17,-19));await walk(P('pendulum',19,-19));await mark('Lower return shutter approached with A caught and B untouched');
      await force(P('pendulum',19,11,6),18,{jump:true,skirt:true});
      await mark('Return shaft attacked without either moving-span crossing');r.mechanism={A:state('pendulum').A,B:state('pendulum').B,stairProgress:state('pendulum').stairProgress};r.candidateBypass=l.getTowerMetrics().solvedIds.includes('pendulum');
    }else if(name==='inertia-returnstairs-without-fall'){
      await stage(['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum']);
      await travel(l.rooms.get('inertia').door);await walk(P('inertia',30,13));await walk(P('inertia',22,13));
      await force(P('inertia',22,3,-3.5),18,{skirt:true});await mark('Return staircase and shutter attacked without falling or new portal');
      r.mechanism={flew:state('inertia').flew,maxSpeed:state('inertia').maxSpeed};r.candidateBypass=l.getTowerMetrics().solvedIds.includes('inertia');
    }else if(name==='crown-empty-socket'||name==='crown-service-window-player-alone'){
      await stage(['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia']);
      await travel(l.rooms.get('crown').door);await walk(P('crown',12,13));
      if(name==='crown-empty-socket'){
        await walk(P('crown',13,7));await shoot(0,state('crown').intake);await walk(P('crown',12,-10));await shoot(1,state('crown').outlet);
        await enter(state('crown').intake);await walk(state('crown').contact);await wait(2);
        await mark('Player reached crown contact while the original cargo remains below');
      }else{
        await walk(P('crown',3,-10));await force(P('crown',-3,-10),14,{jump:true});await mark('Player attacked crown cargo-sized sight slit');
      }
      r.candidateBypass=l.getTowerMetrics().solvedIds.includes('crown');
    }else throw Error('Unknown independent castle attack '+name);
    await wait(.5);r.executed=true;
  }catch(error){r.error=String(error);r.executed=false;if(error.singularityReport)r.routeFailure=error.singularityReport;}
  finally{
    stop();r.finish=snap();r.metrics=l.getTowerMetrics();r.solvedDuringAttack=r.finish.solved.filter(id=>!r.routePrefix?.metrics?.solvedIds?.includes(id));r.candidateBypass=Boolean(r.candidateBypass||r.solvedDuringAttack.length||r.finish.state==='won');r.sameCompanion=g.cargo===cargo&&g.physics.cargoBody.id===body;
    r.frameSeconds=r.frames/60;r.finiteActors=[...g.playerPosition.toArray(),...g.cargo.position.toArray(),...g.playerVelocity.toArray()].every(Number.isFinite);
    await mark('Attack finish');g.input.getMove=originals.move;g.resetRun=originals.reset;g.respawn=originals.respawn;g.physics.resetCargo=originals.cargoReset;
  }return r;
}

if(import.meta.url===new URL(process.argv[1], 'file:').href){
  const out=path.resolve(process.env.OUT_DIR||'qa/castle-independent');fs.mkdirSync(out,{recursive:true});
  const names=(process.env.CASES||'spawn-crown-stairs-alone,spawn-crown-stairs-carry,spawn-direct-upper-portal,collapsed-ground-pair,freight-service-window-alone,freight-cargo-corner-push,hoist-upper-entry-no-load,archive-a-only,magnet-carry-around-screen,magnet-player-lowhood-after-hoist').split(',').filter(name=>name&&name!=='inspection');
  const report={edition:'foundation',level:41,version:'independent-input-attacks-v2',harnessSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),backend:process.env.BROWSER==='1'?'software-WebGL':'production-headless-physics',
    limitations:['Finite attacks do not prove every bypass is absent.','Native prefix errors mean the stage attack was not executed.','Software WebGL is not real-device FPS or a human playtest.'],
    sources:Object.fromEntries(['LabSingularityLevel.js','LabSingularityLayout.js','LabSingularityJourney.js','LabSingularityArt.js','LabSingularityKit.js','LabCastleMaterials.js','LabCastleMechanismDetails.js','LabGame.js','LabPhysics.js','LabPortals.js','LabPortalShots.js'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('src/game/'+n)).digest('hex')])),rows:[]};
  if(process.env.MOBILE==='1')report.mobileUiSources=Object.fromEntries(['src/styles.css','src/main.js','src/game/LabTutorial.js'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(n)).digest('hex')]));
  const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');let server,browser,g;
  try{
    if(process.env.BROWSER==='1'){
      const{default:puppeteer}=await import('puppeteer-core'),port=String(process.env.PORT||4186);
      let serverOutput='';
      server=spawn(process.execPath,['--input-type=module','-e',`import {createServer} from 'vite';const s=await createServer({server:{host:'127.0.0.1',port:${Number(port)},strictPort:true,hmr:false}});await s.listen();`],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
      for(const stream of[server.stdout,server.stderr])stream.on('data',chunk=>{serverOutput=(serverOutput+chunk.toString()).slice(-8000);});
      for(let i=0;i<1200;i++){
        if(server.exitCode!==null)throw Error(`Vite exited (${server.exitCode}): ${serverOutput}`);
        try{if((await fetch('http://127.0.0.1:'+port)).ok)break;}catch{}
        if(i===1199)throw Error('Vite server did not start: '+serverOutput);await new Promise(r=>setTimeout(r,50));
      }
      browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,protocolTimeout:1_800_000,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
      const page=await browser.newPage(),mobile=process.env.MOBILE==='1';
      if(mobile){
        const width=Number(process.env.MOBILE_WIDTH||390),height=Number(process.env.MOBILE_HEIGHT||844);
        if(!Number.isInteger(width)||!Number.isInteger(height)||width<280||height<280)throw Error('Invalid mobile QA viewport');
        await page.emulate({viewport:{width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true},userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'});
      }
      else await page.setViewport({width:1100,height:680,deviceScaleFactor:1});
      await page.evaluateOnNewDocument(()=>localStorage.setItem('brainrot-foundation-v1:brainrot-portal.preferences.v24',JSON.stringify({quality:'low',muted:true})));
      report.browserErrors=[];page.on('pageerror',e=>report.browserErrors.push(String(e)));
      await page.goto('http://127.0.0.1:'+port+'/?edition=foundation&level=41&debug=1',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>{const g=window.__NESI_DEMO_GAME__,m=document.querySelector('#start-screen');return g?.state==='ready'&&m&&!m.inert&&getComputedStyle(m).opacity==='1';},{timeout:180000});
      await page.$eval('#play-button',e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
      await page.waitForFunction(()=>{const e=document.querySelector('#play-button'),r=e.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));},{timeout:20000});
      if(mobile)await page.tap('#play-button');else await page.click('#play-button');
      await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='playing');
      await page.evaluate(()=>window.__NESI_DEMO_GAME__.renderer.setAnimationLoop(null));
      if(process.env.INSPECTION==='1'){
        report.inspection=[];
        const poses=[
          {name:'atrium-upper-inside',at:[6,83,59],look:[6,26,-50],fov:78},
          {name:'atrium-middle-inside',at:[5,74,20],look:[-3,20,-35],fov:72},
          {name:'freight-interior',at:[-28,12,55],look:[-48,3,35],fov:74},
          {name:'sluice-interior',at:[63,14,60],look:[44,5,28],fov:74},
          {name:'hoist-interior',at:[61,23,-16],look:[43,8,-39],fov:74},
          {name:'archive-interior',at:[-23,27,42],look:[-46,23,30],fov:74},
          {name:'magnet-interior',at:[64,30,52],look:[44,23,33],fov:74},
        ];
        for(const pose of poses){
          const data=await page.evaluate(async pose=>{
            const g=window.__NESI_DEMO_GAME__,{applyLabQuality}=await import('/src/game/LabPreferences.js');
            applyLabQuality(g,'balanced');g.camera.position.fromArray(pose.at);g.camera.lookAt(...pose.look);g.camera.fov=pose.fov;g.camera.far=245;
            g.camera.updateProjectionMatrix();g.camera.updateWorldMatrix(true,false);g.render();
            return{pose,drawCalls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,player:g.playerPosition.toArray(),cargo:g.cargo.position.toArray()};
          },pose);
          await page.screenshot({path:path.join(out,pose.name+'.jpg'),type:'jpeg',quality:92});report.inspection.push(data);save();
        }
      }
      let currentName;const mobileReports=new Map();
      await page.exposeFunction('__CASTLE_CAPTURE__',async({mark,image,mobileUi})=>{const folder=path.join(out,currentName);fs.mkdirSync(folder,{recursive:true});const index=String(report.rows.length)+'-'+String(mark.frame);fs.writeFileSync(path.join(folder,index+'.jpg'),Buffer.from(image.split(',')[1],'base64'));
        if(mobileUi){mobileReports.set(currentName,mobileUi);await page.screenshot({path:path.join(folder,'locked-crown-touch-ui.jpg'),type:'jpeg',quality:94});fs.writeFileSync(path.join(folder,'touch-ui.json'),JSON.stringify(mobileUi,null,2)+'\n');}
      });
      for(const name of names){currentName=name;const row=await page.evaluate(async({name,source,mobile,touchAuditSource})=>{
        const g=window.__NESI_DEMO_GAME__,THREE=await import('/node_modules/three/build/three.module.js'),{runSingularityJourney}=await import('/src/game/LabSingularityJourney.js');
        await g.selectLevel(40,true);document.querySelectorAll('.screen').forEach(e=>e.classList.remove('screen--active'));
        const run=(0,eval)('('+source+')');return run(g,THREE,runSingularityJourney,name,{capture:async(mark)=>{
          let mobileUi;
          if(mobile&&mark.label==='Locked crown entrance reached through stairs'){
            // One real animation tick updates the same tutorial DOM used in play.
            // No player, cargo or mechanism state is assigned for the UI audit.
            g.animate(performance.now());mobileUi=(0,eval)('('+touchAuditSource+')')();
          }
          g.render();await window.__CASTLE_CAPTURE__({mark,image:g.renderer.domElement.toDataURL('image/jpeg',.88),mobileUi});
        }});
      },{name,source:runCastleCase.toString(),mobile,touchAuditSource:measureCastleTouchUi.toString()});row.mobileUi=mobileReports.get(name);report.rows.push(row);save();console.log(JSON.stringify({name,error:row.error,solved:row.finish.solved,candidateBypass:row.candidateBypass,mobileUiPass:row.mobileUi?.pass}));}
    }else{
      const{createHeadlessGame}=await import('./lab-headless.mjs'),{runSingularityJourney}=await import('../src/game/LabSingularityJourney.js');g=await createHeadlessGame();g.chamberEdition='foundation';
      for(const name of names){await g.selectLevel(40,true);const row=await runCastleCase(g,THREE,runSingularityJourney,name);report.rows.push(row);save();console.log(JSON.stringify({name,error:row.error,solved:row.finish.solved,candidateBypass:row.candidateBypass,mechanism:row.mechanism}));}
    }
    report.finished=true;report.sourceHashesAfter=Object.fromEntries(Object.keys(report.sources).map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('src/game/'+n)).digest('hex')]));report.sourceDrift=Object.keys(report.sources).filter(n=>report.sources[n]!==report.sourceHashesAfter[n]);report.candidateBypasses=report.rows.filter(r=>r.candidateBypass).map(r=>r.name);
    report.coverageFailures=report.rows.filter(r=>r.routeFailure||(!r.executed&&!r.error?.startsWith('Error: Blocked '))).map(r=>r.name);
    if(report.mobileUiSources){report.mobileUiSourceDrift=Object.keys(report.mobileUiSources).filter(n=>report.mobileUiSources[n]!==crypto.createHash('sha256').update(fs.readFileSync(n)).digest('hex'));report.mobileUiPass=report.rows.every(r=>r.mobileUi?.pass);}
    report.pass=report.candidateBypasses.length===0&&report.coverageFailures.length===0&&report.sourceDrift.length===0&&!(report.browserErrors?.length)&&report.rows.every(r=>r.finiteActors&&r.sameCompanion&&!r.resets&&!r.respawns&&!r.cargoResets)&&(!report.mobileUiSources||(report.mobileUiPass&&!report.mobileUiSourceDrift.length));
    save();if(!report.pass)process.exitCode=1;
  }finally{save();await browser?.close();server?.kill('SIGTERM');g?.physics?.dispose();g?.portals?.dispose();}
}
