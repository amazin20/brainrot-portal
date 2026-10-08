import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadlessGame} from '../lab-headless.mjs';
import {runV8Journey} from '../../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../../src/game/LabRoom21Journey.js';

export async function runRoom50Research(plan='short'){
 assert.ok(['short','long','long-recovery'].includes(plan));const g=await createHeadlessGame();g.chamberEdition='foundation';g.room50FormResearch=true;await g.selectLevel(49,false);
 const cargo=g.cargo,body=g.physics.cargoBody,l=g.firstLevel,isLong=plan.startsWith('long');
 let minY=Infinity,loadFrames=0;const visual=g.updateVisuals;
 g.updateVisuals=function(...args){const result=visual.apply(this,args);assert.equal(this.cargo,cargo);assert.equal(this.physics.cargoBody,body);minY=Math.min(minY,this.playerPosition.y);if(l.form.loadForce>0)loadFrames++;return result;};
 try{
  const result=await runV8Journey(g,{onMilestone:m=>console.error(plan,m.name,JSON.stringify({p:m.player,c:m.cargo,angles:[l.form.first,l.form.second],transfers:g.physics.portalTransports})),scenario:async d=>{
   installRoom21Aim(d);
   d.walk(-4,-3);d.aim(1,l.receiver.getFrame().center);
   d.walk(-5,-5);d.aim(0,l.source.getFrame().center);
   d.walk(-1,-7);d.pickup();d.walk(-5,-3.8);for(let n=0;n<300&&g.cargo.position.z> -7.54;n++){d.worldMove(0,-.65);d.frame();}g.interact();d.mark('ordinary release before upright dispatch aperture');for(let n=0;n<12;n++){d.worldMove(0,-.65);d.frame();}d.stop();
   d.until(()=>g.physics.portalTransports>0,8,'Original cargo delivery missed');d.mark('original free cargo through compatible low delivery');
   d.until(()=>l.form.loadForce>0,10,'Original cargo did not settle onto working shelf');
   if(isLong){d.walk(4.5,-5);assert.equal(g.interact(),true);assert.equal(l.form.selection,'long');}
   d.until(()=>Math.abs(l.form.first-(isLong?-Math.PI/2:0))<.002&&Math.abs(l.form.second)<.002,12,'Selected real form did not assemble');d.mark('chosen floor graph assembled from original cargo weight');d.wait(3);
   d.walk(0,-.6);
   if(isLong){
    d.walk(-6,0);d.walk(-6,3);try{d.walk(-5.10,g.cargo.position.z);}catch(e){assert.match(e.message,/Blocked walking/);assert.ok(g.playerPosition.clone().add(new THREE.Vector3(0,1.1,0)).distanceTo(g.cargo.position)<2.2);d.stop();}d.pickup();d.mark('long form permits direct original-cargo E retrieval');
    const before=l.form.first;d.wait(2);assert.equal(l.form.first,before);
    if(plan==='long-recovery'){
     const portals=[...g.portals.portals];d.walk(-6,3);d.walk(-6,0);d.walk(0,-.6);d.walk(0,-7);g.interact();d.wait(.3);
     d.walk(7.2,-9.2);assert.ok(g.interact());assert.equal(l.form.unwinding,true);
     d.until(()=>Math.abs(l.form.first-Math.PI/12)<.002&&Math.abs(l.form.second-Math.PI/2)<.002,8,'Visible unwind failed');
     assert.ok(g.portals.portals.every((p,i)=>p===portals[i]));d.mark('ordinary reversible unwind from permanent shelf preserves cargo and pair');assert.ok(g.interact());assert.equal(l.form.unwinding,false);
     const p=g.cargo.position.clone();d.walk(p.x,p.z+1.25);d.pickup();const transports=g.physics.portalTransports;
     d.walk(-5,-3.8);for(let n=0;n<300&&g.cargo.position.z> -7.54;n++){d.worldMove(0,-.65);d.frame();}g.interact();for(let n=0;n<12;n++){d.worldMove(0,-.65);d.frame();}d.stop();
     d.until(()=>g.physics.portalTransports>transports,8,'Same cargo re-delivery failed');d.until(()=>Math.abs(l.form.first+Math.PI/2)<.002&&Math.abs(l.form.second)<.002,12,'Physical reassembly failed');d.wait(3);
     d.walk(0,-.6);d.walk(-6,0);d.walk(-6,3);d.walk(-5.1,g.cargo.position.z);d.pickup();d.mark('same original cargo reassembled and retrieved after ordinary unwind');
    }
    d.walk(-6,3);d.walk(-6,12);d.walk(2,12);d.walk(2,16.1);
   }else{
    d.walk(0,6);d.walk(0,12);d.walk(-7,12.5);d.aim(1,l.north.getFrame().center);d.wait(2);
    const before=g.physics.portalTransports;d.aim(0,new THREE.Vector3(-3.8,4.015,g.cargo.position.z));
    if(g.physics.portalTransports===before){d.wait(.8);if(g.physics.portalTransports===before)d.aim(0,new THREE.Vector3(-3.8,4.015,g.cargo.position.z));}
    d.until(()=>g.physics.portalTransports>before,8,'Far cargo return missed');d.mark('short form frees pair for north cargo return');
    d.wait(1);for(let n=0;n<5&&!g.heldCube&&g.state==='playing';n++){const p=g.cargo.position.clone();d.walk(p.x,p.z-1.25);if(g.state==='playing'&&g.playerPosition.clone().add(new THREE.Vector3(0,1.1,0)).distanceTo(g.cargo.position)<2.2)d.pickup();}d.walk(2,16.1);
   }
   d.until(()=>g.state==='won',3,'Ordinary joint goal missed');
  }});
  assert.equal(result.resets+result.respawns,0);assert.equal(g.state,'won');assert.ok(l.goal.contains(g.cargo.position)&&l.goal.contains(g.playerPosition));assert.ok(loadFrames>0);
  return {...result,plan,state:g.state,cargoTransfers:g.physics.portalTransports,playerTransfers:g.teleportCount,cargoIdentityPreserved:true,loadFrames,minPlayerY:minY,finalAngles:[l.form.first,l.form.second],mechanicalScope:l.researchScope};
 }finally{g.updateVisuals=visual;g.firstLevel.dispose?.();g.physics.dispose();g.portals.dispose();}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const plan=process.argv[2]||'short',output=process.argv[3];
 try{const report=await runRoom50Research(plan);if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
 catch(error){console.error(error.stack);process.exitCode=1;}
}
