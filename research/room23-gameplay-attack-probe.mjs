import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {createHeadlessGame} from '../scripts/lab-headless.mjs';
import {runV8Journey} from '../src/game/LabV8Journey.js';
import {installRoom21Aim} from '../src/game/LabRoom21Journey.js';

// Bounded attempts through ordinary movement, jump, E and camera/shot inputs.
// No actor pose, mechanism command, force, collision state or win flag is set.
const mode=process.argv[2],out=path.resolve(process.argv[3]),root=fileURLToPath(new URL('../',import.meta.url));
const modes=['ground-goal-jumps','west-roof-jumps','no-high-delivery','skip-pan-transfer','held-original-return','early-free-drop','middle-pan-pressure'];
if(!modes.includes(mode))throw Error('Unknown ordinary-input Room23 probe: '+mode);
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceFiles=['src/game/LabRoom23PhysicalPrototype.js','src/game/LabRoom23PhysicalMachine.js','src/game/LabRoom23DynamicTraveller.js','src/game/LabRoom23Ownership.js','research/room23-gameplay-attack-probe.mjs'].map(p=>{const b=fs.readFileSync(path.join(root,p));return{path:p,bytes:b.length,sha256:sha(b)};});
const g=await createHeadlessGame();g.room23PhysicalPrototype=true;const setupResetCalls=[],resetRun=g.resetRun;
g.resetRun=function(...args){setupResetCalls.push(args[0]);return resetRun.apply(this,args);};await g.selectLevel(22,false);
const m=g.firstLevel.balance,original=g.physics.cargoBody,shape=original.shapes[0],samples=[];
let phase='authored-spawn',report=null,failure=null,maxPlayerY=-Infinity,maxWestY=-Infinity,maxEastY=-Infinity,maxRoofSupport=0,maxPanPassengerSupport=0,minOriginalContacts=Infinity,passengerSourceSteps=0,panContactNames=new Set(),maxPanContact=null;
const capture=()=>{
 const d=m.diagnostics();if(!d.ownershipValid||g.physics.cargoBody!==original||original.shapes[0]!==shape||original.mass!==3.2)throw Error('Ordinary-input probe lost the original or ownership');
 maxPlayerY=Math.max(maxPlayerY,g.playerPosition.y);maxWestY=Math.max(maxWestY,d.west.y);maxEastY=Math.max(maxEastY,d.east.y);
 minOriginalContacts=Math.min(minOriginalContacts,d.west.normalLoad+d.east.normalLoad);
 for(const c of g.physics.world.contacts){
  const side=c.bi===m.traveller.body?'bj':c.bj===m.traveller.body?'bi':null;if(!side||c.enabled===false||c.multiplier<=0)continue;
  const up=side==='bj'?-c.ni.y:c.ni.y;if(up<.65)continue;
  const other=c[side],otherShape=side==='bj'?c.sj:c.si;
  if(m.parts.some(p=>p.mesh.name.includes('freight pan hood')&&p.body===other&&p.shape===otherShape))maxRoofSupport=Math.max(maxRoofSupport,c.multiplier*up);
  if(m.cars.some(car=>car.panBody===other)){
   if(c.multiplier*up>maxPanPassengerSupport)maxPanContact={bodyId:other.id,shapeId:otherShape?.id,contactOffset:(side==='bj'?c.rj:c.ri).toArray(),parts:m.parts.filter(p=>p.body===other).map(p=>({name:p.mesh.name,shapeId:p.shape.id,local:p.local.toArray(),half:p.half.toArray()}))};
   maxPanPassengerSupport=Math.max(maxPanPassengerSupport,c.multiplier*up);
   for(const p of m.parts)if(p.body===other&&(p.shape===otherShape||p.shape.convexPolyhedronRepresentation===otherShape))panContactNames.add(p.mesh.name);
   if(d.west.normalLoad+d.east.normalLoad<.01&&Math.abs(d.sourceInput)>.2)passengerSourceSteps++;
  }
 }
 if(g.physics.world.stepnumber%120===0)samples.push({phase,worldStep:g.physics.world.stepnumber,player:g.playerPosition.toArray(),original:original.position.toArray(),held:!!g.heldCube,west:d.west,east:d.east,sourceInput:d.sourceInput,state:g.state});
};g.physics.world.addEventListener('postStep',capture);
function jumpToward(d,x,z,seconds){for(let n=0;n<seconds*60&&g.state==='playing';n++){
 if(g.playerGrounded&&n%10===0)g.input.jumpQueued=true;
 const delta=new THREE.Vector2(x-g.playerPosition.x,z-g.playerPosition.z);if(delta.length()>.05)delta.normalize();else delta.set(0,0);
 d.worldMove(delta.x,delta.y);d.frame();
}d.stop();}
function deliver(d){
 phase='ordinary-high-delivery';d.walk(-17,2.7);d.wait(2);d.aim(1,new THREE.Vector3(1.2,21.2,-1.5));
 d.walk(-6.5,8);d.walk(-4.2,8);d.walk(-4.2,3.5);d.wait(2);d.aim(0,new THREE.Vector3(-4.2,0,2.3));d.pickup();
 d.walk(-4.2,3.1);d.worldMove(0,-.1);for(let n=0;n<60;n++)d.frame();d.stop();d.wait(5);
 g.input.jumpQueued=true;d.until(()=>g.playerVelocity.y<-.01,2,'Held jump apex missed');if(!g.interact())throw Error('Release missed');
 d.until(()=>m.diagnostics().east.normalLoad>50,8,'Raised original load missing');d.wait(3);
}
function boardWest(d){
 phase='ordinary-west-boarding';d.walk(-7.5,5.6);if(!g.interact())throw Error('Clutch E missed');d.wait(6);
 d.walk(-8.5,3);d.walk(-8.5,-1);d.walk(-5.5,-1);d.walk(-5.5,1);if(!g.interact())throw Error('Ground brake E missed');
}
function dock(d){
 deliver(d);boardWest(d);phase='ordinary-middle-arrival';d.until(()=>g.playerPosition.y>9.9,20,'Ascent missed');d.wait(2);
 d.walk(5.5,1);d.walk(5.5,4.5);if(!g.interact())throw Error('Middle brake E missed');d.wait(2);
}
try{report=await runV8Journey(g,{scenario:async d=>{
 installRoom21Aim(d);
 if(mode==='ground-goal-jumps'){
  phase='ground-direct-goal-with-repeated-jumps';d.walk(-17,-15);d.walk(10,-15);jumpToward(d,10,-20,10);jumpToward(d,0,-20,10);
 }else if(mode==='west-roof-jumps'){
  phase='ordinary-original-as-step-and-roof-jumps';d.walk(-6.5,8);d.walk(-5.5,8);d.walk(-5.5,3);
  jumpToward(d,-3.1,3,7);jumpToward(d,-1.1,3,10);jumpToward(d,-1.1,4.7,8);
 }else if(mode==='no-high-delivery'){
  boardWest(d);phase='attempt-ascent-without-raised-original';d.wait(20);jumpToward(d,-1.1,4.7,8);
 }else{
  dock(d);
  if(mode==='middle-pan-pressure'){
   phase='release-brake-and-test-passenger-pan-pressure';if(!g.interact())throw Error('Middle release missed');d.walk(5.5,1);d.walk(-5.5,1);d.walk(-5.5,5.2);
   jumpToward(d,-1.1,4.7,8);jumpToward(d,3.1,4.7,5);d.wait(6);
  }else if(mode==='held-original-return'||mode==='early-free-drop'){
   phase='pickup-original-at-middle';d.walk(3.1,3);d.pickup();d.walk(5.5,3);d.wait(4);
   if(mode==='early-free-drop'){
    phase='premature-drop-on-fixed-middle-landing';d.walk(5.5,1);d.walk(7.2,1);d.walk(7.2,-1);d.walk(10,-6);if(!g.interact())throw Error('Landing release missed');d.wait(4);
    d.walk(7.2,-1);d.walk(7.2,1);d.walk(5.5,1);
   }
  }
  if(mode!=='middle-pan-pressure'){phase='return-attempt-without-opposite-pan-original';d.walk(5.5,4.5);if(!g.interact())throw Error('Return brake E missed');d.wait(18);}
 }
 d.mark('bounded ordinary-input attempt completed');
}});}catch(e){failure={name:e.name,message:e.message,stack:e.stack};}
const terminal=m.diagnostics();
const result={kind:'room23-bounded-ordinary-input-attempt',mode,sourceFiles,setupResetCalls,declaredInitialComponentFixture:false,
 actualUIPlay:false,normalAuthoredSpawn:true,report,failure,won:g.state==='won',state:g.state,sameOriginal:g.physics.cargoBody===original&&original.shapes[0]===shape,
 maxPlayerY,maxWestY,maxEastY,maxRoofSupport,maxPanPassengerSupport,minOriginalContacts,passengerSourceSteps,maxPanContact,panContactNames:[...panContactNames],
 terminal:{player:g.playerPosition.toArray(),original:original.position.toArray(),held:!!g.heldCube,diagnostics:terminal},samples,
 exhaustive:false,nativeAccepted:false,publicAccepted:false};
const p=path.join(out,'attempt.json');fs.writeFileSync(p,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({mode,won:result.won,failure:failure?.message,maxPlayerY,maxRoofSupport,maxPanPassengerSupport,passengerSourceSteps,panContactNames:[...panContactNames],path:p,sha256:sha(fs.readFileSync(p))}));
g.physics.world.removeEventListener('postStep',capture);g.firstLevel.dispose();g.physics.dispose();g.portals.dispose();
