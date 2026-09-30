import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

/** Deliberately placed, isolated adversarial contact probes. This is NOT a
 * walkthrough: actor placement and temporarily isolated collision lists make
 * each failure attributable to a particular physical fixture. The capsule
 * contact calculation is the unmodified production LabGame.resolveBody. */
export function auditSingularityContacts(game) {
 const level=game.firstLevel;
 if(!level?.singularity)throw Error('Adversarial audit requires level 41');
 const report={method:'Placed adversarial fixture probes through the production capsule resolver; not ordinary gameplay or a complete playthrough.',registry:[],contacts:[],apertures:[],dependencies:[],failures:[]};
 const colliders=game.colliders,grounded=game.playerGrounded,groundContact=game.groundedByCollider;
 const vector=(x=0,y=0,z=0)=>game.playerPosition.clone().set(x,y,z);
 const fail=(kind,detail)=>report.failures.push({kind,...detail});
 function resolveProbe(selected,start,direction,steps=14){
  const p=vector(...start),velocity=vector(...direction).multiplyScalar(6),advance=vector(...direction).multiplyScalar(.06);
  game.colliders=selected;game.playerGrounded=false;
  for(let i=0;i<steps;i++){const before=p.clone();p.add(advance);game.groundedByCollider=false;game.resolveBody(p,before,velocity,.43,2.4,false);}
  return p;
 }
 try {
  for(const c of colliders){
   const item=game.physics.solids.get(c.mesh.uuid),size=c.box.getSize(vector()),centre=c.box.getCenter(vector());
   const finite=[...c.box.min.toArray(),...c.box.max.toArray()].every(Number.isFinite);
   if(!item||!finite||Math.min(size.x,size.y,size.z)<=0){fail('registry',{name:c.mesh.name,id:c.mesh.uuid,registered:!!item,finite,size:size.toArray()});continue;}
   const error=Math.max(Math.abs(item.target.x-centre.x),Math.abs(item.target.y-centre.y),Math.abs(item.target.z-centre.z),Math.abs(item.half.x-size.x/2),Math.abs(item.half.y-size.y/2),Math.abs(item.half.z-size.z/2));
   const maskMatches=(item.body.collisionFilterMask!==0)===(c.enabled!==false);
   if(error>1e-5||!maskMatches)fail('physics-registry',{name:c.mesh.name,id:c.mesh.uuid,error,maskMatches});
  }
  report.registry={checked:colliders.length,cargoBodies:game.physics.cargoBody?1:0};
  for(const room of level.rooms.values()){
   const d=room.def,axis=d.entry==='e'||d.entry==='w'?'x':'z',other=axis==='x'?'z':'x';
   const face=d.at[axis==='x'?0:2]+(d.entry==='e'||d.entry==='s'?-1:1)*(axis==='x'?d.w:d.d)/2;
   const wall=colliders.find(c=>c.enabled!==false&&Math.abs(c.box.getCenter(vector())[axis]-face)<.03&&c.box.min[other]<=d.at[other==='x'?0:2]&&c.box.max[other]>=d.at[other==='x'?0:2]&&c.box.min.y<=d.at[1]+.1&&c.box.max.y>=d.at[1]+2.4);
   if(!wall){fail('missing-shell-wall',{room:d.id,axis,face});continue;}
   for(const sign of [-1,1]){
    const start=[...d.at],edge=sign>0?wall.box.max[axis]:wall.box.min[axis],index=axis==='x'?0:2;
    start[index]=edge+sign*.65;const direction=[0,0,0];direction[index]=-sign;
    const result=resolveProbe([wall],start,direction),clearance=sign*(result[axis]-edge),pass=clearance>=.429;
    report.contacts.push({room:d.id,name:'sealed-room-wall',axis,side:sign,pass,clearance});
    if(!pass)fail('capsule-wall',{room:d.id,axis,side:sign,clearance});
   }
  }
  const owners=[];level.structure.traverse(o=>{if(o.userData.compound)owners.push(o);});
  for(const owner of owners){
   if(owner.name!=='Open machine ring')continue;
   const centre=owner.position,normal=vector(0,0,1).applyQuaternion(owner.quaternion),radius=owner.geometry.parameters?.radius;
   if(!radius||radius<1.7||Math.abs(normal.y)>.01)continue;
   const selected=owner.userData.compound.parts.map(p=>p.collider),start=centre.clone().addScaledVector(normal,1.2);start.y=centre.y-1.2;
   const result=resolveProbe(selected,start.toArray(),normal.clone().negate().toArray(),40),distance=result.clone().sub(centre).dot(normal),pass=distance<-.8;
   report.apertures.push({name:owner.name,centre:centre.toArray(),radius,pass,distance});
   if(!pass)fail('filled-ring-aperture',{centre:centre.toArray(),radius,distance});
  }
  for(const room of level.rooms.values())if(room.def.requires.length){
   const closed=room.def.requires.some(id=>!level.getTowerMetrics().solvedIds.includes(id));
   if(!closed)continue;
   const position=room.door,axis=room.def.entry==='e'||room.def.entry==='w'?'x':'z',index=axis==='x'?0:2;
   const leaves=colliders.filter(c=>c.kinematic&&c.enabled!==false&&Math.abs(c.box.getCenter(vector())[axis]-position[index])<.05&&c.box.min.y<=position[1]+.1&&c.box.max.y>=position[1]+4.5);
   const inward=(room.def.entry==='e'||room.def.entry==='s')?-1:1,start=[...position],direction=[0,0,0];
   start[index]-=inward*1.2;direction[index]=inward;
   const result=resolveProbe(leaves,start,direction,45),crossed=inward*(result[axis]-position[index])>.05;
   report.dependencies.push({room:room.def.id,leaves:leaves.length,pass:leaves.length>=2&&!crossed,final:result.toArray()});
   if(leaves.length<2||crossed)fail('dependency-gate',{room:room.def.id,leaves:leaves.length,crossed,final:result.toArray()});
  }
 }finally{game.colliders=colliders;game.playerGrounded=grounded;game.groundedByCollider=groundContact;}
 report.pass=report.failures.length===0;return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const mode=process.env.AUDIT_MODE??'headless',out=path.resolve(process.env.OUT_DIR??'qa/singularity-adversarial');fs.mkdirSync(out,{recursive:true});
 let report;
 if(mode==='browser'){
  const {default:puppeteer}=await import('puppeteer-core');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
   const page=await browser.newPage();page.setDefaultTimeout(180000);await page.setViewport({width:960,height:540});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));const url=new URL(process.env.PAGE_URL??'http://127.0.0.1:4173/');url.searchParams.set('level','41');url.searchParams.set('edition','foundation');url.searchParams.set('debug','1');
   await page.goto(url.href,{waitUntil:'networkidle2'});await page.waitForFunction(()=>window.__NESI_DEMO_GAME__?.state==='ready');
   await page.evaluate(()=>{const g=window.__NESI_DEMO_GAME__;g.renderer.setAnimationLoop(null);g.resetRun(true);});
   report=await page.evaluate(`${auditSingularityContacts.toString()};auditSingularityContacts(window.__NESI_DEMO_GAME__)`);
   report.errors=errors;report.pass&&=errors.length===0;
   await page.evaluate(()=>window.__NESI_DEMO_GAME__.render());await page.screenshot({path:path.join(out,'contact-audit-start.png')});
  }finally{await browser.close();}
 }else{
  const {createHeadlessGame}=await import('./lab-headless.mjs');const game=await createHeadlessGame();game.chamberEdition='foundation';await game.selectLevel(40,true);
  try{report=auditSingularityContacts(game);}finally{game.firstLevel.dispose();game.physics.dispose();game.portals.dispose();}
 }
 fs.writeFileSync(path.join(out,'adversarial-evidence.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));assert.equal(report.pass,true,JSON.stringify(report.failures));
}
